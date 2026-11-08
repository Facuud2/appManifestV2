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
  BookmarkCheck,
  Check,
  CloudRain,
  Mic,
  Moon,
  Pause,
  Play,
  Radio,
  Repeat,
  SkipForward,
  Sparkles,
  Square,
  Sun,
  Trash2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { audioEngine, AmbienceType } from '@/lib/audioEngine';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT, IOS_TAP_SPRING } from '@/lib/iosSprings';
import {
  shuffleOrganically,
  type RampageLoopCount,
  type RampageHistoryContext,
  type RampageManifestationContext,
} from '@/lib/affirmationEngine';
import {
  computeAffirmationHash,
  getCachedAffirmationAudio,
  saveCachedAffirmationAudio,
} from '@/lib/voiceStorage';
import { AmbientSoundType, RampageSet, UserScope } from '@/types';
import { ElasticContainer } from '@/components/ui/ElasticContainer';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { RampageAudioWaveform } from './RampageAudioWaveform';

export interface DirectRampagePayload {
  title: string;
  affirmations: string[];
  ambientSound: AmbientSoundType;
  requestId: number;
}

interface RampagePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  openMode: 'new' | 'restore' | 'pinned';
  resumeRampage: RampageSet | null;
  resumeRequestId: number;
  directRampage?: DirectRampagePayload | null;
  centralTheme?: string;
  onPlaybackChange?: (isPlaying: boolean, currentAffirmation?: string) => void;
  registerTogglePlayback?: (toggleFn: () => void) => void;
  onOpenCalibration?: () => void;
}

interface RampageModeOption {
  count: RampageLoopCount;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
}

const RAMPAGE_MODE_OPTIONS: RampageModeOption[] = [
  {
    count: 5,
    title: 'Corto · Enfoque',
    subtitle: '5 afirmaciones',
    badge: '5',
    description: 'Ideal para fijar una idea única o pedestal rápido (1 llamada + máx. 5 TTS).',
  },
  {
    count: 11,
    title: 'Óptimo · Subliminal Nocturno',
    subtitle: '11 afirmaciones',
    badge: '11 · Óptimo',
    description: 'Punto áureo para reprogramación en fase Theta mientras dormís (Por defecto).',
  },
  {
    count: 15,
    title: 'Profundo · Escena Completa',
    subtitle: '15 afirmaciones',
    badge: '15',
    description: 'Combina autoconcepto, SP y dinámicas relacionales (1 llamada + máx. 15 TTS).',
  },
];

const INITIAL_PRELOAD_COUNT = 3;
const BACKGROUND_PRELOAD_CONCURRENCY = 2;

/*
 * Displacement map for the Liquid Glass mini player. R encodes horizontal offset, G vertical;
 * a blurred neutral (#808080) plate keeps the centre undistorted so only the rim refracts.
 */
const LIQUID_GLASS_LENS_MAP = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" preserveAspectRatio="none">
    <defs>
      <linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>
      <linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient>
      <filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <rect width="200" height="60" fill="url(#r)"/>
    <rect width="200" height="60" fill="url(#g)" style="mix-blend-mode:screen"/>
    <rect x="12" y="10" width="176" height="40" rx="14" fill="#808080" filter="url(#b)"/>
  </svg>`
)}`;

