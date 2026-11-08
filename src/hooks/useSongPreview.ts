'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SongAttachment } from '@/types';
import {
  releasePreviewPlayback,
  requestPreviewPlayback,
} from '@/lib/audioPreviewBus';

const MAX_PREVIEW_SECONDS = 15;
const FADE_IN_MS = 500;
const FADE_OUT_MS = 500;
const FADE_OUT_START = 14.5;
const PAUSE_FADE_MS = 220;

function fadeVolume(
  audio: HTMLAudioElement,
  target: number,
  duration: number,
  onDone?: () => void,
): () => void {
  const from = audio.volume;
  const start = performance.now();
  const delta = target - from;
  let frame = 0;
  let cancelled = false;

  const step = (now: number) => {
    if (cancelled) return;
    const progress = Math.min(1, (now - start) / Math.max(1, duration));
    audio.volume = Math.max(0, Math.min(1, from + delta * progress));
    if (progress < 1) {
      frame = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };

  frame = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

async function requestPreviewRefresh(song: SongAttachment | null | undefined): Promise<string | null> {
  if (!song) return null;
  if (song.previewAudioUrl) return song.previewAudioUrl;
  if (!song.provider || !song.providerTrackId) return null;

  try {
    const response = await fetch(
      `/api/music/preview?provider=${encodeURIComponent(song.provider)}&id=${encodeURIComponent(
        song.providerTrackId,
      )}`,
      { cache: 'no-store' },
    );
    const json = await response.json();
    const value = json?.data?.previewAudioUrl;
    return typeof value === 'string' && value.startsWith('https://') ? value : null;
  } catch {
    return null;
  }
}

export interface SongPreviewState {
  isPlaying: boolean;
  isLoading: boolean;
  isAudioAvailable: boolean;
  hasFailed: boolean;
  progress: number;
  toggle: () => Promise<void>;
  stop: () => void;
}

export function useSongPreview(song?: SongAttachment | null): SongPreviewState {
  const ownerIdRef = useRef(`song_preview_${Math.random().toString(36).slice(2)}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fadeCancelRef = useRef<(() => void) | null>(null);
  const resolvedUrlRef = useRef<string | null>(song?.previewAudioUrl ?? null);
  const retryRef = useRef(false);
  const mountedRef = useRef(true);
  const fadingOutRef = useRef(false);
  const lastProgressRef = useRef(0);
  const songRef = useRef<SongAttachment | null | undefined>(song);
  const hardStopRef = useRef<(reset: boolean) => void>(() => {});
  const handleFailureRef = useRef<() => Promise<void>>(async () => {});

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioAvailable, setIsAudioAvailable] = useState(
    Boolean(song?.previewAudioUrl),
  );
  const [hasFailed, setHasFailed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    songRef.current = song;
  }, [song]);

  const hardStop = useCallback((reset: boolean) => {
    const audio = audioRef.current;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    fadeCancelRef.current?.();
    fadeCancelRef.current = null;

    if (audio) {
      audio.pause();
      audio.volume = 0;
      if (reset) {
        try {
          audio.currentTime = 0;
        } catch {
          // The media may not be seekable yet.
        }
      }
    }

    fadingOutRef.current = false;
    lastProgressRef.current = 0;
    if (mountedRef.current) {
      setIsPlaying(false);
      setProgress(reset ? 0 : audio ? Math.min(1, audio.currentTime / MAX_PREVIEW_SECONDS) : 0);
    }
    releasePreviewPlayback(ownerIdRef.current);
  }, []);

  const startProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const tick = () => {
      const current = audioRef.current;
      if (!current || current.paused) return;
      const time = current.currentTime;

      if (time >= MAX_PREVIEW_SECONDS) {
        hardStop(true);
        return;
      }

      if (time >= FADE_OUT_START && !fadingOutRef.current) {
        fadingOutRef.current = true;
        fadeCancelRef.current?.();
        fadeCancelRef.current = fadeVolume(current, 0, FADE_OUT_MS);
      }

      if (Math.abs(time - lastProgressRef.current) >= 0.08) {
        lastProgressRef.current = time;
        setProgress(Math.min(1, time / MAX_PREVIEW_SECONDS));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [hardStop]);

  const handleFailure = useCallback(async () => {
    if (retryRef.current) {
      setIsAudioAvailable(false);
      setHasFailed(true);
      hardStop(true);
      return;
    }
    retryRef.current = true;

    const refreshed = await requestPreviewRefresh(songRef.current);
    if (!mountedRef.current) return;

    if (!refreshed) {
      setIsAudioAvailable(false);
      setHasFailed(true);
      hardStop(true);
      return;
    }

    resolvedUrlRef.current = refreshed;
    setIsAudioAvailable(true);
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = refreshed;
    audio.load();
    try {
      audio.volume = 0;
      await audio.play();
      if (!mountedRef.current) return;
      setIsPlaying(true);
      setHasFailed(false);
      fadeCancelRef.current?.();
      fadeCancelRef.current = fadeVolume(audio, 1, FADE_IN_MS);
      startProgress();
      requestPreviewPlayback(ownerIdRef.current, () => hardStop(false));
    } catch {
      setIsAudioAvailable(false);
      setIsPlaying(false);
      setHasFailed(true);
    }
  }, [hardStop, startProgress]);

  useEffect(() => {
    hardStopRef.current = hardStop;
    handleFailureRef.current = handleFailure;
  }, [hardStop, handleFailure]);

  useEffect(() => {
    mountedRef.current = true;
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 0;
    audioRef.current = audio;
    audio.onended = () => hardStopRef.current(true);
    audio.onerror = () => {
      void handleFailureRef.current();
    };

    return () => {
      mountedRef.current = false;
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      fadeCancelRef.current?.();
      fadeCancelRef.current = null;
      releasePreviewPlayback(ownerIdRef.current);
    };
  }, []);

  useEffect(() => {
    hardStop(true);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    resolvedUrlRef.current = song?.previewAudioUrl ?? null;
    retryRef.current = false;
    setIsAudioAvailable(Boolean(song?.previewAudioUrl));
    setHasFailed(false);
    setIsPlaying(false);
    setProgress(0);
  }, [song?.id, song?.previewAudioUrl, hardStop]);

  const ensureSource = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src || audio.src !== url || resolvedUrlRef.current !== url) {
      resolvedUrlRef.current = url;
      audio.src = url;
      audio.load();
    }
  }, []);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      fadeCancelRef.current?.();
      fadeCancelRef.current = fadeVolume(audio, 0, PAUSE_FADE_MS, () => {
        audio.pause();
        if (mountedRef.current) setIsPlaying(false);
      });
      releasePreviewPlayback(ownerIdRef.current);
      return;
    }

    const currentSong = songRef.current;
    if (!currentSong) return;

    let url = resolvedUrlRef.current || currentSong.previewAudioUrl;
    if (!url) {
      setIsLoading(true);
      url = await requestPreviewRefresh(currentSong);
      setIsLoading(false);
      if (!mountedRef.current) return;
      if (!url) {
        setIsAudioAvailable(false);
        setHasFailed(true);
        return;
      }
      resolvedUrlRef.current = url;
      setIsAudioAvailable(true);
      setHasFailed(false);
    }

    ensureSource(url);
    requestPreviewPlayback(ownerIdRef.current, () => hardStop(false));

    if (audio.currentTime >= MAX_PREVIEW_SECONDS - 0.05) {
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore seek errors.
      }
    }

    audio.volume = 0;
    fadingOutRef.current = false;
    try {
      await audio.play();
      if (!mountedRef.current) return;
      setIsPlaying(true);
      fadeCancelRef.current?.();
      fadeCancelRef.current = fadeVolume(audio, 1, FADE_IN_MS);
      startProgress();
    } catch (error) {
      if (!mountedRef.current) return;
      setIsPlaying(false);
      if ((error as DOMException)?.name !== 'NotAllowedError') {
        setIsAudioAvailable(false);
      }
    }
  }, [ensureSource, hardStop, isPlaying, startProgress]);

  const stop = useCallback(() => {
    hardStop(true);
  }, [hardStop]);

  return {
    isPlaying,
    isLoading,
    isAudioAvailable,
    hasFailed,
    progress,
    toggle,
    stop,
  };
}
