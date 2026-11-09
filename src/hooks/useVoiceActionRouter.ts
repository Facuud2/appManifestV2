'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import {
  connectAudioAnalyser,
  createSafeMediaRecorder,
  getMicrophoneStream,
} from '@/lib/microphone';
import type { VoiceCommandResult } from '@/lib/gemini';
import type { UserScope } from '@/types';

export interface VoiceActionErrorPayload {
  message: string;
  detail?: string;
  variant?: 'error' | 'unclear';
}

interface UseVoiceActionRouterProps {
  onOpenManualCreate: () => void;
  onCommandResult: (result: VoiceCommandResult) => void;
  onError?: (error: VoiceActionErrorPayload) => void;
  activeScope: UserScope;
  activeManifestations: Array<{ id: string; title: string }>;
  isSandboxMode?: boolean;
}

export function useVoiceActionRouter({
  onOpenManualCreate,
  onCommandResult,
  onError,
  activeScope,
  activeManifestations,
  isSandboxMode = false,
}: UseVoiceActionRouterProps) {
  const [isOrbOpen, setIsOrbOpen] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const isLongPressActiveRef = useRef(false);
  const isHandsFreeRef = useRef(false);
  const isProcessingRef = useRef(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // VAD silence detection refs
  const hasSpokenRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const vadIntervalRef = useRef<number | null>(null);

  // Spacebar hold tracking
  const spacePressTimerRef = useRef<number | null>(null);
  const isSpaceHoldingRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.onerror = null;
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch (_) {}
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (_) {}
      });
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }

    setAnalyserNode(null);
    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    isLongPressActiveRef.current = false;
    isHandsFreeRef.current = false;
    isProcessingRef.current = false;
  }, []);

  const cancelRecording = useCallback(() => {
    cleanupAudio();
    setIsOrbOpen(false);
    setIsHandsFree(false);
    setIsProcessing(false);
    setHoldProgress(0);
  }, [cleanupAudio]);

  const sendAudioToServer = useCallback(
    async (audioBlob: Blob) => {
      try {
        setIsProcessing(true);
        isProcessingRef.current = true;

        const isAutomated =
          isSandboxMode ||
          (typeof navigator !== 'undefined' && Boolean(navigator.webdriver));

        // If not automated and recording is virtually empty
        if (!isAutomated && audioBlob.size < 400) {
          onError?.({
            message: 'No alcancé a oírte',
            detail: 'No se detectó audio en la grabación. Mantené presionado y hablá cerca del micrófono.',
            variant: 'unclear',
          });
          return;
        }

        const formData = new FormData();
        const isM4A = audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a') || audioBlob.type.includes('aac');
        const fileExt = isM4A ? 'mp4' : 'webm';
        formData.append('audio', audioBlob, `voice-command.${fileExt}`);
        formData.append('currentProfile', activeScope);
        formData.append(
          'activeManifestations',
          JSON.stringify(activeManifestations.map((m) => ({ id: m.id, title: m.title })))
        );

        if (isAutomated) {
          formData.append('sandbox', 'true');
        }

        const res = await fetch('/api/ai/voice-command', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json?.success && json?.data) {
          if (json.data.intent === 'UNKNOWN') {
            onError?.({
              message: json.data.assistantFeedback || 'No alcancé a entenderte bien',
              detail: 'Podés pedir crear una manifestación, registrar un avance o iniciar un Rampage.',
              variant: 'unclear',
            });
          } else {
            onCommandResult(json.data);
          }
        } else {
          const rawError =
            json?.error ||
            (res.status === 500
              ? 'Error en el servicio de IA (500).'
              : 'No fue posible completar la solicitud.');
          console.warn('[VoiceActionRouter] Endpoint error:', rawError);

          if (res.status === 429) {
            onError?.({
              message: 'Límite diario de IA alcanzado',
              detail: rawError || 'Alcanzaste el límite de 100 RPD. Se renueva a la medianoche.',
              variant: 'error',
            });
          } else if (res.status >= 500) {
            onError?.({
              message: 'No se pudo procesar tu voz',
              detail: rawError,
              variant: 'error',
            });
          } else {
            onError?.({
              message: 'No alcancé a entenderte',
              detail: rawError,
              variant: 'unclear',
            });
          }
        }
      } catch (err: any) {
        console.error('[VoiceActionRouter] Network error:', err);
        onError?.({
          message: 'Error de conexión',
          detail: err?.message || 'Comprobá tu conexión a internet e intentá de nuevo.',
          variant: 'error',
        });
      } finally {
        cancelRecording();
      }
    },
    [activeScope, activeManifestations, isSandboxMode, onCommandResult, onError, cancelRecording]
  );

  const finishAndSubmit = useCallback(() => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);
    isProcessingRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      // If simulated / no active tracks
      const dummyBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      void sendAudioToServer(dummyBlob);
      return;
    }

    recorder.onstop = () => {
      const mime = recorder.mimeType || (audioChunksRef.current[0]?.type || 'audio/mp4');
      const completeBlob = new Blob(audioChunksRef.current, { type: mime });
      void sendAudioToServer(completeBlob);
    };

    try {
      recorder.stop();
    } catch {
      const mime = recorder.mimeType || (audioChunksRef.current[0]?.type || 'audio/mp4');
      const completeBlob = new Blob(audioChunksRef.current, { type: mime });
      void sendAudioToServer(completeBlob);
    }
  }, [sendAudioToServer]);

  const startVoiceCapture = useCallback(async () => {
    // 1. Immediately unlock audio context for iOS
    try {
      void audioEngine?.unlock();
    } catch (_) {}

    // 2. Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch (_) {}
    }

    setIsOrbOpen(true);
    setHoldProgress(0);
    holdStartRef.current = Date.now();
    isLongPressActiveRef.current = true;

    // Hold progress updater
    progressTimerRef.current = window.setInterval(() => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(1, elapsed / 1500));
    }, 50);

    // 3. Obtain microphone stream with resilient iOS WebKit support
    try {
      const stream = await getMicrophoneStream();
      mediaStreamRef.current = stream;

      // Setup Web Audio Analyser with WebKit keep-alive graph
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const { analyser } = connectAudioAnalyser(ctx, stream);
        setAnalyserNode(analyser);

        // VAD loop for Hands-free mode with dynamic ambient noise floor & hysteresis
        const vadBuffer = new Uint8Array(analyser.frequencyBinCount);
        let noiseFloor = 14;
        let calibrationSamples = 0;
        let noiseSum = 0;

        vadIntervalRef.current = window.setInterval(() => {
          if (isProcessingRef.current) return;
          analyser.getByteFrequencyData(vadBuffer as any);
          let sum = 0;
          for (let i = 0; i < vadBuffer.length; i++) sum += vadBuffer[i];
          const avg = sum / vadBuffer.length;

          // Ambient noise floor calibration during first ~500ms
          if (calibrationSamples < 5) {
            noiseSum += avg;
            calibrationSamples++;
            noiseFloor = Math.max(10, Math.min(30, Math.round(noiseSum / calibrationSamples)));
            return;
          }

          // Robust speech threshold above ambient noise (minimum 22 to filter mic hiss)
          const speechThreshold = Math.max(22, Math.min(45, noiseFloor + 10));

          if (avg > speechThreshold) {
            hasSpokenRef.current = true;
            if (silenceTimerRef.current !== null) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasSpokenRef.current) {
            if (silenceTimerRef.current === null) {
              // 2.0 seconds of verified natural silence after speech -> auto-submit
              silenceTimerRef.current = window.setTimeout(() => {
                finishAndSubmit();
              }, 2000);
            }
          }
        }, 100);
      }

      // Initialize MediaRecorder safely for iOS Safari
      const { recorder, mimeType } = createSafeMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      try {
        if (mimeType.includes('webm')) {
          recorder.start(250);
        } else {
          recorder.start();
        }
      } catch (startErr) {
        console.warn('[VoiceActionRouter] recorder.start() fallback:', startErr);
        recorder.start();
      }
    } catch (micErr: any) {
      console.warn('[VoiceActionRouter] Mic access rejected or unavailable:', micErr);
      const isNotAllowed =
        micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError';
      const isUnsecure = typeof window !== 'undefined' && !window.isSecureContext;

      onError?.({
        message: 'No se detectó el micrófono',
        detail: isUnsecure
          ? 'En iOS Safari el micrófono requiere una conexión HTTPS segura.'
          : isNotAllowed
            ? 'El acceso al micrófono fue denegado. Habilitá el permiso en Ajustes > Safari.'
            : (micErr?.message || 'Comprobá que el micrófono esté habilitado en el navegador e intentá de nuevo.'),
        variant: 'error',
      });
      cancelRecording();
    }
  }, [finishAndSubmit, onError, cancelRecording]);

  const lockHandsFree = useCallback(() => {}, []);

  // Pointer event handlers for the '+' button: dejar pulsado abre automáticamente la funcionalidad
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      try {
        void audioEngine?.unlock();
      } catch (_) {}

      pointerStartYRef.current = e.clientY;
      isLongPressActiveRef.current = false;

      // Start 300ms long-press timer: dejar pulsado abre la funcionalidad de voz Siri
      longPressTimerRef.current = window.setTimeout(() => {
        isLongPressActiveRef.current = true;
        void startVoiceCapture();
      }, 300);
    },
    [startVoiceCapture]
  );

  const handlePointerMove = useCallback(() => {
    // Modo whatsapp eliminado: no hay bloqueo por deslizamiento
  }, []);

  const handlePointerUp = useCallback(() => {
    // 1. Si se soltó antes de 300ms, es un toque corto -> abre menú manual de creación
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isLongPressActiveRef.current) {
      onOpenManualCreate();
      return;
    }

    // 2. Si fue pulsación larga, startVoiceCapture ya abrió el orbe y está escuchando.
    // Queda escuchando de forma natural hasta que termine de hablar o pulse fuera para cerrar.
  }, [onOpenManualCreate]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Global PC Spacebar hold handler: mantener espacio abre automáticamente la funcionalidad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (isSpaceHoldingRef.current || isOrbOpen) return;
      isSpaceHoldingRef.current = true;

      spacePressTimerRef.current = window.setTimeout(() => {
        void startVoiceCapture();
      }, 300);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
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
  }, [isOrbOpen, startVoiceCapture, finishAndSubmit]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    isOrbOpen,
    isHandsFree,
    isProcessing,
    holdProgress,
    analyserNode,
    cancelRecording,
    finishAndSubmit,
    lockHandsFree,
    startVoiceCapture,
    buttonGestureProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
