'use client';

import React from 'react';
import { Camera, Video, X } from 'lucide-react';
import type { MediaAttachment } from '@/types';

export interface MediaChipProps {
  media: MediaAttachment;
  previewUrl?: string | null;
  onRemove: () => void;
}

export function MediaChip({ media, previewUrl, onRemove }: MediaChipProps) {
  const source = previewUrl || media.thumbDataUrl;

  return (
    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-2xl border border-swiss-border bg-swiss-control">
      {media.kind === 'photo' ? (
        <img
          src={source}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : previewUrl ? (
        <video
          src={previewUrl}
          poster={media.thumbDataUrl}
          muted
          loop
          playsInline
          autoPlay
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={media.thumbDataUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}

      <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-[2px]">
        {media.kind === 'photo' ? (
          <Camera size={9} aria-hidden="true" />
        ) : (
          <Video size={9} aria-hidden="true" />
        )}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={media.kind === 'photo' ? 'Quitar foto' : 'Quitar video'}
        className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
      >
        <X size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
