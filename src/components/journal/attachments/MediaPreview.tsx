'use client';

import React from 'react';
import { Maximize2, Play } from 'lucide-react';
import type { MediaAttachment } from '@/types';

export interface MediaPreviewProps {
  media: MediaAttachment;
  onOpen: () => void;
  className?: string;
}

export function MediaPreview({ media, onOpen, className = '' }: MediaPreviewProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={media.kind === 'photo' ? 'Ver foto adjunta' : 'Ver video adjunto'}
      className={`group relative mt-3 block w-full overflow-hidden rounded-2xl border border-swiss-border bg-swiss-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus ${className}`}
    >
      <span className="block aspect-[16/10] w-full">
        <img
          src={media.thumbDataUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
        />
      </span>

      {media.kind === 'video' ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur-md ring-1 ring-white/25 transition-transform duration-200 group-hover:scale-105">
          <Play size={20} fill="currentColor" className="translate-x-[1px]" aria-hidden="true" />
        </span>
      ) : null}

      <span className="pointer-events-none absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md border border-white/10">
        <Maximize2 size={10} aria-hidden="true" />
        {media.kind === 'photo' ? 'Ver foto' : 'Ver video'}
      </span>
    </button>
  );
}
