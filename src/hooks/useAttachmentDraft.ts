'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaAttachment, MusicTrack, SongAttachment } from '@/types';
import { preparePhoto } from '@/lib/imageProcessing';
import { prepareVideo } from '@/lib/videoProcessing';
import { buildMediaStorageKey } from '@/lib/manifestationAttachments';
import { stopActivePreview } from '@/lib/audioPreviewBus';

export interface DraftMedia {
  attachment: MediaAttachment;
  blob: Blob;
  previewUrl: string;
}

export interface AttachmentDraftState {
  song: SongAttachment | null;
  media: DraftMedia | null;
  isProcessing: boolean;
  error: string | null;
  attachPhoto: (file: File) => Promise<void>;
  attachVideo: (file: File) => Promise<void>;
  selectSong: (track: MusicTrack) => void;
  removeSong: () => void;
  removeMedia: () => void;
  reset: () => void;
  clearError: () => void;
  buildMediaAttachment: (manifestationId: string) => MediaAttachment | null;
}

export function useAttachmentDraft(): AttachmentDraftState {
  const [song, setSong] = useState<SongAttachment | null>(null);
  const [media, setMedia] = useState<DraftMedia | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const removeMedia = useCallback(() => {
    revokePreview();
    setMedia(null);
  }, [revokePreview]);

  const removeSong = useCallback(() => {
    stopActivePreview();
    setSong(null);
  }, []);

  const reset = useCallback(() => {
    stopActivePreview();
    revokePreview();
    setSong(null);
    setMedia(null);
    setError(null);
    setIsProcessing(false);
  }, [revokePreview]);

  useEffect(() => {
    return () => {
      revokePreview();
    };
  }, [revokePreview]);

  const attachPhoto = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      try {
        const prepared = await preparePhoto(file);
        revokePreview();
        const previewUrl = URL.createObjectURL(prepared.blob);
        previewUrlRef.current = previewUrl;
        setMedia({
          attachment: {
            kind: 'photo',
            thumbDataUrl: prepared.thumbDataUrl,
            mimeType: prepared.mimeType,
            width: prepared.width,
            height: prepared.height,
            byteSize: prepared.byteSize,
            storageKey: 'draft',
          },
          blob: prepared.blob,
          previewUrl,
        });
      } catch (photoError) {
        setError(
          photoError instanceof Error
            ? photoError.message
            : 'No pudimos procesar la foto. Probá con otra imagen.',
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [revokePreview],
  );

  const attachVideo = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      try {
        const prepared = await prepareVideo(file);
        revokePreview();
        const previewUrl = URL.createObjectURL(prepared.blob);
        previewUrlRef.current = previewUrl;
        setMedia({
          attachment: {
            kind: 'video',
            thumbDataUrl: prepared.thumbDataUrl,
            mimeType: prepared.mimeType,
            width: prepared.width,
            height: prepared.height,
            durationSeconds: prepared.durationSeconds,
            byteSize: prepared.byteSize,
            storageKey: 'draft',
          },
          blob: prepared.blob,
          previewUrl,
        });
      } catch (videoError) {
        setError(
          videoError instanceof Error
            ? videoError.message
            : 'No pudimos procesar el video. Probá con un MP4 corto.',
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [revokePreview],
  );

  const selectSong = useCallback((track: MusicTrack) => {
    stopActivePreview();
    setSong({
      id: track.id,
      title: track.title,
      artist: track.artist,
      albumCoverUrl: track.albumCoverUrl,
      spotifyUrl: track.spotifyUrl,
      previewAudioUrl: track.previewAudioUrl,
      provider: track.provider,
      providerTrackId: track.providerTrackId,
      previewFetchedAt: new Date().toISOString(),
    });
    setError(null);
  }, []);

  const buildMediaAttachment = useCallback(
    (manifestationId: string): MediaAttachment | null => {
      if (!media) return null;
      return {
        ...media.attachment,
        storageKey: buildMediaStorageKey(manifestationId),
      };
    },
    [media],
  );

  return {
    song,
    media,
    isProcessing,
    error,
    attachPhoto,
    attachVideo,
    selectSong,
    removeSong,
    removeMedia,
    reset,
    clearError: () => setError(null),
    buildMediaAttachment,
  };
}
