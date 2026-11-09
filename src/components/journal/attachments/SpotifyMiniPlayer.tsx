'use client';

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ExternalLink, Loader2, Pause, Play, X } from 'lucide-react';
import type { SongAttachment } from '@/types';
import { useSongPreview } from '@/hooks/useSongPreview';
import { isSafeHttpUrl } from '@/lib/manifestationAttachments';

type TileSize = 'chip' | 'card' | 'large';

interface SpotifyTileProps {
  song: SongAttachment;
  size: TileSize;
  isPlaying: boolean;
  isLoading: boolean;
  isAudioAvailable: boolean;
  progress: number;
  prefersReducedMotion: boolean;
}

const tileSizeClass: Record<TileSize, string> = {
  chip: 'h-9 w-9 rounded-[10px]',
  card: 'h-[5.5rem] w-[5.5rem] rounded-2xl',
  large: 'h-32 w-32 rounded-[1.75rem]',
};

const buttonSizeClass: Record<TileSize, string> = {
  chip: 'h-5 w-5',
  card: 'h-8 w-8',
  large: 'h-11 w-11',
};

const iconSize: Record<TileSize, number> = {
  chip: 10,
  card: 16,
  large: 20,
};

const eqBarClass: Record<TileSize, string> = {
  chip: 'w-[2px]',
  card: 'w-[3px]',
  large: 'w-1',
};

function SpotifyGlyph({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.503 17.309a.747.747 0 0 1-1.028.247c-2.814-1.719-6.356-2.108-10.529-1.155a.747.747 0 1 1-.333-1.458c4.566-1.043 8.483-.602 11.642 1.338a.747.747 0 0 1 .248 1.028Zm1.469-3.267a.934.934 0 0 1-1.285.309c-3.22-1.979-8.13-2.552-11.94-1.396a.934.934 0 1 1-.542-1.787c4.352-1.321 9.767-.681 13.458 1.588a.934.934 0 0 1 .309 1.286Zm.126-3.402C15.24 8.348 8.895 8.135 5.217 9.251a1.121 1.121 0 1 1-.65-2.146c4.221-1.281 11.23-1.033 15.657 1.596a1.121 1.121 0 0 1-1.146 1.939Z" />
    </svg>
  );
}

function SpotifyTile({
  song,
  size,
  isPlaying,
  isLoading,
  isAudioAvailable,
  progress,
  prefersReducedMotion,
}: SpotifyTileProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [song.albumCoverUrl]);

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[#121212] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7)] ring-1 ring-black/20 ${tileSizeClass[size]}`}
      aria-hidden="true"
    >
      {song.albumCoverUrl && !coverFailed ? (
        <img
          src={song.albumCoverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <span className="absolute inset-0 bg-[#181818]" />
      )}

      <span className="absolute inset-0 bg-black/35" />

      <span className="absolute left-1 top-1 flex items-end gap-[2px]">
        {[0, 1, 2].map((bar) => (
          <span
            key={bar}
            className={`${eqBarClass[size]} rounded-full bg-[#1DB954] ${
              isPlaying && !prefersReducedMotion ? 'spotify-eq-bar' : ''
            }`}
            style={{
              height: size === 'chip' ? 5 + bar * 2 : size === 'card' ? 8 + bar * 3 : 11 + bar * 4,
              animationDelay: `${bar * 120}ms`,
              opacity: isPlaying ? 1 : 0.45,
            }}
          />
        ))}
      </span>

      {!coverFailed && song.albumCoverUrl ? (
        <span className="absolute bottom-1 right-1 opacity-90">
          <SpotifyGlyph size={size === 'chip' ? 9 : size === 'card' ? 13 : 16} className="text-[#1DB954]" />
        </span>
      ) : null}

      <span
        className={`absolute flex items-center justify-center rounded-full bg-[#1DB954] text-[#04140a] shadow-[0_3px_10px_rgba(0,0,0,0.45)] ${buttonSizeClass[size]} ${
          isAudioAvailable ? '' : 'opacity-90'
        }`}
      >
        {isLoading ? (
          <Loader2 size={iconSize[size]} className="animate-spin" />
        ) : !isAudioAvailable ? (
          <ExternalLink size={iconSize[size]} />
        ) : isPlaying ? (
          <Pause size={iconSize[size]} fill="currentColor" />
        ) : (
          <Play size={iconSize[size]} fill="currentColor" className="translate-x-[1px]" />
        )}
      </span>

      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
        <span
          className="block h-full origin-left bg-[#1DB954] transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }}
        />
      </span>
    </span>
  );
}

function statusLabel(isPlaying: boolean, isAudioAvailable: boolean, isLoading: boolean) {
  if (isLoading) return 'Buscando demo…';
  if (isPlaying) return 'Sonando 15 s';
  if (isAudioAvailable) return 'Demo de 15 s';
  return 'Acompañamiento visual';
}

export interface SpotifySongChipProps {
  song: SongAttachment;
  onRemove: () => void;
}

