import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import { Checkin, EvidenceType } from '../types/index.ts';
import { parseTimestamp, getTimestampMillis } from './useCommitments.ts';
import { supabase, isSupabaseConfigured, supabasePublishableKey } from '../lib/supabase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

export const CHECKIN_EVIDENCE_BUCKET = 'checkin-evidence';
export const MAX_NOTE_LENGTH = 1000;
export const MAX_IMAGE_INPUT_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4'];

/**
 * Compresses an image client-side preserving aspect ratio (max dimension 1280px)
 * using the canvas export approach (JPEG quality 0.85).
 */
export async function compressEvidenceImage(file: File, maxDim = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image processing timed out. Please try a different photo.'));
      }
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      isSettled = true;
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          reject(new Error('Unable to initialize canvas context for compression.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image compression output was null.'));
            }
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Could not read or decode image file.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads check-in evidence using path convention:
 * {uid}/{commitmentId}/{timestamp}_{filename}
 */
export async function uploadCheckinEvidence(
  file: File,
  uid: string,
  commitmentId: string,
  idToken: string
): Promise<{ publicUrl: string; evidenceType: 'photo' | 'video' }> {
  const fileType = file.type || '';
  const isImage = ALLOWED_IMAGE_TYPES.includes(fileType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(fileType);

  if (!isImage && !isVideo) {
    throw new Error('Unsupported file type. Please upload a JPG, PNG, or WebP photo, or an MP4 video.');
  }

  const timestamp = Date.now();
  let uploadPayload: Blob | File = file;
  let finalContentType = fileType;
  let sanitizedExt = isVideo ? 'mp4' : 'jpg';

  if (isImage) {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      throw new Error('Image size must be smaller than 5MB.');
    }
    // Compress image client-side to lightweight JPEG
    uploadPayload = await compressEvidenceImage(file, 1280);
    finalContentType = 'image/jpeg';
  } else if (isVideo) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('Video size exceeds 20MB limit. Please select a shorter video.');
    }
    uploadPayload = file;
    finalContentType = 'video/mp4';
  }

  const rawName = file.name ? file.name.replace(/\.[^/.]+$/, '') : (isVideo ? 'video' : 'photo');
  const safeBaseName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${uid}/${commitmentId}/${timestamp}_${safeBaseName}.${sanitizedExt}`;

  // 1. First attempt upload via Supabase Edge Function if available
  const rawSupabaseUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    '';
  const cleanSupabaseUrl = rawSupabaseUrl
    ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
    : 'https://qbuqyagfrygyjwbpzdvy.supabase.co';

  const edgeFunctionUrl = `${cleanSupabaseUrl}/functions/v1/upload-checkin-evidence`;

  let edgeFunctionSucceeded = false;
  let edgeFunctionPublicUrl: string | null = null;

  try {
    const formData = new FormData();
    formData.append('file', uploadPayload, `${timestamp}_${safeBaseName}.${sanitizedExt}`);
    formData.append('commitmentId', commitmentId);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${idToken}`,
    };
    if (supabasePublishableKey) {
      headers['apikey'] = supabasePublishableKey;
    }

    const resp = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.publicUrl) {
        edgeFunctionSucceeded = true;
        edgeFunctionPublicUrl = data.publicUrl;
      }
    }
  } catch {
    // If Edge function is not deployed or network fails, proceed to direct client storage upload
  }

  if (edgeFunctionSucceeded && edgeFunctionPublicUrl) {
    return {
      publicUrl: edgeFunctionPublicUrl,
      evidenceType: isVideo ? 'video' : 'photo',
    };
  }

  // 2. Direct upload to Supabase Storage checkin-evidence bucket
  if (!isSupabaseConfigured) {
    throw new Error('Supabase Storage is not configured. Please check your Supabase environment variables.');
  }

  const { error: uploadError } = await supabase.storage
    .from(CHECKIN_EVIDENCE_BUCKET)
    .upload(storagePath, uploadPayload, {
      contentType: finalContentType,
      upsert: true,
    });

  if (uploadError) {
    const msg = uploadError.message || '';
    if (msg.includes('Bucket not found') || (uploadError as any).code === 'NoSuchBucket') {
      throw new Error(
        'Supabase Storage bucket "checkin-evidence" was not found. Please create the "checkin-evidence" bucket in the Supabase Dashboard.'
      );
    }
    throw new Error(`Evidence upload failed: ${msg}`);
  }

  const { data: urlData } = supabase.storage
    .from(CHECKIN_EVIDENCE_BUCKET)
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    throw new Error('Could not retrieve public URL for uploaded evidence.');
  }

  return {
    publicUrl: urlData.publicUrl,
    evidenceType: isVideo ? 'video' : 'photo',
  };
}

export interface UseCheckinsOptions {
  unbounded?: boolean;
  limit?: number;
}

