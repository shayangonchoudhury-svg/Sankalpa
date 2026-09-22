import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase.ts';
import { UPLOAD_AVATAR_FUNCTION_URL, supabasePublishableKey } from '../../lib/supabase.ts';

interface AvatarUploadProps {
  uid: string;
  currentAvatarUrl?: string;
  displayName?: string;
  onUploadSuccess?: (urlOrPath: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Converts a Blob to a base64 Data URL for instant local preview.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image data.'));
    reader.readAsDataURL(blob);
  });
}


/**
 * Compresses an image client-side to a max 400x400 centered square crop.
 */
async function compressImageToSquare(file: File, maxDim = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let isSettled = false;

    // 8-second safety timeout on image reading & canvas export
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image processing timed out. Please try a different photo.'));
      }
    }, 8000);

    const cleanup = () => {
      clearTimeout(timer);
      isSettled = true;
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const targetDim = Math.min(side, maxDim);

        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          reject(new Error('Unable to initialize canvas context for compression.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, targetDim, targetDim);

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

export default function AvatarUpload({
  uid,
  currentAvatarUrl,
  displayName = 'User',
  onUploadSuccess,
  size = 'lg',
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Directly use the Supabase public URL from Firestore or local preview during upload
  const displayAvatarUrl = previewUrl || currentAvatarUrl || null;

  // Reset image error state whenever avatar URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [displayAvatarUrl]);

  const initial = (displayName.trim()[0] || 'U').toUpperCase();

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-2xl',
  }[size];

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // 1. File type validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. File size validation (5MB max before compression)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be smaller than 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. User verification
    const currentUser = auth.currentUser;
    const targetUid = currentUser?.uid || uid;
    if (!currentUser || !targetUid) {
      setError('User session not found. Please sign in again.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);

    try {
      // 4. Client-side square crop & compression to max 400x400 JPEG
      let compressedBlob: Blob;
      try {
        compressedBlob = await compressImageToSquare(file, 400);
      } catch (compressionErr) {
        console.error('Image compression failed:', compressionErr);
        throw new Error('Could not compress image. Please try a different photo.');
      }

      // Generate local data URL for instant optimistic display
      const localDataUrl = await blobToDataUrl(compressedBlob);
      setPreviewUrl(localDataUrl);

      // 5. Obtain a fresh Firebase ID token
      let idToken: string;
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.error('Failed to obtain Firebase ID token:', tokenErr);
        throw new Error('Could not authenticate upload request. Please sign in again.');
      }

      // 6. Send selected image to Supabase Edge Function via multipart/form-data
      const formData = new FormData();
      formData.append('file', compressedBlob, `avatar_${Date.now()}.jpg`);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${idToken}`,
      };
      if (supabasePublishableKey) {
        headers['apikey'] = supabasePublishableKey;
      }

      const response = await fetch(UPLOAD_AVATAR_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result?.publicUrl) {
        const errorMsg =
          result?.error ||
          result?.message ||
          (response.status === 401
            ? 'Authentication failed: Invalid or expired Firebase ID token.'
            : `Avatar upload failed (${response.status})`);
        console.warn('Supabase Edge Function upload notice:', errorMsg);
        throw new Error(errorMsg);
      }

      const avatarPublicUrl = result.publicUrl;

      // 7. Update Firestore user document with the Supabase avatar URL
      try {
        const userDocRef = doc(db, 'users', targetUid);
        await setDoc(userDocRef, { avatarUrl: avatarPublicUrl }, { merge: true });
      } catch (firestoreErr: any) {
        console.error('Firestore avatarUrl update error after successful Edge Function upload:', firestoreErr);
        throw new Error('Avatar photo uploaded, but failed to update your profile. Please try again.');
      }

      // Clear local temporary preview to seamlessly transition to the persisted public URL
      setPreviewUrl(null);

      if (onUploadSuccess) {
        onUploadSuccess(avatarPublicUrl);
      }
    } catch (err: any) {
      console.warn('Avatar upload notice:', err?.message || err);
      // Revert optimistic preview so previous avatar is preserved
      setPreviewUrl(null);
      setError(err?.message || 'Avatar upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerPicker = () => {
    if (!uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div id="avatar-upload-component" className="flex flex-col items-center">
      <div className="relative group">
        {/* Avatar Circular Element */}
        <button
          id="btn-avatar-picker-trigger"
          type="button"
          onClick={triggerPicker}
          disabled={uploading}
          aria-label="Change profile photo"
          className={`relative rounded-full overflow-hidden flex items-center justify-center border-2 border-neutral-200 bg-neutral-900 text-white font-bold select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 transition-all ${sizeClasses}`}
        >
          {displayAvatarUrl && !imageLoadError ? (
            <img
              id="user-avatar-image"
              src={displayAvatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onLoad={(event) => {
                console.log("SANKALPA AVATAR LOAD SUCCESS", {
                  src: event.currentTarget.src,
                  naturalWidth: event.currentTarget.naturalWidth,
                  naturalHeight: event.currentTarget.naturalHeight,
                });
              }}
              onError={(event) => {
                console.error("SANKALPA AVATAR LOAD FAILED", {
                  src: event.currentTarget.src,
                  naturalWidth: event.currentTarget.naturalWidth,
                  naturalHeight: event.currentTarget.naturalHeight,
                });
                setImageLoadError(true);
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <span id="user-avatar-initials" className="tracking-wide font-serif">
              {initial}
            </span>
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
            <svg className="w-5 h-5 drop-shadow-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* Uploading Spinner Overlay */}
          {uploading && (
            <div
              id="avatar-upload-spinner"
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10"
            >
              <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            </div>
          )}
        </button>

        {/* Small Camera Badge */}
        <button
          id="btn-avatar-badge"
          type="button"
          onClick={triggerPicker}
          disabled={uploading}
          aria-label="Upload new photo"
          className="absolute bottom-0 right-0 p-1.5 bg-neutral-900 text-white rounded-full border-2 border-white shadow-xs hover:bg-neutral-800 active:bg-black transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id="input-avatar-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        id="btn-upload-photo-text"
        type="button"
        onClick={triggerPicker}
        disabled={uploading}
        className="mt-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900 underline underline-offset-2 transition-colors cursor-pointer disabled:opacity-50"
      >
        {uploading ? 'Compressing & uploading...' : 'Change profile photo'}
      </button>

      {/* Error Message */}
      {error && (
        <div
          id="avatar-upload-error"
          className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 text-left max-w-[320px] space-y-1 shadow-2xs"
        >
          <div className="font-semibold text-red-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Upload Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed text-red-700">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