export function SpotifySongChip({ song, onRemove }: SpotifySongChipProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const { isPlaying, isLoading, isAudioAvailable, hasFailed, progress, toggle } =
    useSongPreview(song);
  const canPlay = isAudioAvailable && !hasFailed;

  const activate = () => {
    if (isLoading) return;
    if (hasFailed || (!song.previewAudioUrl && !song.providerTrackId)) {
      if (song.spotifyUrl && isSafeHttpUrl(song.spotifyUrl)) {
        window.open(song.spotifyUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    void toggle();
  };

  return (
    <div className="flex h-12 max-w-[220px] shrink-0 items-center gap-2.5 rounded-2xl border border-swiss-border bg-swiss-card/90 px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
      <button
        type="button"
        onClick={activate}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
        aria-label={
          canPlay
            ? `${isPlaying ? 'Pausar' : 'Reproducir'} demo de 15 segundos de ${song.title}`
            : `Abrir ${song.title} en Spotify`
        }
        title={canPlay ? 'Reproducir demo de 15 s' : 'Abrir en Spotify'}
      >
        <SpotifyTile
          song={song}
          size="chip"
          isPlaying={isPlaying}
          isLoading={isLoading}
          isAudioAvailable={isAudioAvailable}
          progress={progress}
          prefersReducedMotion={prefersReducedMotion}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-swiss-ink">
            {song.title}
          </span>
          <span className="block truncate text-[10px] leading-4 text-swiss-inkMuted">
            {song.artist || 'Spotify'} · {statusLabel(isPlaying, isAudioAvailable, isLoading)}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${song.title}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-swiss-inkMuted transition-colors hover:bg-swiss-control hover:text-swiss-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
      >
        <X size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

export interface SpotifyMiniPlayerProps {
  song: SongAttachment;
  className?: string;
}

export function SpotifyMiniPlayer({ song, className = '' }: SpotifyMiniPlayerProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const { isPlaying, isLoading, isAudioAvailable, hasFailed, progress, toggle } =
    useSongPreview(song);
  const canPlay = isAudioAvailable && !hasFailed;

  const activate = () => {
    if (isLoading) return;
    if (hasFailed || (!song.previewAudioUrl && !song.providerTrackId)) {
      if (song.spotifyUrl && isSafeHttpUrl(song.spotifyUrl)) {
        window.open(song.spotifyUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    void toggle();
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-swiss-border bg-swiss-card p-2.5 ${className}`}
    >
      <button
        type="button"
        onClick={activate}
        className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
        aria-label={
          canPlay
            ? `${isPlaying ? 'Pausar' : 'Reproducir'} demo de 15 segundos de ${song.title}`
            : `Abrir ${song.title} en Spotify`
        }
      >
        <SpotifyTile
          song={song}
          size="card"
          isPlaying={isPlaying}
          isLoading={isLoading}
          isAudioAvailable={isAudioAvailable}
          progress={progress}
          prefersReducedMotion={prefersReducedMotion}
        />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold leading-snug text-swiss-ink"
          title={song.title}
        >
          {song.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-swiss-inkMuted" title={song.artist}>
          {song.artist || 'Spotify'}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.06em] text-swiss-inkLight">
          {statusLabel(isPlaying, isAudioAvailable, isLoading)}
        </p>

        {isAudioAvailable ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-swiss-control">
            <div
              className="h-full origin-left rounded-full bg-[#1DB954] transition-transform duration-100 ease-linear"
              style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }}
            />
          </div>
        ) : null}

        {isSafeHttpUrl(song.spotifyUrl) ? (
          <a
            href={song.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0d6d2e] transition-colors hover:text-[#094d20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus dark:text-[#1DB954] dark:hover:text-[#4ade80]"
          >
            <SpotifyGlyph size={12} />
            Abrir en Spotify
            <ExternalLink size={10} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function SpotifyLargePlayer({ song }: { song: SongAttachment }) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const { isPlaying, isLoading, isAudioAvailable, hasFailed, progress, toggle } =
    useSongPreview(song);
  const canPlay = isAudioAvailable && !hasFailed;

  const activate = () => {
    if (isLoading) return;
    if (hasFailed || (!song.previewAudioUrl && !song.providerTrackId)) {
      if (song.spotifyUrl && isSafeHttpUrl(song.spotifyUrl)) {
        window.open(song.spotifyUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    void toggle();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <button
        type="button"
        onClick={activate}
        className="rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
        aria-label={
          canPlay
            ? `${isPlaying ? 'Pausar' : 'Reproducir'} demo de 15 segundos de ${song.title}`
            : `Abrir ${song.title} en Spotify`
        }
      >
        <SpotifyTile
          song={song}
          size="large"
          isPlaying={isPlaying}
          isLoading={isLoading}
          isAudioAvailable={isAudioAvailable}
          progress={progress}
          prefersReducedMotion={prefersReducedMotion}
        />
      </button>

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-white">{song.title}</p>
        <p className="mt-0.5 truncate text-sm text-white/65">{song.artist || 'Spotify'}</p>
        <p className="mt-1 text-xs text-white/45">
          {statusLabel(isPlaying, isAudioAvailable, isLoading)}
        </p>
        {isSafeHttpUrl(song.spotifyUrl) ? (
          <a
            href={song.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1DB954] hover:text-[#4ade80]"
          >
            <SpotifyGlyph size={13} />
            Abrir en Spotify
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export { SpotifyGlyph };
