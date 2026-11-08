import type { MediaAttachment, SongAttachment } from '@/types';

export const MANIFESTATION_MEDIA_PREFIX = 'media_';

export function createManifestationId(): string {
  return `manif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildMediaStorageKey(manifestationId: string): string {
  return `${MANIFESTATION_MEDIA_PREFIX}${manifestationId}`;
}

export function isSongAttachment(value: unknown): value is SongAttachment {
  if (!value || typeof value !== 'object') return false;
  const song = value as Partial<SongAttachment>;
  return (
    typeof song.id === 'string' &&
    typeof song.title === 'string' &&
    typeof song.artist === 'string' &&
    typeof song.albumCoverUrl === 'string' &&
    typeof song.spotifyUrl === 'string' &&
    (typeof song.previewAudioUrl === 'string' || song.previewAudioUrl === null)
  );
}

export function isMediaAttachment(value: unknown): value is MediaAttachment {
  if (!value || typeof value !== 'object') return false;
  const media = value as Partial<MediaAttachment>;
  return (
    (media.kind === 'photo' || media.kind === 'video') &&
    typeof media.thumbDataUrl === 'string' &&
    media.thumbDataUrl.startsWith('data:image/') &&
    typeof media.mimeType === 'string' &&
    typeof media.storageKey === 'string' &&
    typeof media.byteSize === 'number'
  );
}

export function parseAttachmentJson<T>(
  raw: unknown,
  guard: (value: unknown) => value is T,
): T | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeAttachment(value: unknown): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
