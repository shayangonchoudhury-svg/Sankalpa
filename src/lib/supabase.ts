import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';

const supabaseKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  '';

/**
 * Normalizes the Supabase URL by trimming any subpath (e.g. /rest/v1/ or /) that users may have copied from the dashboard
 */
function normalizeSupabaseUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/auth\/v1\/?$/, '')
    .replace(/\/storage\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'your-supabase-url' &&
  supabaseUrl.startsWith('http')
);

// Fallback dummy client if credentials are not configured yet, to prevent app crash at module load time
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const AVATARS_BUCKET = 'avatars';

export const supabasePublishableKey = supabaseKey;

export const UPLOAD_AVATAR_FUNCTION_URL = supabaseUrl
  ? `${supabaseUrl}/functions/v1/upload-avatar`
  : 'https://qbuqyagfrygyjwbpzdvy.supabase.co/functions/v1/upload-avatar';

/**
 * Retrieves the public URL for an avatar object in the public Supabase Storage avatars bucket.
 * For MVP, profile avatars are treated as non-sensitive media and served directly via public CDN URL.
 */
export function getPublicAvatarUrl(objectPath?: string | null): string | null {
  if (!objectPath) return null;

  // If already a full URL or data URI, return as-is
  if (
    objectPath.startsWith('http://') ||
    objectPath.startsWith('https://') ||
    objectPath.startsWith('data:')
  ) {
    return objectPath;
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const { data } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(objectPath);

    return data?.publicUrl || null;
  } catch (err: any) {
    console.warn('Error obtaining public avatar URL from Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Generates a signed URL for a private Supabase Storage object.
 * Returns null if the path is invalid or if signed URL generation fails.
 */
export async function getSignedAvatarUrl(objectPath: string, expiresIn = 3600): Promise<string | null> {
  if (!objectPath) return null;

  // If already a full URL or data URI, return as-is
  if (
    objectPath.startsWith('http://') ||
    objectPath.startsWith('https://') ||
    objectPath.startsWith('data:')
  ) {
    return objectPath;
  }

  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Cannot generate signed URL for path:', objectPath);
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(objectPath, expiresIn);

    if (error) {
      console.warn('Supabase createSignedUrl notice:', error.message);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err: any) {
    console.warn('Error obtaining signed avatar URL from Supabase:', err?.message || err);
    return null;
  }
}
