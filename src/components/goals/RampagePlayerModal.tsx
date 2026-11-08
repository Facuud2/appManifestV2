'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Activity,
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loopModeIndex, setLoopModeIndex] = useState(0);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const LOOP_MODES = useMemo<{ label: string; count: RampageLoopCount }[]>(
    () => [
      { label: 'Sin límite', count: 11 },
      { label: '5 frases', count: 5 },
      { label: '11 frases', count: 11 },
      { label: '15 frases', count: 15 },
    ],
    []
  );

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const profileTheme = useMemo(() => {
    if (activeScope === 'facu') {
      return {
        name: 'Facu',
        voiceLabel: 'Voz de Facu',
        bgGradient:
          'radial-gradient(ellipse at 50% 25%, #12382c 0%, #0d221b 50%, #06110d 100%)',
        orbSphere:
          'radial-gradient(circle at 35% 30%, #c2f5e1 0%, #4dd2a7 28%, #238f6b 58%, #115740 88%, #082d20 100%)',
        orbShadow:
          'inset -10px -10px 28px rgba(4, 25, 17, 0.7), inset 7px 7px 16px rgba(255, 255, 255, 0.45), 0 24px 50px -10px rgba(35, 143, 107, 0.45)',
        orbBloom:
          'radial-gradient(circle, rgba(77, 210, 167, 0.35) 0%, transparent 70%)',
        playBtnBg: 'bg-[#d1fae5] text-[#064e3b]',
        waveColor: 'bg-[#6ee7b7]',
        accentColor: '#7fd9be',
      };
    }
    if (activeScope === 'shared') {
      return {
        name: 'Maia y Facu',
        voiceLabel: currentVoiceSpeaker === 'maia' ? 'Voz de Maia' : 'Voz de Facu',
        bgGradient:
          'radial-gradient(ellipse at 50% 25%, #2c1642 0%, #190e29 50%, #0e0717 100%)',
        orbSphere:
          'radial-gradient(circle at 35% 30%, #fed7ea 0%, #c084fc 28%, #7c3aed 58%, #431497 88%, #200754 100%)',
        orbShadow:
          'inset -10px -10px 28px rgba(24, 4, 56, 0.7), inset 7px 7px 16px rgba(255, 255, 255, 0.45), 0 24px 50px -10px rgba(147, 51, 234, 0.45)',
        orbBloom:
          'radial-gradient(circle, rgba(192, 132, 252, 0.35) 0%, transparent 70%)',
        playBtnBg: 'bg-[#fae8ff] text-[#4a044e]',
        waveColor: 'bg-[#f472b6]',
        accentColor: '#f472b6',
      };
    }
    // Maia (default, exact match to screenshot)
    return {
      name: 'Maia',
      voiceLabel: 'Voz de Maia',
      bgGradient:
        'radial-gradient(ellipse at 50% 25%, #381d52 0%, #201032 50%, #130a1f 100%)',
      orbSphere:
        'radial-gradient(circle at 35% 30%, #d8b4fe 0%, #aa64fa 28%, #7934dc 58%, #4a199b 88%, #2d0c69 100%)',
      orbShadow:
        'inset -10px -10px 28px rgba(18, 5, 42, 0.7), inset 7px 7px 16px rgba(255, 255, 255, 0.45), 0 24px 50px -10px rgba(121, 52, 220, 0.45)',
      orbBloom:
        'radial-gradient(circle, rgba(170, 100, 250, 0.35) 0%, transparent 70%)',
      playBtnBg: 'bg-[#ece2f7] text-[#2c1242]',
      waveColor: 'bg-[#d8b4fe]',
      accentColor: '#c084fc',
    };
  }, [activeScope, currentVoiceSpeaker]);

  const handleCycleLoopMode = () => {
    setLoopModeIndex((prev) => {
      const next = (prev + 1) % LOOP_MODES.length;
      setSelectedCount(LOOP_MODES[next].count);
      return next;
    });
  };

  const handleToggleSpeaker = () => {
    if (!isCurrentProfileCalibrated) {
      onOpenCalibration?.();
      return;
    }
    if (isFacuCalibrated && isMaiaCalibrated) {
      setCurrentVoiceSpeaker((prev) => (prev === 'maia' ? 'facu' : 'maia'));
    } else if (onOpenCalibration) {
      onOpenCalibration();
    }
  };

  const handleCycleAmbient = () => {
    const AMBIENT_OPTIONS: AmbientSoundType[] = ['none', 'white_noise', 'astral_rain'];
    const currentIndex = AMBIENT_OPTIONS.indexOf(ambientSound);
    const nextIndex = (currentIndex + 1) % AMBIENT_OPTIONS.length;
    const nextAmbience = AMBIENT_OPTIONS[nextIndex];
    setAmbientSound(nextAmbience);
    if (audioEngine) {
      if (nextAmbience === 'none') {
        audioEngine.stopAmbience();
      } else if (isPlaying) {
        audioEngine.setAmbience(nextAmbience as AmbienceType);
      }
    }
  };

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
    generatedAudioPromisesRef.current.clear();
    setPhrasesHeardCount(0);
    setCompletedCyclesCount(0);
    setElapsedSeconds(0);
    setCachedCount(generatedAudioCacheRef.current.size);
    setIsBreathingPause(false);
    setBreathingPauseMs(0);
    setPlaybackError('');
    setGenerationError('');
    setAudioPreparationWarning('');
    setSetupError('');
    setDraftTitle(centralTheme || 'Rampage Nocturno');
    setDraftDetails('');
    setSelectedCount(11);
    setIsSaveDecisionOpen(false);
    setIsSavedToSanctuary(false);
    setIsAwaitingVoiceCalibration(false);
    isNewSessionRef.current = false;
    activeRampageRef.current = { title: centralTheme || 'Rampage Nocturno', details: '', count: 11 };
    activeRampageScopeRef.current = activeScopeRef.current;
    activeProfileAffirmationsRef.current = profileAffirmationsRef.current;
    activeProfileManifestationsRef.current = profileManifestationsRef.current;
    activeProfileRampagesRef.current = profileRampagesRef.current;
    activeRampageSetRef.current = resumeRampage || null;

    const userProfileAffs = userSavedAffirmationsRef.current
      .filter((a) => a.userId === activeScopeRef.current)
      .map((a) => a.text.trim())
      .filter(Boolean);

    const fallbackAffs =
      userProfileAffs.length > 0
        ? userProfileAffs
        : [
            'Estoy a salvo recibiendo todo lo que deseo.',
            'Soy dueño de mi propia realidad.',
            'Todo lo que anhelo me busca y me encuentra.',
            'Mi atención crea mundos y descanso en mi paz.',
            'Soy amado, deseado y plenamente valorado.',
            'Tengo todo lo que deseo y todo lo que deseo me desea más a mí.',
            'El universo responde con fidelidad a lo que asumo.',
            'Mi estado cumplido es mi única verdad.',
            'Vivo en la plenitud de lo que ya es un hecho.',
            'Descanso con la certeza de que todo está resuelto.',
            'Soy la versión que ya tiene todo lo soñado.',
          ];

    const initialQueue =
      resumeRampage && resumeRampage.affirmations.length > 0
        ? resumeRampage.affirmations.map((a) => a.text.trim()).filter(Boolean)
        : fallbackAffs;

    affirmationQueueRef.current = initialQueue;
    baseAffirmationsRef.current = initialQueue;
    setAffirmationQueue(initialQueue);
    setCurrentAffirmationIndex(0);
    setHasStarted(true);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentVoiceSpeaker(getSpeakerForText(initialQueue[0] || '', 0));
    void preloadSetStaggered(initialQueue);
  }, [centralTheme, getSpeakerForText, isMinimized, isOpen, openMode, preloadSetStaggered, resumeRampage]);

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
            className="rampage-overlay fixed inset-0 z-50 flex w-screen items-center justify-center overflow-y-auto bg-black/60 p-0 sm:p-4 backdrop-blur-md"
          >
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.98,
                y: 8,
                transition: { duration: 0.18, ease: EMIL_EASE_OUT },
              }}
              transition={APPLE_ELASTIC_SPRING}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleDialogKeyDown}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rampage-title"
              tabIndex={-1}
              className="relative flex h-full max-h-dvh w-full flex-col justify-between overflow-hidden sm:h-[min(92dvh,760px)] sm:max-h-[760px] sm:max-w-[430px] rounded-[32px] sm:rounded-[36px] border border-white/10 sm:border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.7)] p-6 sm:p-7 select-none"
              style={{
                background: profileTheme.bgGradient,
              }}
            >
              {/* Header: Moon + RAMPAGE NOCTURNO and Close X button */}
              <header className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Moon size={14} className="text-white/70" aria-hidden="true" />
                  <span
                    id="rampage-title"
                    className="text-[11px] font-semibold tracking-[0.16em] uppercase text-white/70"
                  >
                    RAMPAGE NOCTURNO
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Cerrar reproductor"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all active:scale-95"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              {/* Center Content: Orb, Eyebrow, Affirmation, Waveform, Play Button */}
              <div className="my-auto flex flex-col items-center">
                {/* 3D Illuminated Celestial Orb */}
                <div className="relative flex items-center justify-center mb-6 sm:mb-8">
                  {/* Soft ambient bloom */}
                  <div
                    className="pointer-events-none absolute h-48 w-48 rounded-full blur-2xl opacity-40 transition-all duration-700"
                    style={{ background: profileTheme.orbBloom }}
                    aria-hidden="true"
                  />
                  {/* 3D Sphere */}
                  <motion.div
                    animate={
                      !prefersReducedMotion
                        ? {
                            scale: isPlaying ? [1, 1.045, 1] : [1, 1.02, 1],
                            y: isPlaying ? [0, -3, 0] : [0, -1.5, 0],
                          }
                        : { scale: 1, y: 0 }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: isPlaying ? 3.4 : 4.8,
                      ease: 'easeInOut',
                    }}
                    className="relative h-36 w-36 sm:h-40 sm:w-40 rounded-full transition-all duration-500"
                    style={{
                      background: profileTheme.orbSphere,
                      boxShadow: profileTheme.orbShadow,
                    }}
                  />
                </div>

                {/* Eyebrow Status */}
                <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-white/50 text-center mb-3">
                  {isPlaying
                    ? 'REPRODUCIENDO CON TU VOZ'
                    : isSynthesizing
                      ? 'SINTETIZANDO VOZ…'
                      : 'LISTO PARA VOS'}
                </p>

                {/* Affirmation Quote */}
                <div className="min-h-[5.5rem] flex items-center justify-center px-2">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h1
                      key={`${currentAffirmationIndex}_${currentAffirmation}`}
                      id="rampage-affirmation"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
                      className="text-2xl sm:text-[25px] font-semibold text-white tracking-tight leading-snug max-w-[20ch] mx-auto text-center"
                    >
                      “{currentAffirmation}”
                    </motion.h1>
                  </AnimatePresence>
                </div>

                {/* Waveform & Time counter */}
                <div className="mt-4 flex flex-col items-center">
                  <RampageAudioWaveform
                    isPlaying={isPlaying}
                    barCount={13}
                    barColorClassName={profileTheme.waveColor}
                  />
                  <span className="font-mono text-xs text-white/50 tracking-wider text-center mt-2.5 tabular-nums">
                    {formattedTimer}
                  </span>
                </div>

                {/* Circular Play / Pause Button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'Pausar Rampage' : 'Reproducir Rampage'}
                  className={`mt-5 flex h-[66px] w-[66px] items-center justify-center rounded-full ${profileTheme.playBtnBg} shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-transform`}
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
                        <Play size={25} fill="currentColor" className="ml-1" aria-hidden="true" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Bottom 3 Pill Controls */}
              <footer className="flex items-center justify-center gap-2 pb-2">
                {/* Pill 1: Duration / Loop Mode */}
                <button
                  type="button"
                  onClick={handleCycleLoopMode}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-white/[0.13] active:scale-95 transition-all"
                  title="Cambiar modo de bucle"
                >
                  <Moon size={13} className="text-white/70" aria-hidden="true" />
                  <span>{LOOP_MODES[loopModeIndex].label}</span>
                </button>

                {/* Pill 2: Voice Speaker */}
                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-white/[0.13] active:scale-95 transition-all"
                  title="Cambiar o calibrar voz"
                >
                  <Activity size={13} className="text-white/70" aria-hidden="true" />
                  <span>{profileTheme.voiceLabel}</span>
                </button>

                {/* Pill 3: Ambient Sound */}
                <button
                  type="button"
                  onClick={handleCycleAmbient}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-white/[0.13] active:scale-95 transition-all"
                  title={`Cambiar sonido ambiente (${ambientSound})`}
                >
                  <Sun size={13} className="text-white/70" aria-hidden="true" />
                  <span>Ambiente</span>
                </button>
              </footer>

              {/* Intention Customizer Modal / Drawer */}
              <AnimatePresence>
                {isCustomizerOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60 backdrop-blur-sm p-4"
                  >
                    <motion.div
                      initial={{ y: 80, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 80, opacity: 0 }}
                      transition={APPLE_ELASTIC_SPRING}
                      className="rampage-surface rounded-[24px] border border-white/15 p-5 text-white shadow-2xl"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-[var(--color-rampage-accent)]" />
                          <h3 className="text-sm font-semibold">Personalizar tu Rampage</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCustomizerOpen(false)}
                          className="rounded-full p-1 text-white/70 hover:bg-white/10"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 text-left">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="custom-topic" className="text-xs font-medium text-white/80">
                              Tema central o intención
                            </label>
                            <VoiceDictationButton
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              onTranscript={(text) => {
                                setDraftTitle((prev) => (prev ? `${prev} ${text}` : text));
                              }}
                              previousTextTail={draftTitle}
                            />
                          </div>
                          <input
                            id="custom-topic"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            placeholder="Ej. Soy Dios, recibiendo todo lo que deseo"
                            className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                          />
                        </div>

                        <div>
                          <label htmlFor="custom-details" className="text-xs font-medium text-white/80 mb-1 block">
                            Matices o nombres (opcional)
                          </label>
                          <textarea
                            id="custom-details"
                            rows={2}
                            value={draftDetails}
                            onChange={(e) => setDraftDetails(e.target.value)}
                            placeholder="Detalles sobre autoconcepto, vínculos o hechos cumplidos"
                            className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-white/70">Longitud:</span>
                          <div className="flex gap-1">
                            {([5, 11, 15] as RampageLoopCount[]).map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setSelectedCount(count)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  selectedCount === count
                                    ? 'bg-white text-black font-semibold'
                                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                                }`}
                              >
                                {count} frases
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            setIsCustomizerOpen(false);
                            await handleStartRampage();
                          }}
                          className={`w-full py-2.5 rounded-full ${profileTheme.playBtnBg} text-xs font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all mt-2`}
                        >
                          Generar con IA y Reproducir
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>


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