export const RampagePlayerModal: React.FC<RampagePlayerModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  openMode,
  resumeRampage,
  resumeRequestId,
  directRampage = null,
  centralTheme = '',
  onPlaybackChange,
  registerTogglePlayback,
  onOpenCalibration,
}) => {
  const {
    activeScope,
    ambientSound,
    setAmbientSound,
    affirmations: userSavedAffirmations,
    manifestations: userManifestations,
    rampageSets: userRampageSets,
    isFacuCalibrated,
    isMaiaCalibrated,
    isSandboxMode,
    setAiRequestsToday,
    incrementAiRequestsToday,
    saveRampageSet,
    deleteRampageSet,
  } = useAppStore();

  const [selectedCount, setSelectedCount] = useState<RampageLoopCount>(11);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNightMode, setIsNightMode] = useState(true);
  const [affirmationQueue, setAffirmationQueue] = useState<string[]>([]);
  const [currentAffirmationIndex, setCurrentAffirmationIndex] = useState(0);
  const [currentVoiceSpeaker, setCurrentVoiceSpeaker] = useState<'maia' | 'facu'>('facu');
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [phrasesHeardCount, setPhrasesHeardCount] = useState(0);
  const [completedCyclesCount, setCompletedCyclesCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [isBreathingPause, setIsBreathingPause] = useState(false);
  const [breathingPauseMs, setBreathingPauseMs] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isAwaitingVoiceCalibration, setIsAwaitingVoiceCalibration] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSaveDecisionOpen, setIsSaveDecisionOpen] = useState(false);
  const [isSavedToSanctuary, setIsSavedToSanctuary] = useState(false);

  // Liquid Glass lensing needs SVG filters inside backdrop-filter (Chromium only).
  const [canRefract, setCanRefract] = useState(false);
  const miniPlayerRef = useRef<HTMLElement | null>(null);
  const [draftTitle, setDraftTitle] = useState(centralTheme);
  const [draftDetails, setDraftDetails] = useState('');
  const [setupError, setSetupError] = useState('');
  const [audioPreparationWarning, setAudioPreparationWarning] = useState('');
  const prefersReducedMotion = useReducedMotion();

  const isCurrentProfileCalibrated =
    activeScope === 'maia'
      ? isMaiaCalibrated
      : activeScope === 'facu'
        ? isFacuCalibrated
        : isFacuCalibrated || isMaiaCalibrated;

  useEffect(() => {
    const ua = navigator.userAgent;
    setCanRefract(/Chrome\/\d+/.test(ua) && !/CriOS|FxiOS/.test(ua));
  }, []);

  const handleMiniPlayerPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const node = miniPlayerRef.current;
    if (!node || event.pointerType === 'touch') return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--lg-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty('--lg-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const handleMiniPlayerPointerLeave = useCallback(() => {
    const node = miniPlayerRef.current;
    if (!node) return;
    node.style.removeProperty('--lg-x');
    node.style.removeProperty('--lg-y');
  }, []);

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
  const baseAffirmationsRef = useRef<string[]>([]);
  const affirmationQueueRef = useRef<string[]>([]);
  const batchAbortRef = useRef<AbortController | null>(null);
  const playbackRequestRef = useRef(0);
  const generatedAudioCacheRef = useRef(new Map<string, AudioBuffer>());
  const generatedAudioPromisesRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const audioPreparationControllersRef = useRef(new Set<AbortController>());
  const activeRampageRef = useRef<{ title: string; details: string; count: RampageLoopCount }>({
    title: '',
    details: '',
    count: 11,
  });
  const activeRampageSetRef = useRef<RampageSet | null>(null);
  const activeRampageScopeRef = useRef<UserScope>(activeScope);
  const activeProfileAffirmationsRef = useRef<string[]>([]);
  const activeProfileManifestationsRef = useRef<RampageManifestationContext[]>([]);
  const activeProfileRampagesRef = useRef<RampageHistoryContext[]>([]);
  const resumeAutoPlayRef = useRef(false);
  const nextAffirmationTimerRef = useRef<number | null>(null);
  const isNewSessionRef = useRef(false);

  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const getSpeakerForText = useCallback(
    (text: string, indexHint = 0): 'maia' | 'facu' => {
      if (activeRampageScopeRef.current === 'maia') return 'maia';
      if (activeRampageScopeRef.current === 'facu') return 'facu';
      if (isMaiaCalibrated && !isFacuCalibrated) return 'maia';
      if (!isMaiaCalibrated) return 'facu';
      // Deterministic speaker assignment per phrase in shared mode so hash cache stays 100% hit across organic shuffles
      let charSum = 0;
      for (let i = 0; i < text.length; i += 1) {
        charSum += text.charCodeAt(i);
      }
      return (charSum + indexHint) % 2 === 0 ? 'facu' : 'maia';
    },
    [isFacuCalibrated, isMaiaCalibrated]
  );

  /**
   * Hash-based Permanent Deduplication (IndexedDB -> Turso audio_cache -> gemini-3.8-flash-tts)
   */
  const prepareAudio = useCallback(
    async (text: string, speaker: 'maia' | 'facu'): Promise<AudioBuffer> => {
      const normalized = text.trim();
      const hash = await computeAffirmationHash(speaker, normalized);

      const memoryCached = generatedAudioCacheRef.current.get(hash);
      if (memoryCached) return memoryCached;

      const pendingAudio = generatedAudioPromisesRef.current.get(hash);
      if (pendingAudio) return pendingAudio;

      const controller = new AbortController();
      audioPreparationControllersRef.current.add(controller);

      const request = (async () => {
        try {
          // 1. Check client IndexedDB permanent cache first (0 network calls, 0 API quota)
          const idbWavBuffer = await getCachedAffirmationAudio(hash);
          if (idbWavBuffer && idbWavBuffer.byteLength > 44) {
            const decoded = await audioEngine.decodeAudio(idbWavBuffer.slice(0));
            generatedAudioCacheRef.current.set(hash, decoded);
            setCachedCount(generatedAudioCacheRef.current.size);
            return decoded;
          }

          // 2. Query /api/ai/tts (checks Turso audio_cache by SHA-256 hash before calling gemini-3.8-flash-tts)
          const response = await fetch('/api/ai/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              profileId: speaker,
              text: normalized,
              hash,
              sandbox: isSandboxMode,
            }),
          });

          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || 'No se pudo sintetizar la voz de esta afirmación.');
          }

          const quotaUsed = Number(response.headers.get('X-AI-Quota-Used') || '0');
          if (quotaUsed > 0) {
            incrementAiRequestsToday(quotaUsed);
          }

          const rawWavBuffer = await response.arrayBuffer();
          // Save permanently in client IndexedDB for instant offline/night loop reuse
          await saveCachedAffirmationAudio(hash, rawWavBuffer.slice(0), {
            profileId: speaker,
            text: normalized,
          });

          const decoded = await audioEngine.decodeAudio(rawWavBuffer.slice(0));
          generatedAudioCacheRef.current.set(hash, decoded);
          setCachedCount(generatedAudioCacheRef.current.size);
          return decoded;
        } finally {
          audioPreparationControllersRef.current.delete(controller);
        }
      })();

      let preparation: Promise<AudioBuffer> | null = null;
      preparation = request.finally(() => {
        if (generatedAudioPromisesRef.current.get(hash) === preparation) {
          generatedAudioPromisesRef.current.delete(hash);
        }
      });
      generatedAudioPromisesRef.current.set(hash, preparation);
      return preparation;
    },
    [incrementAiRequestsToday, isSandboxMode]
  );

  /**
   * Staggered Pre-loading:
   * Synthesize first 3 affirmations immediately so playback starts without delay,
   * then synthesize remaining (2, 8, or 12) in background with controlled concurrency (max 2 in parallel).
   */
  const preloadSetStaggered = useCallback(
    async (affirmations: string[]) => {
      const immediateBatch = affirmations.slice(0, INITIAL_PRELOAD_COUNT);
      const backgroundBatch = affirmations.slice(INITIAL_PRELOAD_COUNT);

      const firstResults = await Promise.allSettled(
        immediateBatch.map((text, idx) => prepareAudio(text, getSpeakerForText(text, idx)))
      );

      if (firstResults.some((r) => r.status === 'rejected')) {
        setAudioPreparationWarning(
          'Algunas voces se prepararán al momento de reproducirse.'
        );
      }

      if (backgroundBatch.length === 0) return;

      // Process remaining items in background with max concurrency = 2
      void (async () => {
        let cursor = 0;
        const worker = async () => {
          while (cursor < backgroundBatch.length) {
            const currentIndex = cursor;
            cursor += 1;
            const phrase = backgroundBatch[currentIndex];
            if (!phrase) continue;
            try {
              await prepareAudio(
                phrase,
                getSpeakerForText(phrase, INITIAL_PRELOAD_COUNT + currentIndex)
              );
            } catch {
              // Ignore background pre-fetch error; playCurrentItem has graceful fallback
            }
          }
        };

        const workers = Array.from(
          { length: Math.min(BACKGROUND_PRELOAD_CONCURRENCY, backgroundBatch.length) },
          () => worker()
        );
        await Promise.allSettled(workers);
      })();
    },
    [getSpeakerForText, prepareAudio]
  );

  const profileAffirmations = userSavedAffirmations
    .filter((affirmation) => affirmation.userId === activeScope)
    .slice(0, 20)
    .map((affirmation) => affirmation.text);
  const profileManifestations: RampageManifestationContext[] = userManifestations
    .filter((manifestation) => manifestation.userId === activeScope)
    .slice(0, 15)
    .map((manifestation) => ({
      title: manifestation.title,
      description: manifestation.description,
      status: manifestation.status,
      category: manifestation.category,
    }));
  const profileRampages: RampageHistoryContext[] = userRampageSets
    .filter((rampage) => rampage.userId === activeScope)
    .slice(0, 5)
    .map((rampage) => ({
      title: rampage.title,
      affirmations: rampage.affirmations
        .slice(0, 12)
        .map((affirmation) => affirmation.text),
    }))
    .filter((rampage) => rampage.affirmations.length > 0);

  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;
  const userSavedAffirmationsRef = useRef(userSavedAffirmations);
  userSavedAffirmationsRef.current = userSavedAffirmations;
  const userManifestationsRef = useRef(userManifestations);
  userManifestationsRef.current = userManifestations;
  const userRampageSetsRef = useRef(userRampageSets);
  userRampageSetsRef.current = userRampageSets;
  const profileAffirmationsRef = useRef(profileAffirmations);
  profileAffirmationsRef.current = profileAffirmations;
  const profileManifestationsRef = useRef(profileManifestations);
  profileManifestationsRef.current = profileManifestations;
  const profileRampagesRef = useRef(profileRampages);
  profileRampagesRef.current = profileRampages;

  /**
   * Single Batch Text Generation (/api/ai/rampage):
   * Requests all N (5, 11, or 15) affirmations in ONE single JSON call.
   * Never makes infinite requests while the user sleeps.
   */
  const generateSingleRampageSet = useCallback(async () => {
    batchAbortRef.current?.abort();
    const controller = new AbortController();
    batchAbortRef.current = controller;

    setIsLoadingBatch(true);
    setGenerationError('');
    setAudioPreparationWarning('');

    try {
      const targetCount = activeRampageRef.current.count;
      const response = await fetch('/api/ai/rampage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          centralTheme: activeRampageRef.current.title,
          nuances: activeRampageRef.current.details,
          profileId: activeRampageScopeRef.current,
          count: targetCount,
          sandbox: isSandboxMode,
          userAffirmations: activeProfileAffirmationsRef.current,
          userManifestations: activeProfileManifestationsRef.current,
          userRampages: activeProfileRampagesRef.current,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data?.affirmations)) {
        throw new Error(result.error || 'No se pudieron generar las afirmaciones del Rampage.');
      }

      if (typeof result.meta?.aiUsageToday === 'number') {
        setAiRequestsToday(result.meta.aiUsageToday);
      }

      const generated: string[] = result.data.affirmations
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, targetCount);

      if (generated.length === 0) {
        throw new Error('No se recibieron afirmaciones válidas.');
      }

      baseAffirmationsRef.current = generated;
      affirmationQueueRef.current = generated;
      setAffirmationQueue(generated);
      setCurrentAffirmationIndex(0);
      setCompletedCyclesCount(0);
      setPhrasesHeardCount(0);

      // Persist set in Turso/store so it is immediately available; Paso 3 modal lets user keep or discard
      const savedSet = await saveRampageSet({
        userId: activeRampageScopeRef.current,
        author:
          activeRampageScopeRef.current === 'maia'
            ? 'Maia'
            : activeRampageScopeRef.current === 'facu'
              ? 'Facu'
              : 'Juntos',
        title: activeRampageRef.current.title,
        affirmations: generated.map((text, index) => ({
          id: `${Date.now()}_${index}`,
          text,
          repeatCount: 0,
        })),
        ambientSound,
        isFavorite: false,
      });
      activeRampageSetRef.current = savedSet;
      setIsSavedToSanctuary(true);

      // Preload first 3 immediately, then remaining in background (max 2 concurrent)
      await preloadSetStaggered(generated);

      // Start autonomous playback immediately once initial preload settles
      if (audioEngine) {
        setIsPlaying(true);
        isPlayingRef.current = true;
        if (ambientSound !== 'none') {
          audioEngine.setAmbience(ambientSound as AmbienceType);
        }
        resumeAutoPlayRef.current = true;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setGenerationError(
        error instanceof Error ? error.message : 'Error al generar el set de Rampage.'
      );
    } finally {
      if (batchAbortRef.current === controller) {
        batchAbortRef.current = null;
        setIsLoadingBatch(false);
      }
    }
  }, [ambientSound, isSandboxMode, preloadSetStaggered, saveRampageSet, setAiRequestsToday]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      if (isMinimized) return;
      playbackRequestRef.current += 1;
      batchAbortRef.current?.abort();
      batchAbortRef.current = null;
      audioPreparationControllersRef.current.forEach((controller) => controller.abort());
      audioPreparationControllersRef.current.clear();
      generatedAudioPromisesRef.current.clear();
      if (nextAffirmationTimerRef.current !== null) {
        window.clearTimeout(nextAffirmationTimerRef.current);
        nextAffirmationTimerRef.current = null;
      }
      isPlayingRef.current = false;
      affirmationQueueRef.current = [];
      baseAffirmationsRef.current = [];
      if (audioEngine) {
        audioEngine.stopVoice();
        audioEngine.stopAmbience();
      }
      setIsPlaying(false);
      setIsLoadingBatch(false);
      setIsSynthesizing(false);
      setIsBreathingPause(false);
      setHasStarted(false);
      setIsAwaitingVoiceCalibration(false);
      setIsSaveDecisionOpen(false);
      return;
    }

    if (openMode === 'restore' || openMode === 'pinned') {
      setIsMinimized(false);
      return;
    }

    if (isMinimized) {
      playbackRequestRef.current += 1;
      batchAbortRef.current?.abort();
      audioPreparationControllersRef.current.forEach((controller) => controller.abort());
      audioPreparationControllersRef.current.clear();
      generatedAudioPromisesRef.current.clear();
      if (audioEngine) {
        audioEngine.stopVoice();
        audioEngine.stopAmbience();
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsMinimized(false);
    }

    setIsMinimized(false);
    affirmationQueueRef.current = [];
    baseAffirmationsRef.current = [];
    generatedAudioPromisesRef.current.clear();
    setAffirmationQueue([]);
    setCurrentAffirmationIndex(0);
    setPhrasesHeardCount(0);
    setCompletedCyclesCount(0);
    setCachedCount(generatedAudioCacheRef.current.size);
    setIsBreathingPause(false);
    setBreathingPauseMs(0);
    setPlaybackError('');
    setGenerationError('');
    setAudioPreparationWarning('');
    setSetupError('');
    setDraftTitle(centralTheme);
    setDraftDetails('');
    setSelectedCount(11);
    setIsSaveDecisionOpen(false);
    setIsSavedToSanctuary(false);
    setIsAwaitingVoiceCalibration(false);
    isNewSessionRef.current = false;
    activeRampageRef.current = { title: '', details: '', count: 11 };
    activeRampageScopeRef.current = activeScopeRef.current;
    activeProfileAffirmationsRef.current = profileAffirmationsRef.current;
    activeProfileManifestationsRef.current = profileManifestationsRef.current;
    activeProfileRampagesRef.current = profileRampagesRef.current;
    activeRampageSetRef.current = null;
    setHasStarted(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentVoiceSpeaker(getSpeakerForText('', 0));
  }, [centralTheme, getSpeakerForText, isMinimized, isOpen, openMode]);

  useEffect(() => {
    if (!resumeRampage || resumeRequestId === 0) return;
    const affirmations = resumeRampage.affirmations
      .map((affirmation) => affirmation.text.trim())
      .filter(Boolean);
    if (affirmations.length === 0) return;

    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    audioPreparationControllersRef.current.forEach((controller) => controller.abort());
    audioPreparationControllersRef.current.clear();
    generatedAudioPromisesRef.current.clear();
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    audioEngine?.stopVoice();
    audioEngine?.stopAmbience();

    const inferredCount: RampageLoopCount =
      affirmations.length <= 5 ? 5 : affirmations.length <= 11 ? 11 : 15;
    activeRampageRef.current = {
      title: resumeRampage.title,
      details: '',
      count: inferredCount,
    };
    activeRampageScopeRef.current = resumeRampage.userId;
    activeRampageSetRef.current = resumeRampage;
    baseAffirmationsRef.current = affirmations;
    affirmationQueueRef.current = affirmations;
    isNewSessionRef.current = false;
    setIsSavedToSanctuary(true);
    setAffirmationQueue(affirmations);
    setCurrentAffirmationIndex(0);
    setPhrasesHeardCount(0);
    setCompletedCyclesCount(0);
    setIsBreathingPause(false);
    setPlaybackError('');
    setGenerationError('');
    setIsLoadingBatch(false);
    setIsSynthesizing(false);
    setAudioPreparationWarning('');
    setHasStarted(true);
    setIsMinimized(true);
    setIsPlaying(true);
    isPlayingRef.current = true;
    resumeAutoPlayRef.current = true;
    setCurrentVoiceSpeaker(getSpeakerForText(affirmations[0] || '', 0));
    void preloadSetStaggered(affirmations);
  }, [getSpeakerForText, preloadSetStaggered, resumeRampage, resumeRequestId]);

  useEffect(() => {
    if (!directRampage || directRampage.requestId === 0) return;
    const affirmations = directRampage.affirmations
      .map((item) => item.trim())
      .filter(Boolean);
    if (affirmations.length === 0) return;

    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    audioPreparationControllersRef.current.forEach((controller) => controller.abort());
    audioPreparationControllersRef.current.clear();
    generatedAudioPromisesRef.current.clear();
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    audioEngine?.stopVoice();
    audioEngine?.stopAmbience();

    const inferredCount: RampageLoopCount =
      affirmations.length <= 5 ? 5 : affirmations.length <= 11 ? 11 : 15;
    const title = directRampage.title || 'Decretos fijados';
    const chosenAmbient = directRampage.ambientSound || 'astral_rain';

    setAmbientSound(chosenAmbient);
    activeRampageRef.current = {
      title,
      details: '',
      count: inferredCount,
    };
    activeRampageScopeRef.current = activeScope;
    baseAffirmationsRef.current = affirmations;
    affirmationQueueRef.current = affirmations;
    isNewSessionRef.current = false;
    setAffirmationQueue(affirmations);
    setCurrentAffirmationIndex(0);
    setPhrasesHeardCount(0);
    setCompletedCyclesCount(0);
    setIsBreathingPause(false);
    setPlaybackError('');
    setGenerationError('');
    setIsLoadingBatch(false);
    setIsSynthesizing(false);
    setAudioPreparationWarning('');
    setHasStarted(true);
    setIsMinimized(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    resumeAutoPlayRef.current = true;
    setCurrentVoiceSpeaker(getSpeakerForText(affirmations[0] || '', 0));

    void (async () => {
      try {
        const savedSet = await saveRampageSet({
          userId: activeScope,
          author:
            activeScope === 'maia'
              ? 'Maia'
              : activeScope === 'facu'
                ? 'Facu'
                : 'Juntos',
          title,
          affirmations: affirmations.map((text, index) => ({
            id: `${Date.now()}_${index}`,
            text,
            repeatCount: 0,
          })),
          ambientSound: chosenAmbient,
          isFavorite: false,
        });
        activeRampageSetRef.current = savedSet;
        setIsSavedToSanctuary(true);
      } catch (err) {
        console.warn('Could not save pinned rampage set to store:', err);
      }
    })();

    if (audioEngine && chosenAmbient !== 'none') {
      audioEngine.setAmbience(chosenAmbient as AmbienceType);
    }

    void preloadSetStaggered(affirmations);
  }, [activeScope, directRampage, getSpeakerForText, preloadSetStaggered, saveRampageSet, setAmbientSound]);

  useEffect(() => {
    if (activeRampageScopeRef.current !== activeScope && (hasStarted || isMinimized || isOpen)) {
      handleStopBackgroundPlayback();
      activeRampageScopeRef.current = activeScope;
    }
  }, [activeScope, hasStarted, isMinimized, isOpen]);

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
    if ((!isOpen && !isMinimized) || !isPlaying) {
      if (audioEngine) audioEngine.stopAmbience();
      return;
    }
    if (audioEngine) {
      audioEngine.setAmbience(ambientSound as AmbienceType);
    }
  }, [isOpen, isMinimized, isPlaying, ambientSound]);

  /**
   * Autonomous Infinite Night Player with Organic Shuffle & Variable Breathing Pauses (2.5s - 4.5s)
   * Makes 0 backend calls once the set of 5, 11, or 15 affirmations is cached.
   */
  const playCurrentItem = async (index: number) => {
    const queue = affirmationQueueRef.current;
    if (!audioEngine || index >= queue.length || !hasStarted) return;

    const text = queue[index];
    if (!text) return;

    const speaker = getSpeakerForText(text, index);
    setCurrentVoiceSpeaker(speaker);
    const requestId = ++playbackRequestRef.current;
    setIsBreathingPause(false);
    setBreathingPauseMs(0);
    setIsSynthesizing(true);
    setPlaybackError('');

    // Update iOS / WebKit Lock Screen MediaSession
    audioEngine.updateMediaSession(
      {
        title: text,
        artist: `Rampage · ${speaker === 'maia' ? 'Maia' : 'Facu'}`,
        album: activeRampageRef.current.title || 'Ley de la Asunción',
      },
      {
        onPlay: () => {
          if (!isPlayingRef.current) void togglePlaybackRef.current();
        },
        onPause: () => {
          if (isPlayingRef.current) void togglePlaybackRef.current();
        },
        onNextTrack: () => {
          void handleSkipForward();
        },
      }
    );

    const handleNext = () => {
      if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;

      // Variable breathing pause between 2.5s and 4.5s while Web Audio ambience plays gaplessly
      const randomPauseMs = Math.round(2500 + Math.random() * 2000);
      setIsBreathingPause(true);
      setBreathingPauseMs(randomPauseMs);

      nextAffirmationTimerRef.current = window.setTimeout(() => {
        if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;
        setIsBreathingPause(false);
        setBreathingPauseMs(0);

        const latestQueue = affirmationQueueRef.current;
        if (latestQueue.length === 0) return;

        let nextIndex = index + 1;
        if (nextIndex >= latestQueue.length) {
          // Completed a full cycle of N affirmations!
          // Apply Organic Shuffle for subsequent loops (avoiding repeating the last phrase at cycle boundary)
          const lastPhrase = latestQueue[latestQueue.length - 1];
          const sourceSet =
            baseAffirmationsRef.current.length > 0
              ? baseAffirmationsRef.current
              : latestQueue;
          const shuffledQueue = shuffleOrganically(sourceSet, lastPhrase);
          affirmationQueueRef.current = shuffledQueue;
          setAffirmationQueue(shuffledQueue);
          nextIndex = 0;
          setCompletedCyclesCount((cycles) => cycles + 1);
        }

        setCurrentAffirmationIndex(nextIndex);
        setPhrasesHeardCount((count) => count + 1);
        void playCurrentItem(nextIndex);
      }, randomPauseMs);
    };

    let audio: AudioBuffer | null = null;
    try {
      audio = await prepareAudio(text, speaker);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('[Rampage] Usando síntesis local de respaldo:', error);
    }

    if (!isPlayingRef.current || requestId !== playbackRequestRef.current) return;
    setIsSynthesizing(false);

    if (audio) {
      setAudioPreparationWarning('');
      void audioEngine.playVoice(
        audio,
        handleNext,
        (error: Error) => {
          if (requestId !== playbackRequestRef.current) return;
          console.warn('[Rampage] Falló reproducción Web Audio, intentando speakVoice:', error);
          const spoke = audioEngine.speakVoice(
            text,
            { gender: speaker === 'maia' ? 'female' : 'male', rate: 0.92 },
            handleNext
          );
          if (!spoke) {
            nextAffirmationTimerRef.current = window.setTimeout(handleNext, 1800);
          }
        }
      );
    } else {
      setAudioPreparationWarning('Reproduciendo con motor de voz local');
      const spoke = audioEngine.speakVoice(
        text,
        {
          gender: speaker === 'maia' ? 'female' : 'male',
          rate: 0.92,
        },
        handleNext
      );
      if (!spoke) {
        nextAffirmationTimerRef.current = window.setTimeout(handleNext, 1800);
      }
    }
  };

  useEffect(() => {
    if (!resumeAutoPlayRef.current || affirmationQueue.length === 0 || !hasStarted) return;
    resumeAutoPlayRef.current = false;
    void playCurrentItem(0);
  }, [affirmationQueue, hasStarted, resumeRequestId, directRampage?.requestId]);

  const togglePlayback = async () => {
    if (!audioEngine) return;
    await audioEngine.unlock(); // taste-skill-ignore: Resume the audio context from the user's playback gesture.

    let queue = affirmationQueueRef.current;

    if (queue.length === 0) {
      const targetRampage = resumeRampage || userRampageSetsRef.current[0];
      if (targetRampage && targetRampage.affirmations.length > 0) {
        const affirmations = targetRampage.affirmations
          .map((a) => a.text.trim())
          .filter(Boolean);
        if (affirmations.length > 0) {
          activeRampageRef.current = {
            title: targetRampage.title,
            details: '',
            count: affirmations.length <= 5 ? 5 : affirmations.length <= 11 ? 11 : 15,
          };
          activeRampageSetRef.current = targetRampage;
          baseAffirmationsRef.current = affirmations;
          affirmationQueueRef.current = affirmations;
          setAffirmationQueue(affirmations);
          setCurrentAffirmationIndex(0);
          setHasStarted(true);
          setIsMinimized(true);
          queue = affirmations;
        }
      }
    }

    if (queue.length === 0) return;

    if (isPlaying) {
      isPlayingRef.current = false;
      playbackRequestRef.current += 1;
      if (nextAffirmationTimerRef.current !== null) {
        window.clearTimeout(nextAffirmationTimerRef.current);
        nextAffirmationTimerRef.current = null;
      }
      audioEngine.stopVoice();
      audioEngine.stopAmbience();
      setIsBreathingPause(false);
      setIsPlaying(false);
      setIsSynthesizing(false);
    } else {
      setPlaybackError('');
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (ambientSound !== 'none') {
        audioEngine.setAmbience(ambientSound as AmbienceType);
      }
      void playCurrentItem(currentAffirmationIndex);
    }
  };

  const togglePlaybackRef = useRef(togglePlayback);
  togglePlaybackRef.current = togglePlayback;

  useEffect(() => {
    registerTogglePlayback?.(() => {
      void togglePlaybackRef.current();
    });
  }, [registerTogglePlayback]);

  useEffect(() => {
    onPlaybackChange?.(isPlaying, affirmationQueue[currentAffirmationIndex]);
  }, [isPlaying, currentAffirmationIndex, affirmationQueue, onPlaybackChange]);

  const handleSkipForward = async () => {
    if (!audioEngine || affirmationQueueRef.current.length === 0) return;
    playbackRequestRef.current += 1;
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    setIsBreathingPause(false);
    audioEngine.stopVoice();

    const latestQueue = affirmationQueueRef.current;
    let nextIndex = currentAffirmationIndex + 1;

    if (nextIndex >= latestQueue.length) {
      const lastPhrase = latestQueue[latestQueue.length - 1];
      const sourceSet =
        baseAffirmationsRef.current.length > 0 ? baseAffirmationsRef.current : latestQueue;
      const shuffled = shuffleOrganically(sourceSet, lastPhrase);
      affirmationQueueRef.current = shuffled;
      setAffirmationQueue(shuffled);
      nextIndex = 0;
      setCompletedCyclesCount((cycles) => cycles + 1);
    }

    setCurrentAffirmationIndex(nextIndex);
    setPhrasesHeardCount((count) => count + 1);

    if (isPlayingRef.current) {
      void playCurrentItem(nextIndex);
    } else {
      const nextPhrase = affirmationQueueRef.current[nextIndex] || '';
      setCurrentVoiceSpeaker(getSpeakerForText(nextPhrase, nextIndex));
    }
  };

  const handleStartRampage = async () => {
    const title = draftTitle.trim();
    if (!title) {
      setSetupError('Escribí o dictá un tema central para iniciar tu Rampage.');
      return;
    }

    if (audioEngine) {
      await audioEngine.unlock(); // taste-skill-ignore: Unlock WebKit AudioContext on user gesture
    }

    activeRampageRef.current = {
      title: title.slice(0, 120),
      details: draftDetails.trim().slice(0, 1000),
      count: selectedCount,
    };
    activeRampageScopeRef.current = activeScopeRef.current;
    activeProfileAffirmationsRef.current = profileAffirmationsRef.current;
    activeProfileManifestationsRef.current = profileManifestationsRef.current;
    activeProfileRampagesRef.current = profileRampagesRef.current;
    activeRampageSetRef.current = null;
    isNewSessionRef.current = true;
    setSetupError('');

    if (!isCurrentProfileCalibrated) {
      setIsAwaitingVoiceCalibration(true);
      return;
    }

    setIsAwaitingVoiceCalibration(false);
    setHasStarted(true);
    setCurrentAffirmationIndex(0);
    setPlaybackError('');
    setGenerationError('');
    void generateSingleRampageSet();
  };

  useEffect(() => {
    if (!isOpen || !isAwaitingVoiceCalibration || !isCurrentProfileCalibrated) return;
    setIsAwaitingVoiceCalibration(false);
    setHasStarted(true);
    setCurrentAffirmationIndex(0);
    setPlaybackError('');
    setGenerationError('');
    void generateSingleRampageSet();
  }, [generateSingleRampageSet, isAwaitingVoiceCalibration, isCurrentProfileCalibrated, isOpen]);

  function handleClose() {
    if (hasStarted) {
      setIsMinimized(true);
      onClose();
      return;
    }

    handleStopBackgroundPlayback();
  }

  function handleOpenFinishModal() {
    if (isPlayingRef.current) {
      void togglePlayback();
    }
    setIsSaveDecisionOpen(true);
  }

  async function handleConfirmKeepSet() {
    if (activeRampageSetRef.current) {
      await saveRampageSet({
        ...activeRampageSetRef.current,
        ambientSound,
      });
    }
    setIsSaveDecisionOpen(false);
    handleStopBackgroundPlayback();
  }

  async function handleDiscardSet() {
    if (isNewSessionRef.current && activeRampageSetRef.current?.id) {
      await deleteRampageSet(activeRampageSetRef.current.id);
    }
    setIsSaveDecisionOpen(false);
    handleStopBackgroundPlayback();
  }

  function handleStopBackgroundPlayback() {
    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    activeRampageRef.current = { title: '', details: '', count: 11 };
    activeRampageSetRef.current = null;
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
    setIsLoadingBatch(false);
    setIsSynthesizing(false);
    setIsBreathingPause(false);
    setHasStarted(false);
    setIsMinimized(false);
    setIsSaveDecisionOpen(false);
    setAffirmationQueue([]);
    affirmationQueueRef.current = [];
    baseAffirmationsRef.current = [];
    onClose();
  }

  const currentAffirmation =
    affirmationQueue[currentAffirmationIndex] || 'Preparando tu sesión subliminal…';
  const statusLabel = playbackError
    ? 'No se pudo reproducir el audio'
    : isBreathingPause
      ? `Pausa respiratoria (${(breathingPauseMs / 1000).toFixed(1)}s) · Caché activa`
      : isSynthesizing
        ? 'Preparando voz desde huella vocal…'
        : isPlaying
          ? completedCyclesCount > 0
            ? `Bucle infinito en caché · Vuelta ${completedCyclesCount + 1} (0 llamadas API)`
            : `Sonando ahora · Frase ${currentAffirmationIndex + 1} de ${affirmationQueue.length}`
          : isLoadingBatch
            ? `Generando ${selectedCount} afirmaciones en lote único…`
            : generationError && affirmationQueue.length === 0
              ? 'No se pudieron preparar las frases'
              : 'Listo para escuchar';
  const waveBars = Array.from({ length: 19 }, (_, index) => index);
  const showCalibrationStep = !isCurrentProfileCalibrated;

  return (
    <>
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
              transition={APPLE_ELASTIC_SPRING}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleDialogKeyDown}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rampage-title"
              aria-describedby={hasStarted ? 'rampage-affirmation' : 'rampage-setup-description'}
              tabIndex={-1}
              data-ui="true"
              data-day-mode={!isNightMode}
              data-rampage-count={selectedCount}
              data-completed-cycles={completedCyclesCount}
              data-breathing-pause={isBreathingPause ? 'true' : 'false'}
              className="rampage-player flex h-dvh max-h-dvh w-full flex-col overflow-hidden sm:h-[min(94dvh,860px)] sm:max-h-[min(94dvh,860px)] sm:max-w-5xl sm:rounded-[var(--radius-modal)] sm:border sm:border-[var(--color-rampage-line)] sm:shadow-[var(--shadow-rampage-panel)]"
            >
              <header className="safe-area-top flex shrink-0 items-center justify-between gap-4 px-5 pb-4 sm:px-8 sm:pt-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Sparkles
                    size={20}
                    className="shrink-0 text-[var(--color-rampage-accent)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 id="rampage-title" className="text-base font-semibold leading-5">
                      {hasStarted ? 'Rampage Subliminal Nocturno' : 'Nuevo Rampage'}
                    </h2>
                    <p className="mt-1 truncate text-sm text-[var(--color-rampage-muted)]">
                      {hasStarted
                        ? `${activeRampageRef.current.title} · ${affirmationQueue.length} afirmaciones · ${activeScope === 'shared' ? 'Maia y Facu' : activeScope === 'maia' ? 'Maia' : 'Facu'}`
                        : activeScope === 'shared'
                          ? 'Maia y Facu · Ley de la Asunción'
                          : activeScope === 'maia'
                            ? 'Maia · Ley de la Asunción'
                            : 'Facu · Ley de la Asunción'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {hasStarted && (
                    <button
                      type="button"
                      onClick={handleOpenFinishModal}
                      aria-label="Guardar o cerrar sesión de Rampage"
                      className="rampage-control inline-flex h-11 items-center gap-2 px-3.5 text-xs font-semibold"
                    >
                      <BookmarkCheck size={16} aria-hidden="true" />
                      <span className="hidden sm:inline">Guardar o cerrar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNightMode((nightMode) => !nightMode)}
                    aria-label={isNightMode ? 'Activar modo diurno' : 'Activar modo nocturno'}
                    aria-pressed={isNightMode}
                    className="rampage-control flex h-11 w-11 items-center justify-center"
                  >
                    {isNightMode ? (
                      <Sun size={18} aria-hidden="true" />
                    ) : (
                      <Moon size={18} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label={hasStarted ? 'Minimizar y continuar escuchando' : 'Cerrar Rampage'}
                    className="rampage-control flex h-11 w-11 items-center justify-center"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              </header>

              {hasStarted ? (
                <>
                  <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-12 sm:py-5">
                    <div className="m-auto flex w-full flex-col items-center text-center">
                      <div className="relative mb-4 flex h-48 w-48 items-center justify-center sm:mb-6 sm:h-64 sm:w-64">
                        <div aria-hidden="true" className="rampage-orb-bloom">
                          <span className="rampage-orb-bloom-a" />
                          <span className="rampage-orb-bloom-b" />
                          <span className="rampage-orb-bloom-c" />
                        </div>
                        <motion.div
                          style={{
                            transform:
                              prefersReducedMotion || !isPlaying
                                ? 'scale(1)'
                                : outerRingTransform,
                            opacity: outerRingOpacity,
                          }}
                          className="pointer-events-none absolute inset-3 rounded-full border border-[var(--color-rampage-line)]"
                        />
                        <motion.div
                          style={{
                            transform:
                              prefersReducedMotion || !isPlaying
                                ? 'scale(1)'
                                : middleRingTransform,
                          }}
                          className="pointer-events-none absolute inset-8 rounded-full border border-dashed border-[var(--color-rampage-line)]"
                        />
                        <motion.div
                          animate={
                            isPlaying && !prefersReducedMotion
                              ? { scale: [1, 1.045, 1] }
                              : { scale: 1 }
                          }
                          transition={{
                            repeat: isPlaying && !prefersReducedMotion ? Infinity : 0,
                            duration: 3,
                            ease: 'easeInOut',
                          }}
                          className="rampage-orb-core relative flex h-28 w-28 items-center justify-center rounded-full sm:h-36 sm:w-36"
                        >
                          <Sparkles
                            size={34}
                            strokeWidth={1.4}
                            className="text-[var(--color-rampage-orb-highlight)]"
                            aria-hidden="true"
                          />
                        </motion.div>
                      </div>

                      <p
                        aria-live="polite"
                        data-testid="rampage-status-pill"
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
                        <p
                          role="status"
                          className="mb-3 max-w-xl text-sm text-[var(--color-rampage-muted)]"
                        >
                          {audioPreparationWarning}
                        </p>
                      ) : null}
                      {generationError ? (
                        <div className="mb-3 flex max-w-xl flex-wrap items-center justify-center gap-3 text-sm text-[var(--color-danger)]">
                          <p role="alert">{generationError}</p>
                          <button
                            type="button"
                            onClick={() => void generateSingleRampageSet()}
                            disabled={isLoadingBatch}
                            className="rounded-full border border-current px-4 py-2 font-medium transition-opacity hover:opacity-75 disabled:opacity-50"
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : null}

                      <div className="flex min-h-[5rem] max-w-2xl items-center justify-center sm:min-h-[6.5rem]">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.h1
                            key={`${currentAffirmationIndex}_${currentAffirmation}`}
                            id="rampage-affirmation"
                            data-testid="rampage-active-affirmation"
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
                        <span
                          className="inline-flex items-center gap-2 tabular-nums"
                          data-testid="rampage-progress-counter"
                        >
                          <Repeat size={15} aria-hidden="true" />
                          Frase {affirmationQueue.length > 0 ? currentAffirmationIndex + 1 : 0}/
                          {affirmationQueue.length} · {phrasesHeardCount} escuchadas
                        </span>
                        {completedCyclesCount > 0 && (
                          <span
                            data-testid="rampage-cycle-badge"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-rampage-line)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-rampage-accent)]"
                          >
                            <Check size={13} aria-hidden="true" />
                            Barajado orgánico activo · Vuelta {completedCyclesCount + 1}
                          </span>
                        )}
                      </div>
                    </div>
                  </main>

                  <footer className="safe-area-bottom flex shrink-0 flex-col items-center gap-4 px-5 pt-3 sm:gap-5 sm:px-8 sm:pt-4">
                    <div
                      role="group"
                      aria-label="Sonido ambiental"
                      className="flex flex-wrap justify-center gap-2"
                    >
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
                        data-playing={isPlaying}
                        aria-label={isPlaying ? 'Pausar Rampage' : 'Reproducir Rampage'}
                        className="rampage-play flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[var(--color-rampage-accent)] text-[var(--color-rampage-accent-fg)] hover:opacity-90 disabled:opacity-50"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={isPlaying ? 'pause' : 'play'}
                            initial={{ opacity: 0, scale: 0.86 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.86 }}
                            transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
                            className="flex"
                          >
                            {isPlaying ? (
                              <Pause size={25} fill="currentColor" aria-hidden="true" />
                            ) : (
                              <Play
                                size={25}
                                fill="currentColor"
                                className="translate-x-0.5"
                                aria-hidden="true"
                              />
                            )}
                          </motion.span>
                        </AnimatePresence>
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
              ) : isAwaitingVoiceCalibration && !isCurrentProfileCalibrated ? (
                <main
                  data-testid="rampage-voice-skeleton-gate"
                  className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:px-12 sm:py-6"
                >
                  {/* Skeleton anatómico del reproductor de Rampage en el fondo */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none m-auto flex w-full max-w-2xl select-none flex-col items-center text-center opacity-55"
                  >
                    <div className="relative mb-5 flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
                      <span className="absolute inset-2 rounded-full border border-[var(--color-rampage-line)]" />
                      <span className="absolute inset-7 rounded-full border border-dashed border-[var(--color-rampage-line)]" />
                      <span className="rampage-skel-block-strong block h-24 w-24 rounded-full sm:h-32 sm:w-32" />
                    </div>
                    <span className="rampage-skel-block mb-4 block h-8 w-52 rounded-full" />
                    <div className="flex w-full flex-col items-center gap-3 py-2">
                      <span className="rampage-skel-block-strong block h-7 w-[min(26rem,88%)] rounded-full sm:h-8" />
                      <span className="rampage-skel-block block h-7 w-[min(19rem,66%)] rounded-full sm:h-8" />
                    </div>
                    <div className="mt-5 flex h-9 items-end justify-center gap-1.5">
                      {waveBars.map((bar) => (
                        <span
                          key={bar}
                          className="rampage-skel-block-strong block w-1 rounded-full"
                          style={{ height: `${24 + ((bar * 19) % 58)}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      <span className="rampage-skel-block block h-10 w-24 rounded-full" />
                      <span className="rampage-skel-block block h-10 w-28 rounded-full" />
                      <span className="rampage-skel-block block h-10 w-24 rounded-full" />
                    </div>
                    <div className="mt-5 flex items-center justify-center gap-4">
                      <span className="rampage-skel-block-strong block h-16 w-16 rounded-full" />
                      <span className="rampage-skel-block block h-12 w-12 rounded-full" />
                    </div>
                  </div>

                  {/* Tarjeta superpuesta en el centro para solicitar calibración de voz */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={APPLE_ELASTIC_SPRING}
                      className="rampage-surface flex w-full max-w-md flex-col items-center rounded-[24px] p-6 text-center shadow-[var(--shadow-rampage-panel)] sm:p-7"
                    >
                      <span className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-rampage-line)] text-[var(--color-rampage-accent)]">
                        <Mic size={24} aria-hidden="true" />
                      </span>
                      <p className="rampage-setup-eyebrow">Huella vocal requerida</p>
                      <h3 className="mt-1.5 text-xl font-semibold leading-tight text-[var(--color-rampage-ink)]">
                        Calibrá tu voz para generar este Rampage
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-rampage-muted)]">
                        Antes de sintetizar tus {selectedCount} afirmaciones sobre{' '}
                        <span className="font-medium text-[var(--color-rampage-ink)]">
                          “{draftTitle.trim()}”
                        </span>
                        , necesitamos registrar tu timbre vocal en este perfil.
                      </p>
                      <div className="mt-5 flex w-full flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenCalibration?.()}
                          data-testid="rampage-skeleton-calibrate-btn"
                          className="rampage-setup-submit inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-[var(--color-rampage-accent-fg)]"
                        >
                          <Mic size={17} aria-hidden="true" />
                          Calibrar voz
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAwaitingVoiceCalibration(false)}
                          className="rampage-control inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-xs font-medium"
                        >
                          Volver a editar intención
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </main>
              ) : (
                <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <div className="relative m-auto w-full max-w-xl px-5 py-5 sm:px-10 sm:py-8">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className="rampage-setup-halo mb-3 h-[4.5rem] w-[4.5rem]"
                        aria-hidden="true"
                      >
                        <div className="rampage-orb-core rampage-setup-orb flex items-center justify-center rounded-full">
                          <Sparkles
                            size={20}
                            strokeWidth={1.5}
                            className="text-[var(--color-rampage-orb-highlight)]"
                          />
                        </div>
                      </div>
                      <p className="rampage-setup-eyebrow">Motor Nocturno · Ley de la Asunción</p>
                      <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-3xl">
                        ¿Qué hecho cumplido asumís hoy?
                      </h1>
                      <p
                        id="rampage-setup-description"
                        className="mt-1.5 max-w-md text-sm leading-6 text-[var(--color-rampage-muted)]"
                      >
                        Dictá con tu voz o escribí tu intención. Generamos el set en un único
                        llamado directo y lo reproducimos toda la noche desde caché.
                      </p>
                    </div>

                    <ElasticContainer className="mt-5">
                      {/* Paso 1: Calibración de huella vocal (Se omite automáticamente si el perfil ya está calibrado) */}
                      <AnimatePresence initial={false}>
                        {showCalibrationStep && (
                          <motion.div
                            key="step-1-voice-calibration"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={APPLE_ELASTIC_SPRING}
                            className="rampage-surface mb-4 flex flex-col gap-3 rounded-[16px] p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-rampage-line)] text-[var(--color-rampage-accent)]">
                                <Mic size={17} aria-hidden="true" />
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-[var(--color-rampage-accent)]">
                                  Paso 1 · Huella vocal pendiente
                                </p>
                                <p className="mt-0.5 text-xs leading-5 text-[var(--color-rampage-muted)]">
                                  Grabá unas frases breves para clonar tu timbre o continuá con la
                                  voz base del santuario.
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {onOpenCalibration && (
                                <button
                                  type="button"
                                  onClick={onOpenCalibration}
                                  className="rampage-control inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-semibold"
                                >
                                  <Mic size={14} aria-hidden="true" />
                                  Calibrar voz
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleStartRampage();
                        }}
                      >
                        {/* Selector de 3 Modos de Rampage (Segmented Control estilo iOS) */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              Longitud del bucle subliminal
                            </span>
                            <span className="text-xs text-[var(--color-rampage-muted)]">
                              1 llamada JSON · Bucle infinito
                            </span>
                          </div>

                          <div
                            role="radiogroup"
                            aria-label="Longitud del bucle subliminal"
                            className="rampage-surface relative grid grid-cols-3 gap-1 rounded-[16px] p-1"
                          >
                            {RAMPAGE_MODE_OPTIONS.map((option) => {
                              const isSelected = selectedCount === option.count;
                              return (
                                <button
                                  key={option.count}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  data-testid={`rampage-mode-${option.count}`}
                                  onClick={() => setSelectedCount(option.count)}
                                  className={`relative z-10 flex min-h-[3.25rem] flex-col items-center justify-center rounded-[12px] px-2 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-rampage-accent)] ${
                                    isSelected
                                      ? 'font-semibold text-[var(--color-rampage-ink)]'
                                      : ' font-medium text-[var(--color-rampage-muted)] hover:text-[var(--color-rampage-ink)]'
                                  }`}
                                >
                                  {isSelected && (
                                    <motion.span
                                      layoutId="rampageModePill"
                                      transition={APPLE_ELASTIC_SPRING}
                                      className="pointer-events-none absolute inset-0 -z-10 rounded-[12px] border border-[var(--color-rampage-line)] bg-[var(--color-rampage-surface-strong)]"
                                    />
                                  )}
                                  <span className="text-xs font-semibold leading-tight sm:text-sm">
                                    {option.count === 5
                                      ? 'Corto · 5'
                                      : option.count === 11
                                        ? 'Óptimo · 11'
                                        : 'Profundo · 15'}
                                  </span>
                                  <span className="mt-0.5 text-[11px] leading-tight text-[var(--color-rampage-muted)]">
                                    {option.count} afirmaciones
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <p className="text-xs text-[var(--color-rampage-muted)]">
                            {
                              RAMPAGE_MODE_OPTIONS.find((item) => item.count === selectedCount)
                                ?.description
                            }
                          </p>
                        </div>

                        {/* Tema central con dictado por voz (gemini-3.5-transcript) */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <label htmlFor="rampage-topic" className="text-sm font-medium">
                              Tema central o intención
                            </label>
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="text-[11px] tabular-nums text-[var(--color-rampage-muted)]"
                              >
                                {draftTitle.length}/120
                              </span>
                              <VoiceDictationButton
                                size="sm"
                                className="h-9 w-9 rounded-full"
                                onTranscript={(text) => {
                                  setDraftTitle((prev) =>
                                    prev ? `${prev} ${text}`.slice(0, 120) : text.slice(0, 120)
                                  );
                                  setSetupError('');
                                }}
                                previousTextTail={draftTitle}
                              />
                            </div>
                          </div>
                          <input
                            id="rampage-topic"
                            required
                            maxLength={120}
                            value={draftTitle}
                            onChange={(event) => {
                              setDraftTitle(event.target.value);
                              setSetupError('');
                            }}
                            placeholder="Ej. Soy Dios, SP me ama y soy siempre su prioridad"
                            className="rampage-surface rampage-field w-full rounded-[12px] px-4 py-3 text-base text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)]"
                          />
                        </div>

                        {/* Matices con dictado por voz (gemini-3.5-transcript) */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <label htmlFor="rampage-details" className="text-sm font-medium">
                              Matices, SP o vínculos{' '}
                              <span className="font-normal text-[var(--color-rampage-muted)]">
                                (opcional)
                              </span>
                            </label>
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="text-[11px] tabular-nums text-[var(--color-rampage-muted)]"
                              >
                                {draftDetails.length}/1000
                              </span>
                              <VoiceDictationButton
                                size="sm"
                                className="h-9 w-9 rounded-full"
                                onTranscript={(text) =>
                                  setDraftDetails((prev) =>
                                    prev ? `${prev} ${text}`.slice(0, 1000) : text.slice(0, 1000)
                                  )
                                }
                                previousTextTail={draftDetails}
                              />
                            </div>
                          </div>
                          <textarea
                            id="rampage-details"
                            maxLength={1000}
                            rows={2}
                            value={draftDetails}
                            onChange={(event) => setDraftDetails(event.target.value)}
                            placeholder="Ej. Nombre de SP, autoconcepto de pedestal, vínculo libre o escena cumplida."
                            className="rampage-surface rampage-field w-full resize-y rounded-[12px] px-4 py-2.5 text-base leading-6 text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)]"
                          />
                        </div>

                        {/* Atmósfera de fondo Web Audio API */}
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">Atmósfera nocturna continua</span>
                          <div
                            role="group"
                            aria-label="Atmósfera nocturna continua"
                            className="grid grid-cols-3 gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => setAmbientSound('none')}
                              aria-pressed={ambientSound === 'none'}
                              className="rampage-control inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-medium sm:text-sm"
                            >
                              <VolumeX size={15} aria-hidden="true" />
                              Silencio
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmbientSound('white_noise')}
                              aria-pressed={ambientSound === 'white_noise'}
                              className="rampage-control inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-medium sm:text-sm"
                            >
                              <Radio size={15} aria-hidden="true" />
                              Ruido blanco
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmbientSound('astral_rain')}
                              aria-pressed={ambientSound === 'astral_rain'}
                              className="rampage-control inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-medium sm:text-sm"
                            >
                              <CloudRain size={15} aria-hidden="true" />
                              Lluvia
                            </button>
                          </div>
                        </div>

                        {setupError ? (
                          <p role="alert" className="text-sm text-[var(--color-danger)]">
                            {setupError}
                          </p>
                        ) : null}

                        <div className="mt-1 flex flex-col gap-2">
                          <button
                            type="submit"
                            data-testid="rampage-start-button"
                            className="rampage-setup-submit inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold text-[var(--color-rampage-accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-rampage-accent)]"
                          >
                            <Sparkles size={18} aria-hidden="true" />
                            Iniciar Rampage ({selectedCount} afirmaciones)
                          </button>
                        </div>
                      </form>
                    </ElasticContainer>
                  </div>
                </main>
              )}

              {/* Paso 3: Modal estilo iOS para Conservar en el Santuario (0 gasto API futuro) o Descartar */}
              <AnimatePresence>
                {isSaveDecisionOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                    onClick={() => setIsSaveDecisionOpen(false)}
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      transition={APPLE_ELASTIC_SPRING}
                      onClick={(event) => event.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="rampage-save-decision-title"
                      className="rampage-surface w-full max-w-md rounded-[24px] border border-[var(--color-rampage-line)] p-6 text-[var(--color-rampage-ink)] shadow-2xl"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-rampage-line)] text-[var(--color-rampage-accent)]">
                          <BookmarkCheck size={20} aria-hidden="true" />
                        </span>
                        <div>
                          <h3
                            id="rampage-save-decision-title"
                            className="text-lg font-semibold leading-tight"
                          >
                            ¿Conservar este Set en tu Santuario?
                          </h3>
                          <p className="mt-1.5 text-sm leading-5 text-[var(--color-rampage-muted)]">
                            Las {affirmationQueue.length} afirmaciones y sus voces ya quedaron
                            cacheadas ({cachedCount} audios en memoria). Podrás re-escucharlo
                            cualquier noche con 0 llamadas a la API.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => void handleConfirmKeepSet()}
                          className="rampage-setup-submit inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-[var(--color-rampage-accent-fg)]"
                        >
                          <BookmarkCheck size={17} aria-hidden="true" />
                          Conservar en el Santuario (0 API)
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscardSet()}
                          className="rampage-control inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-[var(--color-danger)]"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Descartar Set
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSaveDecisionOpen(false)}
                          className="inline-flex min-h-10 w-full items-center justify-center rounded-full text-xs font-medium text-[var(--color-rampage-muted)] hover:text-[var(--color-rampage-ink)]"
                        >
                          Seguir en el reproductor
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && isMinimized && (
          <motion.aside
            ref={miniPlayerRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.95 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.15, ease: EMIL_EASE_OUT }
                : {
                    type: 'spring',
                    stiffness: 420,
                    damping: 30,
                    mass: 0.9,
                    opacity: { duration: 0.18, ease: EMIL_EASE_OUT },
                  }
            }
            onPointerMove={handleMiniPlayerPointerMove}
            onPointerLeave={handleMiniPlayerPointerLeave}
            data-refract={canRefract ? 'true' : undefined}
            aria-label="Reproducción de Rampage en segundo plano"
            className="liquid-glass-player fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg items-center gap-3 rounded-[22px] p-3 pl-4 text-swiss-ink lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[min(26rem,calc(100vw-2.5rem))]"
          >
            <svg
              className="pointer-events-none absolute h-0 w-0"
              aria-hidden="true"
              focusable="false"
            >
              <filter
                id="lg-player-lens"
                x="0"
                y="0"
                width="100%"
                height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  result="lensMap"
                  href={LIQUID_GLASS_LENS_MAP}
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="lensMap"
                  scale="48"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </svg>
            <span className="lg-refract" aria-hidden="true" />
            <span className="lg-tint" aria-hidden="true" />
            <span className="lg-sheen" aria-hidden="true" />
            <span className="lg-rim" aria-hidden="true" />

            <button
              type="button"
              onClick={onRestore}
              className="lg-content min-w-0 flex-1 rounded-[12px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swiss-focus"
              aria-label={`Abrir reproductor de ${activeRampageRef.current.title}`}
            >
              <span className="block truncate text-sm font-semibold">
                {activeRampageRef.current.title}
              </span>
              <span className="lg-subtext mt-0.5 block truncate text-xs">
                {isPlaying ? currentAffirmation : 'En pausa'}
              </span>
            </button>
            <div className="lg-content hidden shrink-0 items-center sm:flex">
              <RampageAudioWaveform isPlaying={isPlaying} barCount={8} />
            </div>
            <button
              type="button"
              onClick={() => void togglePlayback()}
              aria-label={isPlaying ? 'Pausar Rampage' : 'Continuar Rampage'}
              className="lg-content lg-droplet inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-swiss-accentFg focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              {isPlaying ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} fill="currentColor" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={handleStopBackgroundPlayback}
              aria-label="Detener Rampage"
              className="lg-content lg-bubble inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <Square size={15} aria-hidden="true" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
