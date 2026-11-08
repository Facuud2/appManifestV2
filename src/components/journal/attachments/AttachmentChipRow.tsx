'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { MediaAttachment, SongAttachment } from '@/types';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';
import { SmoothSizeContainer } from '@/components/ui/SmoothSizeContainer';
import { SpotifySongChip } from './SpotifyMiniPlayer';
import { MediaChip } from './MediaChip';

export interface AttachmentChipRowProps {
  song?: SongAttachment | null;
  media?: {
    attachment: MediaAttachment;
    previewUrl?: string | null;
  } | null;
  onRemoveSong: () => void;
  onRemoveMedia: () => void;
}

export function AttachmentChipRow({
  song,
  media,
  onRemoveSong,
  onRemoveMedia,
}: AttachmentChipRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasAny = Boolean(song || media);

  return (
    <SmoothSizeContainer className="w-full">
      <div
        className={`flex items-center gap-2.5 overflow-x-auto no-scrollbar ${
          hasAny ? 'pt-0.5 pb-1' : ''
        }`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {song ? (
            <motion.div
              key={`song-chip-${song.id}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, x: -6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: -4 }}
              transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
              className="shrink-0"
            >
              <SpotifySongChip key={song.id} song={song} onRemove={onRemoveSong} />
            </motion.div>
          ) : null}

          {media ? (
            <motion.div
              key={`media-chip-${media.attachment.storageKey || media.attachment.kind}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, x: -6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: -4 }}
              transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
              className="shrink-0"
            >
              <MediaChip
                media={media.attachment}
                previewUrl={media.previewUrl}
                onRemove={onRemoveMedia}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </SmoothSizeContainer>
  );
}
