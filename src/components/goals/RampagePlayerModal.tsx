'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  CloudRain,
  Mic,
  Moon,
  Pause,
  Play,
  Radio,
  Repeat,
  SkipForward,
  Sparkles,
  Sun,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { audioEngine, AmbienceType } from '@/lib/audioEngine';
import { EMIL_EASE_OUT, IOS_TAP_SPRING } from '@/lib/iosSprings';

interface RampagePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  centralTheme?: string;
}

const RAMPAGE_BATCH_SIZE = 3;

export const RampagePlayerModal: React.FC<RampagePlayerModalProps> = ({
  isOpen,
  onClose,
  centralTheme = 'Abundancia, Certeza y Paz',
}) => {
  const {
    activeScope,
    ambientSound,
    setAmbientSound,
    affirmations: userSavedAffirmations,
    isFacuCalibrated,
    isMaiaCalibrated,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isNightMode, setIsNightMode] = useState(true);
  const [affirmationQueue, setAffirmationQueue] = useState<string[]>([]);
  const [currentAffirmationIndex, setCurrentAffirmationIndex] = useState(0);
  const [currentVoiceSpeaker, setCurrentVoiceSpeaker] = useState<'maia' | 'facu'>('facu');
  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [loopCount, setLoopCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [draftTitle, setDraftTitle] = useState(centralTheme);
  const [draftDetails, setDraftDetails] = useState('');
  const [setupError, setSetupError] = useState('');
  const [audioPreparationWarning, setAudioPreparationWarning] = useState('');
  const prefersReducedMotion = useReducedMotion();
  const reactiveHaloEnergy = useMotionValue(0);
  const outerRingScaleTarget = useTransform(reactiveHaloEnergy, (energy) => 1 + energy * 0.35);
  const middleRingScaleTarget = useTransform(reactiveHaloEnergy, (energy) => 1 + energy * 0.18);
  const outerRingScale = useSpring(outerRingScaleTarget, {
    stiffness: 220,
    damping: 25,
  });
  const middleRingScale = useSpring(middleRingScaleTarget, {
    stiffness: 260,
    damping: 28,
  });
  const outerRingTransform = useMotionTemplate`scale(${outerRingScale})`;
  const middleRingTransform = useMotionTemplate`scale(${middleRingScale})`;
  const outerRingOpacity = useSpring(isPlaying ? 0.8 : 0.3, {
    stiffness: 220,
    damping: 25,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const affirmationQueueRef = useRef<string[]>([]);
  const batchLoadingRef = useRef(false);
  const batchLoadPromiseRef = useRef<Promise<void> | null>(null);
  const pendingBatchRequestRef = useRef(false);
  const fetchMoreAffirmationsRef = useRef<
    ((replaceQueue?: boolean, retry?: boolean) => Promise<void>) | null
  >(null);
  const generationFailedRef = useRef(false);
  const batchAbortRef = useRef<AbortController | null>(null);
  const playbackRequestRef = useRef(0);
  const generatedAudioCacheRef = useRef(new Map<string, AudioBuffer>());
  const generatedAudioPromisesRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const audioPreparationControllersRef = useRef(new Set<AbortController>());
  const activeRampageRef = useRef({ title: '', details: '' });
  const nextAffirmationTimerRef = useRef<number | null>(null);

  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const prepareAudio = useCallback((text: string, speaker: 'maia' | 'facu') => {
    const cacheKey = `${speaker}:${text}`;
    const cachedAudio = generatedAudioCacheRef.current.get(cacheKey);
    if (cachedAudio) return Promise.resolve(cachedAudio);

    const pendingAudio = generatedAudioPromisesRef.current.get(cacheKey);
    if (pendingAudio) return pendingAudio;

    const controller = new AbortController();
    audioPreparationControllersRef.current.add(controller);
    const request = (async () => {
      try {
        const response = await fetch('/api/ai/voice-synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ profileId: speaker, text }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || 'No se pudo generar la voz de esta afirmación.');
        }

        const audio = await audioEngine.decodeAudio(await response.arrayBuffer());
        if (generatedAudioCacheRef.current.size >= 64) {
          const oldestKey = generatedAudioCacheRef.current.keys().next().value;
          if (oldestKey) generatedAudioCacheRef.current.delete(oldestKey);
        }
        generatedAudioCacheRef.current.set(cacheKey, audio);
        return audio;
      } finally {
        audioPreparationControllersRef.current.delete(controller);
      }
    })();
    let preparation: Promise<AudioBuffer> | null = null;
    preparation = request.finally(() => {
      if (generatedAudioPromisesRef.current.get(cacheKey) === preparation) {
        generatedAudioPromisesRef.current.delete(cacheKey);
      }
    });
    generatedAudioPromisesRef.current.set(cacheKey, preparation);
    return preparation;
  }, []);

  const getSpeakerForIndex = useCallback(
    (index: number): 'maia' | 'facu' => {
      if (activeScope === 'maia') return 'maia';
      if (activeScope === 'facu') return 'facu';
      if (isMaiaCalibrated && !isFacuCalibrated) return 'maia';
      if (!isMaiaCalibrated) return 'facu';
      return index % 2 === 0 ? 'facu' : 'maia';
    },
    [activeScope, isFacuCalibrated, isMaiaCalibrated]
  );

  const profileAffirmations = userSavedAffirmations
    .filter((affirmation) => activeScope === 'shared' || affirmation.userId === activeScope)
    .slice(0, 20)
    .map((affirmation) => affirmation.text);

  const fetchMoreAffirmations = useCallback(
    async (replaceQueue = false, retry = false) => {
      if (batchLoadPromiseRef.current) {
        if (!replaceQueue) pendingBatchRequestRef.current = true;
        return batchLoadPromiseRef.current;
      }
      if (generationFailedRef.current && !retry) return;
      batchLoadingRef.current = true;
      setIsLoadingNextBatch(true);
      setGenerationError('');
      setAudioPreparationWarning('');
      const controller = new AbortController();
      batchAbortRef.current = controller;

      let batchPromise: Promise<void>;
      batchPromise = (async () => {
        try {
          const response = await fetch('/api/ai/rampage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              centralTheme: activeRampageRef.current.title,
              additionalDetails: activeRampageRef.current.details,
              userScope: activeScope,
              userAffirmations: profileAffirmations,
              batchSize: RAMPAGE_BATCH_SIZE,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.success || !Array.isArray(result.data?.affirmations)) {
            throw new Error(result.error || 'No se pudieron generar afirmaciones para Rampage.');
          }

          const generated: string[] = result.data.affirmations
            .filter((affirmation: unknown): affirmation is string => typeof affirmation === 'string')
            .map((affirmation: string) => affirmation.trim())
            .filter(Boolean);
          if (generated.length !== RAMPAGE_BATCH_SIZE) {
            throw new Error('Gemini no devolvió las tres afirmaciones solicitadas.');
          }

          const existingQueue = replaceQueue ? [] : affirmationQueueRef.current;
          const batchStartIndex = existingQueue.length;
          const nextQueue = [...existingQueue, ...generated];
          affirmationQueueRef.current = nextQueue;
          setAffirmationQueue(nextQueue);
          generationFailedRef.current = false;

          const preparationResults = await Promise.allSettled(
            generated.map((text: string, offset: number) =>
              prepareAudio(text, getSpeakerForIndex(batchStartIndex + offset))
            )
          );
          if (preparationResults.some((preparation) => preparation.status === 'rejected')) {
            setAudioPreparationWarning(
              'No se pudieron anticipar todas las voces; se volverán a preparar al reproducirlas.'
            );
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          generationFailedRef.current = true;
          setGenerationError(
            error instanceof Error ? error.message : 'Error al generar afirmaciones.'
          );
        }
      })();
      batchLoadPromiseRef.current = batchPromise;

      try {
        await batchPromise;
      } finally {
        if (batchLoadPromiseRef.current === batchPromise) {
          const shouldLoadPendingBatch = pendingBatchRequestRef.current;
          pendingBatchRequestRef.current = false;
          batchLoadPromiseRef.current = null;
          batchLoadingRef.current = false;
          batchAbortRef.current = null;
          setIsLoadingNextBatch(false);
          if (
            shouldLoadPendingBatch &&
            isOpen &&
            activeRampageRef.current.title &&
            !generationFailedRef.current
          ) {
            void fetchMoreAffirmationsRef.current?.();
          }
        }
      }
    },
    [activeScope, getSpeakerForIndex, isOpen, prepareAudio, profileAffirmations]
  );
  fetchMoreAffirmationsRef.current = fetchMoreAffirmations;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      playbackRequestRef.current += 1;
      batchAbortRef.current?.abort();
      batchAbortRef.current = null;
      batchLoadingRef.current = false;
      batchLoadPromiseRef.current = null;
      pendingBatchRequestRef.current = false;
      audioPreparationControllersRef.current.forEach((controller) => controller.abort());
      audioPreparationControllersRef.current.clear();
      generatedAudioPromisesRef.current.clear();
      if (nextAffirmationTimerRef.current !== null) {
        window.clearTimeout(nextAffirmationTimerRef.current);
        nextAffirmationTimerRef.current = null;
      }
      isPlayingRef.current = false;
      generatedAudioCacheRef.current.clear();
      affirmationQueueRef.current = [];
      if (audioEngine) {
        audioEngine.stopVoice();
        audioEngine.stopAmbience();
      }
      setIsPlaying(false);
      setIsLoadingNextBatch(false);
      setIsSynthesizing(false);
      setHasStarted(false);
      activeRampageRef.current = { title: '', details: '' };
      return;
    }

    affirmationQueueRef.current = [];
    generatedAudioCacheRef.current.clear();
    generatedAudioPromisesRef.current.clear();
    pendingBatchRequestRef.current = false;
    setAffirmationQueue([]);
    setCurrentAffirmationIndex(0);
    setLoopCount(0);
    setPlaybackError('');
    setGenerationError('');
    setAudioPreparationWarning('');
    setSetupError('');
    setDraftTitle(centralTheme);
    setDraftDetails('');
    activeRampageRef.current = { title: '', details: '' };
    setHasStarted(false);
    generationFailedRef.current = false;
    setCurrentVoiceSpeaker(getSpeakerForIndex(0));
  }, [centralTheme, getSpeakerForIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    const loop = () => {
      if (audioEngine) {
        reactiveHaloEnergy.set(audioEngine.getReactiveEnergy());
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, reactiveHaloEnergy]);

  useEffect(() => {
    if (!isOpen || !isPlaying) {
      if (audioEngine) audioEngine.stopAmbience();
      return;
    }
    if (audioEngine) {
      audioEngine.setAmbience(ambientSound as AmbienceType);
    }
  }, [isOpen, isPlaying, ambientSound]);

  const playCurrentItem = async (index: number) => {
    const queue = affirmationQueueRef.current;
    if (!audioEngine || index >= queue.length || !hasStarted) return;

    const text = queue[index];
    if (!text) return;

    if (index % RAMPAGE_BATCH_SIZE === 1) void fetchMoreAffirmations();

    const speaker = getSpeakerForIndex(index);
    setCurrentVoiceSpeaker(speaker);
    const requestId = ++playbackRequestRef.current;
    setIsSynthesizing(true);
    setPlaybackError('');

    try {
      const audio = await prepareAudio(text, speaker);

      if (!audio) throw new Error('No se pudo preparar el audio.');
      if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;
      setIsSynthesizing(false);
      setAudioPreparationWarning('');
      void audioEngine.playVoice(
        audio,
        () => {
          if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;
          nextAffirmationTimerRef.current = window.setTimeout(() => {
            if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;
            void (async () => {
              let nextIndex = index + 1;
              while (
                nextIndex >= affirmationQueueRef.current.length &&
                batchLoadPromiseRef.current
              ) {
                setIsSynthesizing(true);
                await batchLoadPromiseRef.current;
              }
              if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;

              const latestQueue = affirmationQueueRef.current;
              if (latestQueue.length === 0) return;
              if (nextIndex >= latestQueue.length) nextIndex = 0;
              setCurrentAffirmationIndex(nextIndex);
              setLoopCount((count) => count + 1);
              void playCurrentItem(nextIndex);
            })();
          }, 1200);
        },
        (error: Error) => {
          if (requestId !== playbackRequestRef.current) return;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setIsSynthesizing(false);
          setPlaybackError(error.message);
        }
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== playbackRequestRef.current) return;
      setIsSynthesizing(false);
      setPlaybackError(error instanceof Error ? error.message : 'Error al generar audio.');
      isPlayingRef.current = false;
      setIsPlaying(false);
      audioEngine.stopVoice();
    }
  };

  const togglePlayback = async () => {
    const queue = affirmationQueueRef.current;
    if (!audioEngine || queue.length === 0) return;
    await audioEngine.unlock(); // taste-skill-ignore: Resume the audio context from the user's playback gesture.

    if (isPlaying) {
      isPlayingRef.current = false;
      playbackRequestRef.current += 1;
      if (nextAffirmationTimerRef.current !== null) {
        window.clearTimeout(nextAffirmationTimerRef.current);
        nextAffirmationTimerRef.current = null;
      }
      audioEngine.stopVoice();
      audioEngine.stopAmbience();
      setIsPlaying(false);
      setIsSynthesizing(false);
    } else {
      setPlaybackError('');
      setIsPlaying(true);
      isPlayingRef.current = true;
      void playCurrentItem(currentAffirmationIndex);
    }
  };

  const handleSkipForward = async () => {
    if (!audioEngine || affirmationQueueRef.current.length === 0) return;
    playbackRequestRef.current += 1;
    const requestId = playbackRequestRef.current;
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    audioEngine.stopVoice();
    let nextIndex = currentAffirmationIndex + 1;
    while (
      nextIndex >= affirmationQueueRef.current.length &&
      batchLoadPromiseRef.current
    ) {
      await batchLoadPromiseRef.current;
    }
    if (requestId !== playbackRequestRef.current) return;
    if (nextIndex >= affirmationQueueRef.current.length) nextIndex = 0;
    setCurrentAffirmationIndex(nextIndex);
    if (isPlayingRef.current) {
      void playCurrentItem(nextIndex);
    } else {
      const speaker =
        activeScope === 'maia'
          ? 'maia'
          : activeScope === 'facu'
            ? 'facu'
            : isMaiaCalibrated && !isFacuCalibrated
              ? 'maia'
              : 'facu';
      setCurrentVoiceSpeaker(speaker);
    }
  };

  const handleStartRampage = () => {
    const title = draftTitle.trim();
    if (!title) {
      setSetupError('Escribe un título para crear tu Rampage.');
      return;
    }

    activeRampageRef.current = { title: title.slice(0, 120), details: draftDetails.trim().slice(0, 1000) };
    setSetupError('');
    setHasStarted(true);
    setCurrentAffirmationIndex(0);
    setPlaybackError('');
    setGenerationError('');
    generationFailedRef.current = false;
    void fetchMoreAffirmations(true);
  };

  function handleClose() {
    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    batchLoadingRef.current = false;
    batchLoadPromiseRef.current = null;
    pendingBatchRequestRef.current = false;
    activeRampageRef.current = { title: '', details: '' };
    audioPreparationControllersRef.current.forEach((controller) => controller.abort());
    audioPreparationControllersRef.current.clear();
    generatedAudioPromisesRef.current.clear();
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    if (audioEngine) {
      audioEngine.stopVoice();
      audioEngine.stopAmbience();
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsLoadingNextBatch(false);
    setIsSynthesizing(false);
    setHasStarted(false);
    onClose();
  }

  const currentAffirmation =
    affirmationQueue[currentAffirmationIndex] || 'Alineando frecuencias...';
  const statusLabel = playbackError
    ? 'No se pudo reproducir el audio'
    : isSynthesizing
      ? 'Preparando la voz de este perfil…'
      : isPlaying
        ? 'Sonando ahora'
        : isLoadingNextBatch
          ? affirmationQueue.length === 0
            ? 'Creando afirmaciones con Gemini 3.5 Flash Lite…'
            : 'Preparando el siguiente lote de voces…'
          : generationError && affirmationQueue.length === 0
            ? 'No se pudieron preparar las frases'
            : 'Listo para empezar';
  const waveBars = Array.from({ length: 19 }, (_, index) => index);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
          onClick={handleClose}
          className="rampage-overlay fixed inset-0 z-50 flex w-screen items-center justify-center overflow-y-auto bg-[var(--color-rampage-backdrop)] p-0 sm:p-6"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.99,
              y: 2,
              transition: { duration: 0.18, ease: EMIL_EASE_OUT },
            }}
            transition={{ duration: 0.28, ease: EMIL_EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rampage-title"
            aria-describedby={hasStarted ? 'rampage-affirmation' : 'rampage-setup-description'}
            tabIndex={-1}
            data-ui="true"
            data-day-mode={!isNightMode}
            className="rampage-player flex min-h-dvh w-full flex-col overflow-y-auto sm:h-[min(94dvh,860px)] sm:min-h-0 sm:max-w-5xl sm:rounded-[var(--radius-modal)] sm:border sm:border-[var(--color-rampage-line)] sm:shadow-[var(--shadow-rampage-panel)]"
          >
            <header className="safe-area-top flex items-center justify-between gap-4 px-5 pb-4 sm:px-8 sm:pt-3">
              <div className="flex min-w-0 items-center gap-3">
                <Sparkles size={20} className="shrink-0 text-[var(--color-rampage-accent)]" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 id="rampage-title" className="text-base font-semibold leading-5">
                    {hasStarted ? 'Rampage' : 'Nuevo Rampage'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-[var(--color-rampage-muted)]">
                    {hasStarted
                      ? `${activeRampageRef.current.title} · ${activeScope === 'shared' ? 'Maia y Facu' : activeScope === 'maia' ? 'Maia' : 'Facu'}`
                      : activeScope === 'shared'
                        ? 'Maia y Facu'
                        : activeScope === 'maia'
                          ? 'Maia'
                          : 'Facu'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNightMode((nightMode) => !nightMode)}
                  aria-label={isNightMode ? 'Activar modo diurno' : 'Activar modo nocturno'}
                  aria-pressed={isNightMode}
                  className="rampage-control flex h-11 w-11 items-center justify-center"
                >
                  {isNightMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Cerrar Rampage"
                  className="rampage-control flex h-11 w-11 items-center justify-center"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </header>

            {hasStarted ? (
              <>
            <main className="flex flex-1 flex-col items-center justify-center px-5 py-5 text-center sm:px-12">
              <div className="relative mb-5 flex h-64 w-64 items-center justify-center sm:mb-7 sm:h-72 sm:w-72">
                <motion.div
                  style={{
                    transform:
                      prefersReducedMotion || !isPlaying ? 'scale(1)' : outerRingTransform,
                    opacity: outerRingOpacity,
                  }}
                  className="pointer-events-none absolute inset-3 rounded-full border border-[var(--color-rampage-line)]"
                />
                <motion.div
                  style={{
                    transform:
                      prefersReducedMotion || !isPlaying ? 'scale(1)' : middleRingTransform,
                  }}
                  className="pointer-events-none absolute inset-8 rounded-full border border-dashed border-[var(--color-rampage-line)]"
                />
                <motion.div
                  animate={isPlaying && !prefersReducedMotion ? { scale: [1, 1.045, 1] } : { scale: 1 }}
                  transition={{
                    repeat: isPlaying && !prefersReducedMotion ? Infinity : 0,
                    duration: 3,
                    ease: 'easeInOut',
                  }}
                  className="rampage-orb-core relative flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36"
                >
                  <Sparkles size={34} strokeWidth={1.4} className="text-[var(--color-rampage-orb-highlight)]" aria-hidden="true" />
                </motion.div>
              </div>

              <p
                aria-live="polite"
                className="mb-3 inline-flex min-h-8 items-center rounded-full border border-[var(--color-rampage-line)] px-3.5 text-sm text-[var(--color-rampage-muted)]"
              >
                {statusLabel}
              </p>
              {playbackError ? (
                <p role="alert" className="mb-3 max-w-xl text-sm text-[var(--color-danger)]">
                  {playbackError}
                </p>
              ) : null}
              {audioPreparationWarning ? (
                <p role="status" className="mb-3 max-w-xl text-sm text-[var(--color-rampage-muted)]">
                  {audioPreparationWarning}
                </p>
              ) : null}
              {generationError ? (
                <div className="mb-3 flex max-w-xl flex-wrap items-center justify-center gap-3 text-sm text-[var(--color-danger)]">
                  <p role="alert">{generationError}</p>
                  <button
                    type="button"
                    onClick={() =>
                      void fetchMoreAffirmations(affirmationQueue.length === 0, true)
                    }
                    disabled={isLoadingNextBatch}
                    className="rounded-full border border-current px-4 py-2 font-medium transition-opacity hover:opacity-75 disabled:opacity-50"
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}
              <div className="flex min-h-[6.5rem] max-w-2xl items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h1
                    key={currentAffirmation}
                    id="rampage-affirmation"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EMIL_EASE_OUT }}
                    className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
                  >
                    “{currentAffirmation}”
                  </motion.h1>
                </AnimatePresence>
              </div>

              <div
                className={`mt-4 flex h-9 items-center justify-center gap-1 ${isPlaying ? 'is-playing' : ''}`}
                aria-hidden="true"
              >
                {waveBars.map((bar) => (
                  <span
                    key={bar}
                    className="rampage-wave-bar w-1"
                    data-playing={isPlaying && !prefersReducedMotion}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[var(--color-rampage-muted)]">
                <span className="inline-flex items-center gap-2">
                  <Mic size={15} aria-hidden="true" />
                  Voz de {currentVoiceSpeaker === 'maia' ? 'Maia' : 'Facu'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Repeat size={15} aria-hidden="true" />
                  {loopCount} frases escuchadas
                </span>
              </div>
            </main>

            <footer className="safe-area-bottom flex flex-col items-center gap-5 px-5 pt-4 sm:px-8">
              <div role="group" aria-label="Sonido ambiental" className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmbientSound('none')}
                  aria-pressed={ambientSound === 'none'}
                  className="rampage-control inline-flex items-center gap-2 px-4 text-sm"
                >
                  <VolumeX size={16} aria-hidden="true" />
                  Silencio
                </button>
                <button
                  type="button"
                  onClick={() => setAmbientSound('white_noise')}
                  aria-pressed={ambientSound === 'white_noise'}
                  className="rampage-control inline-flex items-center gap-2 px-4 text-sm"
                >
                  <Radio size={16} aria-hidden="true" />
                  Ruido blanco
                </button>
                <button
                  type="button"
                  onClick={() => setAmbientSound('astral_rain')}
                  aria-pressed={ambientSound === 'astral_rain'}
                  className="rampage-control inline-flex items-center gap-2 px-4 text-sm"
                >
                  <CloudRain size={16} aria-hidden="true" />
                  Lluvia
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 pb-2">
                <motion.button
                  type="button"
                  whileTap={IOS_TAP_SPRING}
                  onClick={togglePlayback}
                  disabled={affirmationQueue.length === 0}
                  aria-label={isPlaying ? 'Pausar Rampage' : 'Reproducir Rampage'}
                  className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[var(--color-rampage-accent)] text-[var(--color-rampage-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPlaying ? <Pause size={25} fill="currentColor" aria-hidden="true" /> : <Play size={25} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={IOS_TAP_SPRING}
                  onClick={handleSkipForward}
                  disabled={affirmationQueue.length === 0}
                  aria-label="Siguiente afirmación"
                  className="rampage-control flex h-12 w-12 items-center justify-center disabled:opacity-50"
                >
                  <SkipForward size={19} aria-hidden="true" />
                </motion.button>
              </div>
            </footer>
              </>
            ) : (
              <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-8 sm:px-12">
                <div className="mb-7">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    ¿En qué quieres enfocarte?
                  </h1>
                  <p id="rampage-setup-description" className="mt-2 text-sm leading-6 text-[var(--color-rampage-muted)]">
                    El título guía las afirmaciones. Puedes añadir detalles para orientar el tono o incluir una intención particular.
                  </p>
                </div>

                <form
                  className="flex flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleStartRampage();
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <label htmlFor="rampage-topic" className="text-sm font-medium">
                      Título del Rampage
                    </label>
                    <input
                      id="rampage-topic"
                      required
                      maxLength={120}
                      value={draftTitle}
                      onChange={(event) => {
                        setDraftTitle(event.target.value);
                        setSetupError('');
                      }}
                      placeholder="Por ejemplo: Mi identidad"
                      className="rampage-surface w-full rounded-xl px-4 py-3 text-base text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-rampage-accent)]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="rampage-details" className="text-sm font-medium">
                      Detalles o características <span className="font-normal text-[var(--color-rampage-muted)]">(opcional)</span>
                    </label>
                    <textarea
                      id="rampage-details"
                      maxLength={1000}
                      rows={4}
                      value={draftDetails}
                      onChange={(event) => setDraftDetails(event.target.value)}
                      placeholder="Añade ideas o matices que quieras incluir."
                      className="rampage-surface w-full resize-y rounded-xl px-4 py-3 text-base leading-6 text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-rampage-accent)]"
                    />
                  </div>

                  {setupError ? <p role="alert" className="text-sm text-[var(--color-danger)]">{setupError}</p> : null}

                  <button
                    type="submit"
                    className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-rampage-accent)] px-6 font-semibold text-[var(--color-rampage-accent-fg)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-rampage-accent)]"
                  >
                    <Sparkles size={18} aria-hidden="true" />
                    Crear Rampage
                  </button>
                </form>
              </main>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
