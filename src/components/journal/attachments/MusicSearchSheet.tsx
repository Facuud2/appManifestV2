'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Music2, Play, Search, X } from 'lucide-react';
import type { MusicTrack } from '@/types';
import { EMIL_EASE_OUT, EMIL_SHEET_SPRING } from '@/lib/iosSprings';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { SpotifyGlyph } from './SpotifyMiniPlayer';

export interface MusicSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack) => void;
}

const SPOTIFY_URL_PATTERN =
  /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)[A-Za-z0-9]{22}/i;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639.98px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isMobile;
}

function ResultSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-swiss-control" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-swiss-control" />
        <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-swiss-control" />
      </div>
    </div>
  );
}

export function MusicSearchSheet({ isOpen, onClose, onSelect }: MusicSearchSheetProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isOpen && isMobile);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const titleId = 'music-search-title';
  const descriptionId = 'music-search-description';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setTracks([]);
    setWarning(null);
    setError(null);
    setHasSearched(false);
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setTracks([]);
      setWarning(null);
      setError(null);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    const isSpotifyUrl = SPOTIFY_URL_PATTERN.test(trimmed);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const param = isSpotifyUrl
          ? `url=${encodeURIComponent(trimmed)}`
          : `q=${encodeURIComponent(trimmed)}`;
        const response = await fetch(`/api/music/search?${param}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || 'No pudimos buscar canciones.');
        }
        if (controller.signal.aborted) return;
        setTracks(Array.isArray(json?.data?.tracks) ? json.data.tracks : []);
        setWarning(typeof json?.data?.warning === 'string' ? json.data.warning : null);
        setHasSearched(true);
      } catch (fetchError) {
        if ((fetchError as Error)?.name === 'AbortError') return;
        setTracks([]);
        setWarning(null);
        setError('No pudimos buscar canciones ahora. Probá de nuevo en un momento.');
        setHasSearched(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, isSpotifyUrl ? 250 : 380);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : isMobile
      ? EMIL_SHEET_SPRING
      : { duration: 0.24, ease: EMIL_EASE_OUT };

  const panelInitial = prefersReducedMotion
    ? { opacity: 0 }
    : isMobile
      ? { y: '100%' }
      : { opacity: 0, y: 12, scale: 0.98 };

  const panelAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : isMobile
      ? { y: 0 }
      : { opacity: 1, y: 0, scale: 1 };

  const panelExit = prefersReducedMotion
    ? { opacity: 0 }
    : isMobile
      ? { y: '100%' }
      : { opacity: 0, y: 8, scale: 0.98 };

  const sheet = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="music-search"
          data-quick-add-portal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
          className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6"
          style={{ paddingBottom: keyboardInset }}
        >
          <button
            type="button"
            aria-label="Cerrar buscador de canciones"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
            className="relative flex max-h-[min(86dvh,38rem)] w-full flex-col overflow-hidden rounded-t-[28px] border border-swiss-border bg-swiss-elevated shadow-modal sm:max-w-lg sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-swiss-ink">
                  Elegí una canción
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-xs leading-5 text-swiss-inkMuted"
                >
                  Buscá por nombre o pegá un link de Spotify. La demo dura 15 segundos.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar buscador de canciones"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-swiss-control text-swiss-inkMuted transition-colors hover:text-swiss-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="px-5 pb-3 sm:px-6">
              <div className="relative">
                <Search
                  size={17}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-swiss-inkLight"
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sweater Weather, Babasónicos, link de Spotify…"
                  enterKeyHint="search"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar canción o pegar link de Spotify"
                  className="h-12 w-full rounded-2xl border border-swiss-border bg-swiss-card pl-10 pr-10 text-base text-swiss-ink outline-none transition-shadow placeholder:text-swiss-inkLight focus:border-swiss-accentBorder focus:ring-2 focus:ring-swiss-focus"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-swiss-inkMuted hover:bg-swiss-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
              {isLoading ? (
                <div className="space-y-1" aria-hidden="true">
                  <ResultSkeleton />
                  <ResultSkeleton />
                  <ResultSkeleton />
                  <ResultSkeleton />
                </div>
              ) : null}

              {!isLoading && tracks.length > 0 ? (
                <ul className="space-y-1">
                  {tracks.map((track) => (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(track);
                          onClose();
                        }}
                        className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-swiss-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
                        aria-label={`Elegir ${track.title} de ${track.artist}`}
                      >
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#121212]">
                          {track.albumCoverUrl ? (
                            <img
                              src={track.albumCoverUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music2 size={17} className="text-[#1DB954]" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-swiss-ink">
                            {track.title}
                          </span>
                          <span className="block truncate text-xs text-swiss-inkMuted">
                            {track.artist}
                            {track.album ? ` · ${track.album}` : ''}
                          </span>
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                            track.previewAudioUrl
                              ? 'bg-[#1DB954]/15 text-[#0d6d2e] dark:text-[#4ade80]'
                              : 'bg-swiss-control text-swiss-inkMuted'
                          }`}
                        >
                          {track.previewAudioUrl ? (
                            <>
                              <Play size={9} fill="currentColor" aria-hidden="true" />
                              15 s
                            </>
                          ) : (
                            <>
                              <Music2 size={9} aria-hidden="true" />
                              Visual
                            </>
                          )}
                        </span>
                        {track.spotifyUrl.includes('open.spotify.com/track/') ? (
                          <SpotifyGlyph size={14} className="shrink-0 text-[#1DB954]" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!isLoading && hasSearched && tracks.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-9 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-swiss-control text-swiss-inkMuted">
                    <Music2 size={20} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-swiss-ink">
                    No encontramos esa canción
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-swiss-inkMuted">
                    Probá con el nombre y el artista, o pegá el link directo de Spotify.
                  </p>
                </div>
              ) : null}

              {!isLoading && !hasSearched && query.trim().length < 2 ? (
                <div className="flex flex-col items-center px-5 py-9 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-swiss-control text-swiss-inkMuted">
                    <Search size={20} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-swiss-ink">
                    Buscá el ambiente de tu escena
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-swiss-inkMuted">
                    Escribí al menos dos letras o pegá un link de Spotify.
                  </p>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="px-3 py-2 text-xs leading-5 text-swiss-red">
                  {error}
                </p>
              ) : null}

              {warning && !error ? (
                <p role="status" className="px-3 py-2 text-xs leading-5 text-swiss-inkMuted">
                  {warning}
                </p>
              ) : null}
            </div>

            <div className="border-t border-swiss-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <p className="text-[11px] leading-4 text-swiss-inkLight">
                Si una canción no tiene demo, se guarda igual como acompañamiento visual.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(sheet, document.body);
}
