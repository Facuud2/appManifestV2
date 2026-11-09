'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
          (typeof navigator !== 'undefined' && Boolean(navigator.webdriver)) ||
          audioBlob.size <= 400;

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
        const fileExt = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
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
      const mime = recorder.mimeType || 'audio/webm';
      const completeBlob = new Blob(audioChunksRef.current, { type: mime });
      void sendAudioToServer(completeBlob);
    };

    try {
      recorder.stop();
    } catch {
      const mime = recorder.mimeType || 'audio/webm';
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

    // 3. Obtain microphone stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup Web Audio Analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        setAnalyserNode(analyser);

        // VAD loop for Hands-free mode with dynamic ambient noise floor & hysteresis
        const vadBuffer = new Uint8Array(analyser.frequencyBinCount);
        let noiseFloor = 14;
        let calibrationSamples = 0;
        let noiseSum = 0;

        vadIntervalRef.current = window.setInterval(() => {
          if (!isHandsFreeRef.current || isProcessingRef.current) return;
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
              // Exactly 2.5 seconds of verified silence after speech -> auto-submit
              silenceTimerRef.current = window.setTimeout(() => {
                finishAndSubmit();
              }, 2500);
            }
          }
        }, 100);
      }

      // Initialize MediaRecorder (32kbps)
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }
      );
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
    } catch (micErr) {
      console.warn('[VoiceActionRouter] Mic access rejected or unavailable:', micErr);
    }
  }, [finishAndSubmit]);

  const lockHandsFree = useCallback(() => {
    setIsHandsFree(true);
    isHandsFreeRef.current = true;
  }, []);

  // Pointer event handlers for the '+' button
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerStartYRef.current = e.clientY;
      isLongPressActiveRef.current = false;

      // Start 350ms long-press timer
      longPressTimerRef.current = window.setTimeout(() => {
        void startVoiceCapture();
      }, 350);
    },
    [startVoiceCapture]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isLongPressActiveRef.current || pointerStartYRef.current === null) return;
    const deltaY = e.clientY - pointerStartYRef.current;
    // Slide up by 45px locks hands-free
    if (deltaY < -45 && !isHandsFreeRef.current) {
      setIsHandsFree(true);
      isHandsFreeRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch (_) {}
      }
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    // 1. If released before 350ms, it is a short tap -> open manual create menu
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isLongPressActiveRef.current) {
      onOpenManualCreate();
      return;
    }

    // 2. If long press was active
    if (isHandsFreeRef.current) {
      // User is now in hands-free mode; do not submit on touch release
      return;
    }

    const elapsed = holdStartRef.current ? Date.now() - holdStartRef.current : 0;
    if (elapsed >= 1500) {
      // Held for >= 1.5s -> Auto submit
      finishAndSubmit();
    } else {
      // Released too quickly (< 1.5s) -> Keep in hands-free mode so user can finish talking
      setIsHandsFree(true);
      isHandsFreeRef.current = true;
    }
  }, [onOpenManualCreate, finishAndSubmit]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isHandsFreeRef.current) {
      cancelRecording();
    }
  }, [cancelRecording]);

  // Global PC Spacebar hold handler
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
      }, 350);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      isSpaceHoldingRef.current = false;

      if (spacePressTimerRef.current !== null) {
        window.clearTimeout(spacePressTimerRef.current);
        spacePressTimerRef.current = null;
      }

      if (!isLongPressActiveRef.current) return;

      if (!isHandsFreeRef.current) {
        const elapsed = holdStartRef.current ? Date.now() - holdStartRef.current : 0;
        if (elapsed >= 1500) {
          finishAndSubmit();
        } else {
          setIsHandsFree(true);
          isHandsFreeRef.current = true;
        }
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
