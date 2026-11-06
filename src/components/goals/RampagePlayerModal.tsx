'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { getVoiceProfileMeta } from '@/lib/voiceStorage';
import { EMIL_EASE_OUT, IOS_TAP_SPRING } from '@/lib/iosSprings';

interface RampagePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  centralTheme?: string;
}

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
  const [loopCount, setLoopCount] = useState(0);
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

  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

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
      if (audioEngine) {
        audioEngine.stopVoice();
        audioEngine.stopAmbience();
      }
      setIsPlaying(false);
      return;
    }

    const initialPool =
      userSavedAffirmations.length > 0
        ? userSavedAffirmations.map((affirmation) => affirmation.text)
        : [
            'Soy abundancia viva.',
            'Todo se alinea perfecto.',
            'Merezco todo lo bueno.',
            'Mi mente está en paz.',
            'Siempre elijo mi poder.',
            'Soy deseado y amado.',
          ];

    setAffirmationQueue(initialPool);
    setCurrentAffirmationIndex(0);

    if (activeScope === 'maia') {
      setCurrentVoiceSpeaker('maia');
    } else if (activeScope === 'facu') {
      setCurrentVoiceSpeaker('facu');
    } else if (isMaiaCalibrated && !isFacuCalibrated) {
      setCurrentVoiceSpeaker('maia');
    } else {
      setCurrentVoiceSpeaker('facu');
    }
  }, [isOpen, activeScope, isFacuCalibrated, isMaiaCalibrated, userSavedAffirmations]);

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

  const fetchMoreAffirmations = async () => {
    if (isLoadingNextBatch) return;
    setIsLoadingNextBatch(true);
    try {
      const response = await fetch('/api/ai/rampage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centralTheme,
          userScope: activeScope,
          userAffirmations: userSavedAffirmations.slice(0, 5).map((affirmation) => affirmation.text),
          batchSize: 4,
        }),
      });
      const json = await response.json();
      if (json.success && Array.isArray(json.data?.affirmations)) {
        setAffirmationQueue((previous) => [...previous, ...json.data.affirmations]);
      }
    } catch (error) {
      console.warn('[Rampage] Error fetching next batch:', error);
    } finally {
      setIsLoadingNextBatch(false);
    }
  };

  const playCurrentItem = (index: number) => {
    if (!audioEngine || index >= affirmationQueue.length) return;

    const text = affirmationQueue[index];
    if (!text) return;

    let speaker: 'maia' | 'facu' = 'facu';
    if (activeScope === 'maia') {
      speaker = 'maia';
    } else if (activeScope === 'facu') {
      speaker = 'facu';
    } else if (isMaiaCalibrated && !isFacuCalibrated) {
      speaker = 'maia';
    } else if (!isMaiaCalibrated && isFacuCalibrated) {
      speaker = 'facu';
    } else {
      speaker = index % 2 === 0 ? 'facu' : 'maia';
    }

    setCurrentVoiceSpeaker(speaker);

    const voiceMeta = getVoiceProfileMeta(speaker);
    const pitch = voiceMeta?.detectedPitch ?? (speaker === 'maia' ? 1.08 : 0.95);
    const gender = speaker === 'maia' ? ('female' as const) : ('male' as const);

    audioEngine.speakVoice(
      text,
      { pitch, rate: 0.88, gender },
      () => {
        if (!isPlayingRef.current) return;
        setTimeout(() => {
          if (!isPlayingRef.current) return;
          const nextIndex = (index + 1) % Math.max(1, affirmationQueue.length);
          setCurrentAffirmationIndex(nextIndex);
          setLoopCount((count) => count + 1);

          if (nextIndex >= affirmationQueue.length - 2) {
            fetchMoreAffirmations();
          }

          playCurrentItem(nextIndex);
        }, 1200);
      }
    );
  };

  const togglePlayback = async () => {
    if (!audioEngine || affirmationQueue.length === 0) return;
    await audioEngine.unlock(); // taste-skill-ignore: Resume the audio context from the user's playback gesture.

    if (isPlaying) {
      audioEngine.stopVoice();
      audioEngine.stopAmbience();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      playCurrentItem(currentAffirmationIndex);
    }
  };

  const handleSkipForward = () => {
    if (!audioEngine || affirmationQueue.length === 0) return;
    audioEngine.stopVoice();
    const nextIndex = (currentAffirmationIndex + 1) % affirmationQueue.length;
    setCurrentAffirmationIndex(nextIndex);
    if (isPlaying) {
      playCurrentItem(nextIndex);
    }
  };

  function handleClose() {
    if (audioEngine) {
      audioEngine.stopVoice();
      audioEngine.stopAmbience();
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    onClose();
  }

  const currentAffirmation =
    affirmationQueue[currentAffirmationIndex] || 'Alineando frecuencias...';
  const statusLabel = isLoadingNextBatch
    ? 'Preparando nuevas frases'
    : isPlaying
      ? 'Sonando ahora'
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
            aria-describedby="rampage-affirmation"
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
                    Rampage {isNightMode ? 'nocturno' : 'diurno'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-[var(--color-rampage-muted)]">
                    {activeScope === 'shared' ? 'Maia y Facu' : activeScope === 'maia' ? 'Maia' : 'Facu'}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
