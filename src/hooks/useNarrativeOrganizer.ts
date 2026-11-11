'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import {
  connectAudioAnalyser,
  createSafeMediaRecorder,
  getMicrophoneStream,
} from '@/lib/microphone';
import { useAppStore } from '@/store';
import {
  countProposedItems,
  NARRATIVE_SCENARIOS,
  type ExistingContextItem,
  type ExistingAffirmationItem,
  type NarrativeCommitResult,
  type NarrativeDraft,
  type NarrativeScenario,
} from '@/lib/narrativeOrganizer';

export type NarrativePhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'review'
  | 'committing'
  | 'success'
  | 'error';

export type NarrativeErrorKind = 'analyze' | 'commit' | 'microphone' | 'quota';

interface UseNarrativeOrganizerProps {
  profileId: string;
  existingContext: ExistingContextItem[];
  existingAffirmations?: ExistingAffirmationItem[];
  isSandboxMode?: boolean;
  onOpenManualCreate: () => void;
  onCommitted?: (
    result: NarrativeCommitResult,
    saveRampage: boolean,
    draft: NarrativeDraft
  ) => void;
  onClosed?: () => void;
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readSandboxScenario(): NarrativeScenario | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fromStorage = window.localStorage.getItem('manifest_narrative_scenario');
    const fromUrl = new URLSearchParams(window.location.search).get('narrativeScenario');
    const scenario = fromUrl || fromStorage;
    if (scenario && (NARRATIVE_SCENARIOS as readonly string[]).includes(scenario)) {
      return scenario as NarrativeScenario;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function readSandboxSpeech(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('manifest_narrative_speech') || '';
  } catch {
    return '';
  }
}

export function useNarrativeOrganizer({
  profileId,
  existingContext,
  existingAffirmations,
  isSandboxMode = false,
  onOpenManualCreate,
  onCommitted,
  onClosed,
}: UseNarrativeOrganizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<NarrativePhase>('idle');
  const [draft, setDraft] = useState<NarrativeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<NarrativeErrorKind | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const isOpenRef = useRef(false);
  const phaseRef = useRef<NarrativePhase>('idle');
  const draftRef = useRef<NarrativeDraft | null>(null);
  const draftIdRef = useRef('');
  const isMountedRef = useRef(true);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const vadIntervalRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const isLongPressActiveRef = useRef(false);
  const spacePressTimerRef = useRef<number | null>(null);
  const isSpaceHoldingRef = useRef(false);
  const ignoreSubmitUntilRef = useRef<number>(0);

  const profileIdRef = useRef(profileId);
  const existingContextRef = useRef(existingContext);
  const existingAffirmationsRef = useRef(existingAffirmations);
  const callbacksRef = useRef({ onOpenManualCreate, onCommitted, onClosed });
  const isSandboxRef = useRef(isSandboxMode);

  useEffect(() => {
    profileIdRef.current = profileId;
    existingContextRef.current = existingContext;
    existingAffirmationsRef.current = existingAffirmations;
    callbacksRef.current = { onOpenManualCreate, onCommitted, onClosed };
    isSandboxRef.current = isSandboxMode;
  }, [profileId, existingContext, existingAffirmations, isSandboxMode, onOpenManualCreate, onCommitted, onClosed]);

  const setPhaseSafe = useCallback((next: NarrativePhase) => {
    phaseRef.current = next;
    if (isMountedRef.current) setPhase(next);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.onerror = null;
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    if (isMountedRef.current) setAnalyserNode(null);
  }, []);

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore
      }
      abortRef.current = null;
    }
  }, []);

  const sendAudioToServer = useCallback(
    async (audioBlob: Blob) => {
      setPhaseSafe('processing');
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const formData = new FormData();
        const ext = audioBlob.type.includes('mp4') || audioBlob.type.includes('aac') ? 'mp4' : 'webm';
        formData.append('audio', audioBlob, `narrative.${ext}`);
        formData.append('profileId', profileIdRef.current);
        formData.append('draftId', draftIdRef.current);
        formData.append('existingContext', JSON.stringify(existingContextRef.current));
        if (existingAffirmationsRef.current) {
          formData.append('existingAffirmations', JSON.stringify(existingAffirmationsRef.current));
        }
        if (draftRef.current) {
          formData.append('currentDraft', JSON.stringify(draftRef.current));
        }

        if (isSandboxRef.current) {
          formData.append('sandbox', 'true');
          const scenario = readSandboxScenario();
          if (scenario) formData.append('scenario', scenario);
          const speech = readSandboxSpeech();
          if (speech) formData.append('spokenText', speech);
        }

        const res = await fetch('/api/ai/narrative-organizer', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);

        if (!isMountedRef.current) return;

        if (res.status === 429) {
          setError(
            json?.error ||
              'Límite diario de IA alcanzado. Se renueva a la medianoche UTC.'
          );
          setErrorKind('quota');
          setPhaseSafe('error');
          return;
        }

        if (!res.ok || !json?.success || !json?.data) {
          setError(json?.error || 'No se pudo organizar tu relato. Probá de nuevo.');
          setErrorKind('analyze');
          setPhaseSafe('error');
          return;
        }

        const nextDraft = json.data as NarrativeDraft;
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setError(null);
        setErrorKind(null);
        setPhaseSafe('review');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo procesar el audio. Comprobá tu conexión.'
        );
        setErrorKind('analyze');
        setPhaseSafe('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [setPhaseSafe]
  );

  const finishAndSubmit = useCallback(() => {
    if (Date.now() < ignoreSubmitUntilRef.current) return;
    if (phaseRef.current === 'processing' || phaseRef.current === 'committing') return;
    if (abortRef.current) return;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      const mime = isSandboxRef.current ? 'audio/webm' : 'audio/webm';
      const dummy = new Blob([new Uint8Array(256)], { type: mime });
      void sendAudioToServer(dummy);
      return;
    }

    recorder.onstop = () => {
      const mime = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mime });
      void sendAudioToServer(blob);
    };

    try {
      recorder.stop();
    } catch {
      const mime = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
      void sendAudioToServer(new Blob(audioChunksRef.current, { type: mime }));
    }
  }, [sendAudioToServer]);

  const startListening = useCallback(async () => {
    if (phaseRef.current === 'processing' || phaseRef.current === 'committing') return;

    try {
      void audioEngine?.unlock('record');
    } catch {
      // ignore
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {
        // ignore
      }
    }

    cleanupAudio();
    setError(null);
    setErrorKind(null);
    setPhaseSafe('listening');
    setHoldProgress(0);

    // Sandbox: deterministic flow without asking for a real microphone.
    if (isSandboxRef.current) {
      return;
    }

    try {
      const stream = await getMicrophoneStream();
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const { analyser } = connectAudioAnalyser(ctx, stream);
        setAnalyserNode(analyser);

        const vadBuffer = new Uint8Array(analyser.frequencyBinCount);
        let noiseFloor = 14;
        let calibrationSamples = 0;
        let noiseSum = 0;

        vadIntervalRef.current = window.setInterval(() => {
          if (phaseRef.current !== 'listening') return;
          analyser.getByteFrequencyData(vadBuffer as unknown as Uint8Array<ArrayBuffer>);
          let sum = 0;
          for (let i = 0; i < vadBuffer.length; i += 1) sum += vadBuffer[i];
          const avg = sum / vadBuffer.length;

          if (calibrationSamples < 5) {
            noiseSum += avg;
            calibrationSamples += 1;
            noiseFloor = Math.max(10, Math.min(30, Math.round(noiseSum / calibrationSamples)));
            return;
          }

          const speechThreshold = Math.max(22, Math.min(45, noiseFloor + 10));
          if (avg > speechThreshold) {
            hasSpokenRef.current = true;
            if (silenceTimerRef.current !== null) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasSpokenRef.current && silenceTimerRef.current === null) {
            silenceTimerRef.current = window.setTimeout(() => {
              finishAndSubmit();
            }, 2000);
          }
        }, 100);
      }

      const { recorder, mimeType } = createSafeMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      try {
        if (mimeType.includes('webm')) recorder.start(250);
        else recorder.start();
      } catch {
        recorder.start();
      }

      maxDurationTimerRef.current = window.setTimeout(() => {
        finishAndSubmit();
      }, 90_000);
    } catch (micError: unknown) {
      const name = (micError as { name?: string })?.name;
      const isNotAllowed = name === 'NotAllowedError' || name === 'PermissionDeniedError';
      const isUnsecure = typeof window !== 'undefined' && !window.isSecureContext;
      setError(
        isUnsecure
          ? 'En iOS Safari el micrófono requiere una conexión HTTPS segura.'
          : isNotAllowed
            ? 'El acceso al micrófono fue denegado. Habilitá el permiso en Ajustes > Safari.'
            : 'No se detectó el micrófono. Comprobá que esté habilitado e intentá de nuevo.'
      );
      setErrorKind('microphone');
      setPhaseSafe('error');
    }
  }, [cleanupAudio, finishAndSubmit, setPhaseSafe]);

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    draftIdRef.current = createDraftId();
    draftRef.current = null;
    setDraft(null);
    setError(null);
    setErrorKind(null);
    isOpenRef.current = true;
    setIsOpen(true);
    void startListening();
  }, [startListening]);

  const reRecord = useCallback(() => {
    // Keep the current draft: the new audio is a correction over it.
    void startListening();
  }, [startListening]);

  const closeOverlay = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    setHoldProgress(0);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      draftRef.current = null;
      if (isMountedRef.current) setDraft(null);
      setError(null);
      setErrorKind(null);
      setPhaseSafe('idle');
      callbacksRef.current.onClosed?.();
    }, 240);
  }, [setPhaseSafe]);

  const cancelAll = useCallback(() => {
    // Stop the microphone and in-flight request immediately, but keep the
    // visual state for one exit beat so the sheet animates out cleanly.
    abortInFlight();
    cleanupAudio();
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    isLongPressActiveRef.current = false;
    isOpenRef.current = false;
    setIsOpen(false);
    setHoldProgress(0);
    closeTimerRef.current = window.setTimeout(() => {
      draftRef.current = null;
      if (isMountedRef.current) {
        setDraft(null);
        setError(null);
        setErrorKind(null);
        setPhase('idle');
        phaseRef.current = 'idle';
      }
    }, 240);
  }, [abortInFlight, cleanupAudio]);

  const confirm = useCallback(async (saveRampage = true) => {
    const current = draftRef.current;
    if (!current || phaseRef.current === 'committing') return;

    setPhaseSafe('committing');
    setError(null);
    setErrorKind(null);

    try {
      const res = await fetch('/api/ai/narrative-organizer/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: current.draftId,
          profileId: profileIdRef.current,
          currentDraft: current,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success || !json?.data) {
        setError(json?.error || 'No se pudo guardar. Probá de nuevo.');
        setErrorKind('commit');
        setPhaseSafe('error');
        return;
      }

      const result = json.data as NarrativeCommitResult;
      useAppStore.getState().applyNarrativeCommit(result);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([20, 40, 20]);
        } catch {
          // ignore
        }
      }

      setPhaseSafe('success');
      callbacksRef.current.onCommitted?.(result, saveRampage, current);

      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        closeOverlay();
      }, 650);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar. Comprobá tu conexión.'
      );
      setErrorKind('commit');
      setPhaseSafe('error');
    }
  }, [closeOverlay, setPhaseSafe]);

  /* ----------------------------- long press ----------------------------- */

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      try {
        void audioEngine?.unlock('record');
      } catch {
        // ignore
      }
      pointerStartYRef.current = event.clientY;
      isLongPressActiveRef.current = false;
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        isLongPressActiveRef.current = true;
        open();
      }, 300);
    },
    [open]
  );

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (pointerStartYRef.current === null) return;
    if (Math.abs(event.clientY - pointerStartYRef.current) > 8) {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressActiveRef.current) {
      callbacksRef.current.onOpenManualCreate();
    }
    isLongPressActiveRef.current = false;
  }, []);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /* --------------------------- keyboard space --------------------------- */

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();

      if (event.repeat) return;
      if (isSpaceHoldingRef.current || isOpenRef.current) return;
      isSpaceHoldingRef.current = true;
      spacePressTimerRef.current = window.setTimeout(() => {
        ignoreSubmitUntilRef.current = Date.now() + 600;
        open();
      }, 300);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      isSpaceHoldingRef.current = false;
      if (spacePressTimerRef.current !== null) {
        window.clearTimeout(spacePressTimerRef.current);
        spacePressTimerRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open]);

  /* ------------------------------ lifecycle ------------------------------ */

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortInFlight();
      cleanupAudio();
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (spacePressTimerRef.current !== null) window.clearTimeout(spacePressTimerRef.current);
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    };
  }, [abortInFlight, cleanupAudio]);

  // Switching profile must never leak a draft into the wrong profile.
  useEffect(() => {
    cancelAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
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

  const toggleItemAction = useCallback(
    (kind: 'manifestation' | 'affirmation', tempId: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        if (kind === 'manifestation') {
          const manifestations = prev.proposedPlan.manifestations.map((m) => {
            if (m.tempId !== tempId) return m;
            const nextAction: 'repeat' | 'create_new' =
              m.action === 'create_new' ? 'repeat' : 'create_new';
            return { ...m, action: nextAction };
          });
          const nextDraft = {
            ...prev,
            proposedPlan: { ...prev.proposedPlan, manifestations },
          };
          draftRef.current = nextDraft;
          return nextDraft;
        } else {
          const affirmations = prev.proposedPlan.affirmations.map((a) => {
            if (a.tempId !== tempId) return a;
            const nextAction: 'repeat' | 'create_new' =
              a.action === 'create_new' ? 'repeat' : 'create_new';
            return { ...a, action: nextAction };
          });
          const nextDraft = {
            ...prev,
            proposedPlan: { ...prev.proposedPlan, affirmations },
          };
          draftRef.current = nextDraft;
          return nextDraft;
        }
      });
    },
    []
  );

  /* ------------------------------- derived -------------------------------- */

  const itemCount = draft ? countProposedItems(draft.proposedPlan) : 0;
  const canConfirm = itemCount > 0 && phase === 'review';
  const canRetryCommit = Boolean(draft) && itemCount > 0 && errorKind === 'commit';

  return {
    isOpen,
    phase,
    draft,
    transcript: draft?.userTranscript || '',
    siriResponse: draft?.siriResponse || '',
    error,
    errorKind,
    analyserNode,
    holdProgress,
    itemCount,
    canConfirm,
    canRetryCommit,
    open,
    reRecord,
    finishAndSubmit,
    confirm,
    cancelAll,
    toggleItemAction,
    buttonGestureProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    },
  };
}