export function useCheckins(commitmentId?: string, options?: UseCheckinsOptions) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const unbounded = options?.unbounded;
  const maxLimit = options?.limit;

  useEffect(() => {
    if (!commitmentId) {
      setCheckins([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Query Firestore collection "checkins" filtered strictly by commitmentId
    const checkinsQuery = query(
      collection(db, 'checkins'),
      where('commitmentId', '==', commitmentId)
    );

    const unsubscribe = onSnapshot(
      checkinsQuery,
      (snapshot) => {
        const items: Checkin[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            commitmentId: data.commitmentId,
            userId: data.userId,
            evidenceType: data.evidenceType || 'none',
            evidenceUrl: data.evidenceUrl || undefined,
            note: data.note || undefined,
            timestamp: data.timestamp,
            status: data.status || 'pending',
          };
        });

        // In-memory sort: most recent check-in first
        items.sort((a, b) => {
          const timeA = getTimestampMillis(a.timestamp);
          const timeB = getTimestampMillis(b.timestamp);
          return timeB - timeA;
        });

        if (unbounded) {
          setCheckins(items);
        } else if (typeof maxLimit === 'number' && maxLimit > 0) {
          setCheckins(items.slice(0, maxLimit));
        } else {
          setCheckins(items.slice(0, 20));
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore checkins onSnapshot error:', err);
        setError('Unable to load check-ins. Please check your connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [commitmentId, unbounded, maxLimit]);

  /**
   * Submits a check-in for this commitment.
   * Enforces minimum content rule, size limits, and atomic Firestore creation.
   */
  const createCheckin = useCallback(
    async (
      note?: string,
      evidenceFile?: File | null,
      commitmentOwnerId?: string
    ): Promise<string> => {
      // 1. Confirm user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be signed in to submit a check-in.');
      }

      if (!commitmentId) {
        throw new Error('No commitment specified for this check-in.');
      }

      // 2. Client-side commitment ownership validation
      if (commitmentOwnerId && commitmentOwnerId !== currentUser.uid) {
        throw new Error('You can only check in on your own commitments.');
      }

      // 3. Note sanitization and validation
      const trimmedNote = (note || '').trim();

      // Minimum-content rule: must contain at least non-empty note OR evidence file
      if (!trimmedNote && !evidenceFile) {
        throw new Error('Please provide a note or attach photo/video evidence.');
      }

      if (trimmedNote.length > MAX_NOTE_LENGTH) {
        throw new Error(`Note cannot exceed ${MAX_NOTE_LENGTH} characters.`);
      }

      let evidenceType: 'none' | 'photo' | 'video' = 'none';
      let evidenceUrl: string | null = null;

      // 4. Evidence upload if file is present
      if (evidenceFile) {
        const fileType = evidenceFile.type || '';
        const isImage = ALLOWED_IMAGE_TYPES.includes(fileType);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(fileType);

        if (!isImage && !isVideo) {
          throw new Error('Unsupported file type. Please upload a JPG, PNG, or WebP photo, or an MP4 video.');
        }

        if (isImage && evidenceFile.size > MAX_IMAGE_INPUT_BYTES) {
          throw new Error('Image size must be smaller than 5MB.');
        }

        if (isVideo && evidenceFile.size > MAX_VIDEO_BYTES) {
          throw new Error('Video size exceeds 20MB limit. Please select a shorter video.');
        }

        // Get fresh Firebase ID token for authentication
        let idToken = '';
        try {
          idToken = await currentUser.getIdToken();
        } catch (tokenErr) {
          console.error('Failed to obtain Firebase ID token for checkin upload:', tokenErr);
          throw new Error('Could not authenticate upload request. Please sign in again.');
        }

        // Atomic rule: upload evidence FIRST before writing to Firestore
        const uploadResult = await uploadCheckinEvidence(
          evidenceFile,
          currentUser.uid,
          commitmentId,
          idToken
        );

        evidenceType = uploadResult.evidenceType;
        evidenceUrl = uploadResult.publicUrl;
      }

      // 5. Create Firestore checkins/{id} document
      const docPayload: Record<string, any> = {
        commitmentId,
        userId: currentUser.uid,
        evidenceType,
        timestamp: serverTimestamp(),
        status: 'pending',
      };

      if (trimmedNote) {
        docPayload.note = trimmedNote;
      }

      if (evidenceUrl) {
        docPayload.evidenceUrl = evidenceUrl;
      }

      try {
        const docRef = await addDoc(collection(db, 'checkins'), docPayload);
        return docRef.id;
      } catch (firestoreErr: any) {
        console.error('Firestore checkin creation error:', firestoreErr);
        handleFirestoreError(firestoreErr, OperationType.CREATE, 'checkins');
      }
    },
    [commitmentId]
  );

  return {
    checkins,
    loading,
    error,
    createCheckin,
  };
}

/**
 * Hook to retrieve all check-ins submitted by the authenticated user across all commitments.
 * Used exclusively for private trust score calculation on Profile page.
 */
export function useAllUserCheckins() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCheckins([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'checkins'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Checkin[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            commitmentId: data.commitmentId,
            userId: data.userId,
            evidenceType: data.evidenceType || 'none',
            evidenceUrl: data.evidenceUrl || undefined,
            note: data.note || undefined,
            timestamp: data.timestamp,
            status: data.status || 'pending',
          };
        });

        items.sort((a, b) => {
          const timeA = getTimestampMillis(a.timestamp);
          const timeB = getTimestampMillis(b.timestamp);
          return timeB - timeA;
        });

        setCheckins(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore all user checkins error:', err);
        setError('Unable to load check-ins.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { checkins, loading, error };
}

export { parseTimestamp, getTimestampMillis };
