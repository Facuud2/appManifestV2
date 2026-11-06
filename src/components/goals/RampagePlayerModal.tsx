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
  Square,
  Sun,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { audioEngine, AmbienceType } from '@/lib/audioEngine';
import { EMIL_EASE_OUT, IOS_TAP_SPRING } from '@/lib/iosSprings';
import type {
  RampageHistoryContext,
  RampageManifestationContext,
} from '@/lib/affirmationEngine';
import { RampageSet, UserScope } from '@/types';
import { RampageAudioWaveform } from './RampageAudioWaveform';

interface RampagePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  openMode: 'new' | 'restore';
  resumeRampage: RampageSet | null;
  resumeRequestId: number;
  centralTheme?: string;
  onPlaybackChange?: (isPlaying: boolean, currentAffirmation?: string) => void;
  registerTogglePlayback?: (toggleFn: () => void) => void;
}

const RAMPAGE_BATCH_SIZE = 3;

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
  </svg>`,
)}`;

export const RampagePlayerModal: React.FC<RampagePlayerModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  openMode,
  resumeRampage,
  resumeRequestId,
  centralTheme = '',
  onPlaybackChange,
  registerTogglePlayback,
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
    saveRampageSet,
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
  const [isMinimized, setIsMinimized] = useState(false);
  // Liquid Glass lensing needs SVG filters inside backdrop-filter (Chromium only).
  const [canRefract, setCanRefract] = useState(false);
  const miniPlayerRef = useRef<HTMLElement | null>(null);
  const [draftTitle, setDraftTitle] = useState(centralTheme);
  const [draftDetails, setDraftDetails] = useState('');
  const [setupError, setSetupError] = useState('');
  const [audioPreparationWarning, setAudioPreparationWarning] = useState('');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const ua = navigator.userAgent;
    setCanRefract(/Chrome\/\d+/.test(ua) && !/CriOS|FxiOS/.test(ua));
  }, []);

  // Specular sheen follows the pointer without re-rendering React.
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
  const activeRampageSetRef = useRef<RampageSet | null>(null);
  const activeRampageScopeRef = useRef<UserScope>(activeScope);
  const activeProfileAffirmationsRef = useRef<string[]>([]);
  const activeProfileManifestationsRef = useRef<RampageManifestationContext[]>([]);
  const activeProfileRampagesRef = useRef<RampageHistoryContext[]>([]);
  const resumeAutoPlayRef = useRef(false);
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
      if (activeRampageScopeRef.current === 'maia') return 'maia';
      if (activeRampageScopeRef.current === 'facu') return 'facu';
      if (isMaiaCalibrated && !isFacuCalibrated) return 'maia';
      if (!isMaiaCalibrated) return 'facu';
      return index % 2 === 0 ? 'facu' : 'maia';
    },
    [isFacuCalibrated, isMaiaCalibrated]
  );

  const profileAffirmations = userSavedAffirmations
    .filter((affirmation) => activeScope === 'shared' || affirmation.userId === activeScope)
    .slice(0, 20)
    .map((affirmation) => affirmation.text);
  const profileManifestations: RampageManifestationContext[] = userManifestations
    .filter(
      (manifestation) => activeScope === 'shared' || manifestation.userId === activeScope
    )
    .slice(0, 15)
    .map((manifestation) => ({
      title: manifestation.title,
      description: manifestation.description,
      status: manifestation.status,
      category: manifestation.category,
    }));
  const profileRampages: RampageHistoryContext[] = userRampageSets
    .filter((rampage) => activeScope === 'shared' || rampage.userId === activeScope)
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
              userScope: activeRampageScopeRef.current,
              userAffirmations: activeProfileAffirmationsRef.current,
              userManifestations: activeProfileManifestationsRef.current,
              userRampages: activeProfileRampagesRef.current,
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
          const previousSet = replaceQueue ? null : activeRampageSetRef.current;
          const rampageSet = await saveRampageSet({
            ...(previousSet
              ? { id: previousSet.id, createdAt: previousSet.createdAt }
              : {}),
            userId: activeRampageScopeRef.current,
            author:
              activeRampageScopeRef.current === 'maia'
                ? 'Maia'
                : activeRampageScopeRef.current === 'facu'
                  ? 'Facu'
                  : 'Ambos',
            title: activeRampageRef.current.title,
            affirmations: [
              ...(previousSet?.affirmations || []),
              ...generated.map((text, index) => ({
                id: `${Date.now()}_${batchStartIndex + index}`,
                text,
                repeatCount: 0,
              })),
            ],
            ambientSound,
            isFavorite: previousSet?.isFavorite || false,
          });
          activeRampageSetRef.current = rampageSet;
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
            activeRampageRef.current.title &&
            !generationFailedRef.current
          ) {
            void fetchMoreAffirmationsRef.current?.();
          }
        }
      }
    },
    [ambientSound, getSpeakerForIndex, isOpen, prepareAudio, saveRampageSet]
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
      if (isMinimized) return;
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
      activeRampageSetRef.current = null;
      return;
    }

    if (openMode === 'restore') {
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
    activeRampageScopeRef.current = activeScopeRef.current;
    activeProfileAffirmationsRef.current = profileAffirmationsRef.current;
    activeProfileManifestationsRef.current = profileManifestationsRef.current;
    activeProfileRampagesRef.current = profileRampagesRef.current;
    activeRampageSetRef.current = null;
    setHasStarted(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    generationFailedRef.current = false;
    setCurrentVoiceSpeaker(getSpeakerForIndex(0));
  }, [centralTheme, getSpeakerForIndex, isMinimized, isOpen, openMode]);

  useEffect(() => {
    if (!resumeRampage || resumeRequestId === 0) return;
    const affirmations = resumeRampage.affirmations
      .map((affirmation) => affirmation.text.trim())
      .filter(Boolean);
    if (affirmations.length === 0) return;

    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    batchLoadPromiseRef.current = null;
    batchLoadingRef.current = false;
    pendingBatchRequestRef.current = false;
    audioPreparationControllersRef.current.forEach((controller) => controller.abort());
    audioPreparationControllersRef.current.clear();
    generatedAudioPromisesRef.current.clear();
    if (nextAffirmationTimerRef.current !== null) {
      window.clearTimeout(nextAffirmationTimerRef.current);
      nextAffirmationTimerRef.current = null;
    }
    audioEngine?.stopVoice();
    audioEngine?.stopAmbience();
    activeRampageRef.current = { title: resumeRampage.title, details: '' };
    activeRampageScopeRef.current = resumeRampage.userId;
    activeProfileAffirmationsRef.current = userSavedAffirmationsRef.current
      .filter(
        (affirmation) =>
          resumeRampage.userId === 'shared' ||
          affirmation.userId === resumeRampage.userId
      )
      .slice(0, 20)
      .map((affirmation) => affirmation.text);
    activeProfileManifestationsRef.current = userManifestationsRef.current
      .filter(
        (manifestation) =>
          resumeRampage.userId === 'shared' ||
          manifestation.userId === resumeRampage.userId
      )
      .slice(0, 15)
      .map((manifestation) => ({
        title: manifestation.title,
        description: manifestation.description,
        status: manifestation.status,
        category: manifestation.category,
      }));
    activeProfileRampagesRef.current = userRampageSetsRef.current
      .filter(
        (rampage) =>
          resumeRampage.userId === 'shared' ||
          rampage.userId === resumeRampage.userId
      )
      .slice(0, 5)
      .map((rampage) => ({
        title: rampage.title,
        affirmations: rampage.affirmations
          .slice(0, 12)
          .map((affirmation) => affirmation.text),
      }))
      .filter((rampage) => rampage.affirmations.length > 0);
    activeRampageSetRef.current = resumeRampage;
    affirmationQueueRef.current = affirmations;
    generatedAudioCacheRef.current.clear();
    setAffirmationQueue(affirmations);
    setCurrentAffirmationIndex(0);
    setLoopCount(0);
    setPlaybackError('');
    setGenerationError('');
    setIsLoadingNextBatch(false);
    setIsSynthesizing(false);
    setAudioPreparationWarning('');
    setHasStarted(true);
    setIsMinimized(true);
    setIsPlaying(true);
    isPlayingRef.current = true;
    resumeAutoPlayRef.current = true;
    generationFailedRef.current = false;
    setCurrentVoiceSpeaker(getSpeakerForIndex(0));
  }, [getSpeakerForIndex, resumeRampage, resumeRequestId]);

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

    const handleNext = () => {
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
    };

    let audio: AudioBuffer | null = null;
    try {
      audio = await prepareAudio(text, speaker);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('[Rampage] No se pudo obtener audio de Gemini (ej. 429), usando síntesis del navegador:', error);
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
            { gender: speaker === 'maia' ? 'female' : 'male', rate: 0.88 },
            handleNext
          );
          if (!spoke) {
            nextAffirmationTimerRef.current = window.setTimeout(handleNext, 3000);
          }
        }
      );
    } else {
      // Fallback: Gemini TTS no disponible (429 Too Many Requests, sin cuota o sin conexión)
      setAudioPreparationWarning('Gemini ocupado (429). Reproduciendo con voz del navegador');
      const spoke = audioEngine.speakVoice(
        text,
        {
          gender: speaker === 'maia' ? 'female' : 'male',
          rate: 0.88,
        },
        handleNext
      );
      if (!spoke) {
        nextAffirmationTimerRef.current = window.setTimeout(handleNext, 3500);
      }
    }
  };

  useEffect(() => {
    if (!resumeAutoPlayRef.current || affirmationQueue.length === 0 || !hasStarted) return;
    resumeAutoPlayRef.current = false;
    void playCurrentItem(0);
  }, [affirmationQueue, hasStarted, resumeRequestId]);

  const togglePlayback = async () => {
    if (!audioEngine) return;
    await audioEngine.unlock(); // taste-skill-ignore: Resume the audio context from the user's playback gesture.

    let queue = affirmationQueueRef.current;

    // Si la cola está vacía, inicializar desde el último Rampage disponible
    if (queue.length === 0) {
      const targetRampage = resumeRampage || userRampageSetsRef.current[0];
      if (targetRampage && targetRampage.affirmations.length > 0) {
        const affirmations = targetRampage.affirmations
          .map((a) => a.text.trim())
          .filter(Boolean);
        if (affirmations.length > 0) {
          activeRampageRef.current = { title: targetRampage.title, details: '' };
          activeRampageSetRef.current = targetRampage;
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
    activeRampageScopeRef.current = activeScopeRef.current;
    activeProfileAffirmationsRef.current = profileAffirmationsRef.current;
    activeRampageSetRef.current = null;
    setSetupError('');
    setHasStarted(true);
    setCurrentAffirmationIndex(0);
    setPlaybackError('');
    setGenerationError('');
    generationFailedRef.current = false;
    void fetchMoreAffirmations(true);
  };

  function handleClose() {
    if (hasStarted) {
      setIsMinimized(true);
      onClose();
      return;
    }

    handleStopBackgroundPlayback();
  }

  function handleStopBackgroundPlayback() {
    playbackRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    batchLoadingRef.current = false;
    batchLoadPromiseRef.current = null;
    pendingBatchRequestRef.current = false;
    activeRampageRef.current = { title: '', details: '' };
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
    setIsLoadingNextBatch(false);
    setIsSynthesizing(false);
    setHasStarted(false);
    setIsMinimized(false);
    setAffirmationQueue([]);
    affirmationQueueRef.current = [];
    onClose();
  }

  const currentAffirmation =
    affirmationQueue[currentAffirmationIndex] || 'Preparando tu próxima afirmación...';
  const statusLabel = playbackError
    ? 'No se pudo reproducir el audio'
    : isSynthesizing
      ? 'Preparando la voz de este perfil…'
      : isPlaying
        ? 'Sonando ahora'
        : isLoadingNextBatch
          ? affirmationQueue.length === 0
            ? 'Creando afirmaciones naturales…'
            : 'Preparando el siguiente lote de voces…'
          : generationError && affirmationQueue.length === 0
            ? 'No se pudieron preparar las frases'
            : 'Listo para empezar';
  const waveBars = Array.from({ length: 19 }, (_, index) => index);

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
            className="rampage-player flex h-dvh max-h-dvh w-full flex-col overflow-hidden sm:h-[min(94dvh,860px)] sm:max-h-[min(94dvh,860px)] sm:max-w-5xl sm:rounded-[var(--radius-modal)] sm:border sm:border-[var(--color-rampage-line)] sm:shadow-[var(--shadow-rampage-panel)]"
          >
            <header className="safe-area-top flex shrink-0 items-center justify-between gap-4 px-5 pb-4 sm:px-8 sm:pt-3">
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
              <div className="relative mb-4 flex h-52 w-52 items-center justify-center sm:mb-7 sm:h-72 sm:w-72">
                <div aria-hidden="true" className="rampage-orb-bloom">
                  <span className="rampage-orb-bloom-a" />
                  <span className="rampage-orb-bloom-b" />
                  <span className="rampage-orb-bloom-c" />
                </div>
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
                  className="rampage-orb-core relative flex h-28 w-28 items-center justify-center rounded-full sm:h-36 sm:w-36"
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
              <div className="flex min-h-[5rem] max-w-2xl items-center justify-center sm:min-h-[6.5rem]">
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
              </div>
            </main>

            <footer className="safe-area-bottom flex shrink-0 flex-col items-center gap-4 px-5 pt-3 sm:gap-5 sm:px-8 sm:pt-4">
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
            ) : (
              <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="relative m-auto w-full max-w-lg px-5 py-7 sm:px-10 sm:py-10">
                  <div className="flex flex-col items-center text-center">
                    <div className="rampage-setup-halo mb-4 h-[5.5rem] w-[5.5rem]" aria-hidden="true">
                      <div className="rampage-orb-core rampage-setup-orb flex items-center justify-center rounded-full">
                        <Sparkles
                          size={22}
                          strokeWidth={1.5}
                          className="text-[var(--color-rampage-orb-highlight)]"
                        />
                      </div>
                    </div>
                    <p className="rampage-setup-eyebrow">Nueva sesión</p>
                    <h1 className="mt-2 text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-3xl">
                      ¿En qué querés enfocarte?
                    </h1>
                    <p
                      id="rampage-setup-description"
                      className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-rampage-muted)]"
                    >
                      El título guía las afirmaciones. Sumá detalles si querés ajustar el tono de tu sesión.
                    </p>
                  </div>

                  <form
                    className="mt-7 flex flex-col gap-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleStartRampage();
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor="rampage-topic" className="text-sm font-medium">
                          Título del Rampage
                        </label>
                        <span
                          aria-hidden="true"
                          className="text-[11px] tabular-nums text-[var(--color-rampage-muted)]"
                        >
                          {draftTitle.length}/120
                        </span>
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
                        placeholder="Por ejemplo: Mi identidad"
                        className="rampage-surface rampage-field w-full rounded-[12px] px-4 py-3 text-base text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)]"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor="rampage-details" className="text-sm font-medium">
                          Detalles{' '}
                          <span className="font-normal text-[var(--color-rampage-muted)]">
                            (opcional)
                          </span>
                        </label>
                        <span
                          aria-hidden="true"
                          className="text-[11px] tabular-nums text-[var(--color-rampage-muted)]"
                        >
                          {draftDetails.length}/1000
                        </span>
                      </div>
                      <textarea
                        id="rampage-details"
                        maxLength={1000}
                        rows={3}
                        value={draftDetails}
                        onChange={(event) => setDraftDetails(event.target.value)}
                        placeholder="Sumá matices, personas o situaciones que quieras incluir."
                        className="rampage-surface rampage-field w-full resize-y rounded-[12px] px-4 py-3 text-base leading-6 text-[var(--color-rampage-ink)] placeholder:text-[var(--color-rampage-muted)]"
                      />
                    </div>

                    {setupError ? (
                      <p role="alert" className="text-sm text-[var(--color-danger)]">
                        {setupError}
                      </p>
                    ) : null}

                    <div className="mt-1 flex flex-col gap-2.5">
                      <button
                        type="submit"
                        className="rampage-setup-submit inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold text-[var(--color-rampage-accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-rampage-accent)]"
                      >
                        <Sparkles size={18} aria-hidden="true" />
                        Crear Rampage
                      </button>
                      <p className="text-center text-xs text-[var(--color-rampage-muted)]">
                        Vas a poder pausar y retomar la sesión cuando quieras.
                      </p>
                    </div>
                  </form>
                </div>
              </main>
            )}
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
              : { type: 'spring', stiffness: 420, damping: 30, mass: 0.9, opacity: { duration: 0.18, ease: EMIL_EASE_OUT } }
          }
          onPointerMove={handleMiniPlayerPointerMove}
          onPointerLeave={handleMiniPlayerPointerLeave}
          data-refract={canRefract ? 'true' : undefined}
          aria-label="Reproducción de Rampage en segundo plano"
          className="liquid-glass-player fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg items-center gap-3 rounded-[22px] p-3 pl-4 text-swiss-ink lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[min(26rem,calc(100vw-2.5rem))]"
        >
          {/* Lens map: neutral grey centre, red/green ramps toward the edges bend the backdrop like thick glass. */}
          <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
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
          <div className="lg-content hidden shrink-0 sm:flex items-center">
            <RampageAudioWaveform isPlaying={isPlaying} barCount={8} />
          </div>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            aria-label={isPlaying ? 'Pausar Rampage' : 'Continuar Rampage'}
            className="lg-content lg-droplet inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-swiss-accentFg focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
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
