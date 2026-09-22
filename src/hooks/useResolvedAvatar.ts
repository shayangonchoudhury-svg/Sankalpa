import { useState, useEffect } from 'react';
import { getPublicAvatarUrl } from '../lib/supabase.ts';

/**
 * Resolves an avatar reference (which may be a Supabase object path like "{uid}/{filename}",
 * an HTTP URL, or a base64 data URI) into a valid image URL for rendering.
 * For MVP, avatars are hosted in the public Supabase Storage bucket and resolved directly via public URL.
 */
export function useResolvedAvatar(avatarRef?: string | null): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    return getPublicAvatarUrl(avatarRef);
  });

  useEffect(() => {
    setResolvedUrl(getPublicAvatarUrl(avatarRef));
  }, [avatarRef]);

  return resolvedUrl;
}
