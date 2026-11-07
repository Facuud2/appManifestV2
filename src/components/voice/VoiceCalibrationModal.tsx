'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  CALIBRATION_PHRASES,
  convertRecordingToWav,
  detectPitchFromAudioBuffer,
  getProfileAudioSample,
  getVoiceProfileMeta,
  saveProfileAudioSample,
  saveVoiceProfileMeta,
} from '@/lib/voiceStorage';
import { useAppStore } from '@/store';
import { VoiceProfileMeta } from '@/types';
import { audioEngine } from '@/lib/audioEngine';
import { BACKDROP_TRANSITION, MODAL_TRANSITION, EMIL_TAP } from '@/lib/iosSprings';

interface VoiceCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: 'maia' | 'facu';
}

type ProfileId = 'maia' | 'facu';
type CaptureStage = 'sample' | 'consent';

const CONSENT_PHRASE =
  'Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.';
const MAX_SAMPLE_SECONDS = 30;
const MIN_SAMPLE_SECONDS = 10;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado. Inténtalo otra vez.';

export const VoiceCalibrationModal: React.FC<VoiceCalibrationModalProps> = ({
  isOpen,
  onClose,
  targetUser,
}) => {
  const {
    activeScope,
    isFacuCalibrated,
    isMaiaCalibrated,
    isSandboxMode,
    isVoiceCaptureLocked,
    refreshVoiceCalibrationStatus,
    setVoiceCaptureLocked,
  } = useAppStore();
  const [profileId, setProfileId] = useState<ProfileId>(
    targetUser || (activeScope === 'maia' ? 'maia' : 'facu')
  );
  const [isReRecording, setIsReRecording] = useState(false);
  const [captureStage, setCaptureStage] = useState<CaptureStage>('sample');
  const [sampleAudio, setSampleAudio] = useState<Blob | null>(null);
  const [consentAudio, setConsentAudio] = useState<Blob | null>(null);
  const [sampleTranscript, setSampleTranscript] = useState('');
  const [detectedData, setDetectedData] = useState<{ tone: string; f0: number; pitch: number } | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isConsentConfirmed, setIsConsentConfirmed] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleAudioRef = useRef<Blob | null>(null);
  const detectedDataRef = useRef<{ tone: string; f0: number; pitch: number } | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingSessionRef = useRef(0);
  const recordingStageRef = useRef<CaptureStage>('sample');
  const sampleDurationRef = useRef(0);
  const meterContextRef = useRef<AudioContext | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    meterSourceRef.current?.disconnect();
    meterAnalyserRef.current?.disconnect();
    meterSourceRef.current = null;
    meterAnalyserRef.current = null;
    const context = meterContextRef.current;
    meterContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
    visualizerRef.current
      ?.querySelectorAll<HTMLElement>('[data-meter-bar]')
      .forEach((bar) => (bar.style.transform = 'scaleY(0.18)'));
  }, []);

  const startMeter = useCallback(
    async (stream: MediaStream) => {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      await context.resume();

      meterContextRef.current = context;
      meterSourceRef.current = source;
      meterAnalyserRef.current = analyser;

      const samples = new Uint8Array(analyser.fftSize);
      const update = () => {
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const value = (sample - 128) / 128;
          energy += value * value;
        }
        const level = Math.min(1, Math.sqrt(energy / samples.length) * 5);
        const bars = visualizerRef.current?.querySelectorAll<HTMLElement>('[data-meter-bar]');
        bars?.forEach((bar, index) => {
          const variation = prefersReducedMotion ? 0.55 : 0.25 + 0.75 * Math.abs(Math.sin(index * 0.8 + performance.now() / 95));
          bar.style.transform = `scaleY(${0.16 + level * variation})`;
        });
        meterFrameRef.current = requestAnimationFrame(update);
      };

      meterFrameRef.current = requestAnimationFrame(update);
    },
    [prefersReducedMotion]
  );

  const resetCapture = useCallback(() => {
    sampleAudioRef.current = null;
    detectedDataRef.current = null;
    setSampleAudio(null);
    setConsentAudio(null);
    setSampleTranscript('');
    setDetectedData(null);
    setCaptureStage('sample');
    setIsCompleted(false);
    setIsConsentConfirmed(false);
    setElapsedSeconds(0);
    setErrorMessage('');
    setWarningMessage('');
  }, []);

  const cancelActiveCapture = useCallback(() => {
    recordingSessionRef.current += 1;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsStarting(false);
    setVoiceCaptureLocked(false);
  }, [setVoiceCaptureLocked, stopMeter]);

  const analyzeSample = useCallback(async (wav: Blob) => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const context = new AudioContext();
      let pitchData: { f0: number; pitchRate: number };
      try {
        const audio = await context.decodeAudioData(await wav.arrayBuffer());
        pitchData = detectPitchFromAudioBuffer(audio);
      } finally {
        await context.close();
      }

      const formData = new FormData();
      formData.append('audio', wav, 'voice-sample.wav');
      const response = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.text?.trim()) {
        throw new Error(result.error || 'No se reconoció voz clara en la grabación.');
      }

      const data = {
        tone: result.data.detectedTone || 'calma, íntima y luminosa',
        f0: pitchData.f0,
        pitch: pitchData.pitchRate,
      };
      detectedDataRef.current = data;
      setDetectedData(data);
      setSampleTranscript(result.data.text.trim());
      setCaptureStage('consent');
    } catch (error) {
      setErrorMessage(`No pudimos reconocer la muestra. ${getErrorMessage(error)}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const createProfileVoice = useCallback(
    async (recordedConsent: Blob, durationSeconds: number) => {
      const sourceAudio = sampleAudioRef.current;
      const voiceData = detectedDataRef.current;
      if (!sourceAudio || !voiceData) {
        throw new Error('Falta analizar la muestra antes de crear la voz.');
      }

      setIsProcessing(true);
      setErrorMessage('');
      setWarningMessage('');
      try {
        const formData = new FormData();
        formData.append('profileId', profileId);
        formData.append('sourceAudio', sourceAudio, `${profileId}-voice.wav`);
        formData.append('consentAudio', recordedConsent, `${profileId}-consent.wav`);
        formData.append('durationSeconds', String(sampleDurationRef.current));
        formData.append('consentDurationSeconds', String(durationSeconds));
        formData.append('detectedTone', voiceData.tone);
        formData.append('detectedPitch', String(voiceData.pitch));
        formData.append('fundamentalFrequency', String(voiceData.f0));
        formData.append('transcript', sampleTranscript);

        const response = await fetch('/api/ai/voice-replication', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data?.voiceProfileMeta) {
          throw new Error(result.error || 'No se pudo crear el perfil de voz.');
        }

        const meta = result.data.voiceProfileMeta as VoiceProfileMeta;
        saveVoiceProfileMeta(profileId, meta);
        await saveProfileAudioSample(profileId, sourceAudio);
        refreshVoiceCalibrationStatus();
        setWarningMessage(result.data.warning || '');
        setConsentAudio(recordedConsent);
        setIsReRecording(false);
        setIsCompleted(true);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsProcessing(false);
        setVoiceCaptureLocked(false);
      }
    },
    [profileId, refreshVoiceCalibrationStatus, sampleTranscript, setVoiceCaptureLocked]
  );

  const handleRecordingComplete = useCallback(
    async (stage: CaptureStage, blob: Blob, durationSeconds: number) => {
      if (stage === 'sample') {
        setVoiceCaptureLocked(false);
        if (durationSeconds < MIN_SAMPLE_SECONDS) {
          setErrorMessage('La muestra necesita al menos 10 segundos para crear una voz fiable.');
          return;
        }
        if (durationSeconds > MAX_SAMPLE_SECONDS + 1) {
          setErrorMessage('La muestra superó los 30 segundos. Vuelve a grabarla, por favor.');
          return;
        }

        try {
          const wav = await convertRecordingToWav(blob);
          sampleAudioRef.current = wav;
          setSampleAudio(wav);
          sampleDurationRef.current = durationSeconds;
          await saveProfileAudioSample(profileId, wav);
          await analyzeSample(wav);
        } catch (error) {
          setErrorMessage(`No se pudo preparar la grabación. ${getErrorMessage(error)}`);
        }
        return;
      }

      if (durationSeconds < 2) {
        setVoiceCaptureLocked(false);
        setErrorMessage('La frase de consentimiento quedó muy corta. Grábala completa.');
        return;
      }
      if (!isConsentConfirmed) {
        setVoiceCaptureLocked(false);
        setErrorMessage('Confirma que esta es tu voz y que autorizas su réplica antes de continuar.');
        return;
      }

      try {
        const wav = await convertRecordingToWav(blob);
        await createProfileVoice(wav, durationSeconds);
      } catch (error) {
        setVoiceCaptureLocked(false);
        setErrorMessage(`No se pudo verificar el consentimiento. ${getErrorMessage(error)}`);
      }
    },
    [analyzeSample, createProfileVoice, isConsentConfirmed, setVoiceCaptureLocked]
  );

  const startRecording = useCallback(
    async (stage: CaptureStage) => {
      if (isRecording || isStarting || isProcessing) return;
      setErrorMessage('');
      setElapsedSeconds(0);
      setVoiceCaptureLocked(true);
      setIsStarting(true);

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setIsStarting(false);
        setVoiceCaptureLocked(false);
        setErrorMessage('Este navegador no permite grabar audio. Prueba con Safari o Chrome actualizado.');
        return;
      }

      const session = ++recordingSessionRef.current;
      recordingStageRef.current = stage;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (session !== recordingSessionRef.current || !isOpen) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const supportedMimeType = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
        ].find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = supportedMimeType
          ? new MediaRecorder(stream, { mimeType: supportedMimeType })
          : new MediaRecorder(stream);
        streamRef.current = stream;
        recorderRef.current = recorder;
        chunksRef.current = [];
        recordingStartedAtRef.current = Date.now();

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onerror = () => {
          setErrorMessage('La grabación se interrumpió. Comprueba el micrófono e inténtalo otra vez.');
          cancelActiveCapture();
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (streamRef.current === stream) streamRef.current = null;
          if (recorderRef.current === recorder) recorderRef.current = null;
          if (session !== recordingSessionRef.current) return;
          const seconds = (Date.now() - recordingStartedAtRef.current) / 1000;
          const audio = new Blob(chunksRef.current, {
            type: recorder.mimeType || supportedMimeType || 'audio/webm',
          });
          chunksRef.current = [];
          void handleRecordingComplete(stage, audio, seconds);
        };

        await startMeter(stream);
        recorder.start(250);
        setIsStarting(false);
        setIsRecording(true);
      } catch (error) {
        setIsStarting(false);
        setVoiceCaptureLocked(false);
        setErrorMessage(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'El micrófono está bloqueado. Habilítalo en los permisos del navegador y vuelve a intentarlo.'
            : `No se pudo iniciar el micrófono. ${getErrorMessage(error)}`
        );
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    },
    [
      cancelActiveCapture,
      handleRecordingComplete,
      isOpen,
      isProcessing,
      isRecording,
      isStarting,
      setVoiceCaptureLocked,
      startMeter,
    ]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
    stopMeter();
  }, [stopMeter]);

  const handleClose = useCallback(() => {
    cancelActiveCapture();
    if (audioEngine) audioEngine.stopVoice();
    setIsPlayingPreview(false);
    onClose();
  }, [cancelActiveCapture, onClose]);

  useEffect(() => {
    if (targetUser) {
      setProfileId(targetUser);
    } else if (!isOpen && (activeScope === 'maia' || activeScope === 'facu')) {
      setProfileId(activeScope);
    }
  }, [activeScope, isOpen, targetUser]);

  useEffect(() => {
    if (!isOpen) {
      cancelActiveCapture();
      return;
    }

    resetCapture();
    setIsReRecording(false);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      cancelActiveCapture();
      previousFocus?.focus();
    };
  }, [cancelActiveCapture, isOpen, resetCapture]);

  useEffect(() => {
    if (!isRecording) return;
    const maxSeconds = recordingStageRef.current === 'sample' ? MAX_SAMPLE_SECONDS : 20;
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
      setElapsedSeconds(Math.min(maxSeconds, elapsed));
      if (elapsed >= maxSeconds) stopRecording();
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRecording, stopRecording]);

  const handleProfileChange = (nextProfile: ProfileId) => {
    if (
      isRecording ||
      isStarting ||
      isProcessing ||
      isVoiceCaptureLocked ||
      nextProfile === profileId
    ) return;
    if (audioEngine) audioEngine.stopVoice();
    setIsPlayingPreview(false);
    setProfileId(nextProfile);
    setIsReRecording(false);
    resetCapture();
  };

  const handleStartReRecord = () => {
    if (audioEngine) audioEngine.stopVoice();
    setIsPlayingPreview(false);
    resetCapture();
    setIsReRecording(true);
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  const playPreview = async () => {
    if (!audioEngine) return;
    if (isPlayingPreview) {
      audioEngine.stopVoice();
      setIsPlayingPreview(false);
      return;
    }
    setErrorMessage('');
    setIsPlayingPreview(true);
    try {
      await audioEngine.unlock();
      // 1. Try playing the user's actual recorded sample from IndexedDB first
      const savedSample = sampleAudioRef.current || (await getProfileAudioSample(profileId));
      if (savedSample && savedSample.size > 44) {
        const audio = await audioEngine.decodeAudio(await savedSample.arrayBuffer());
        await audioEngine.playVoice(audio, () => setIsPlayingPreview(false));
        return;
      }

      // 2. Fallback: synthesize a voice sample from the registered Gemini voice profile
      const response = await fetch('/api/ai/voice-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          sandbox: isSandboxMode,
          text:
            profileId === 'maia'
              ? 'Merezco todo lo bueno y recibo cada día con gratitud.'
              : 'Confío en mi camino y avanzo con serenidad.',
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'No se pudo generar la muestra de voz.');
      }
      const audio = await audioEngine.decodeAudio(await response.arrayBuffer());
      await audioEngine.playVoice(audio, () => setIsPlayingPreview(false));
    } catch (error) {
      setIsPlayingPreview(false);
      setErrorMessage(getErrorMessage(error));
    }
  };

  const isProfileAlreadyCalibrated = profileId === 'maia' ? isMaiaCalibrated : isFacuCalibrated;
  const existingProfileMeta = getVoiceProfileMeta(profileId);
  const showRegisteredVoiceView = isProfileAlreadyCalibrated && !isReRecording && !isCompleted;

  const switchDisabled =
    isRecording || isStarting || isProcessing || isVoiceCaptureLocked || Boolean(targetUser);
  const recordingName = profileId === 'maia' ? 'Maia' : 'Facu';
  const formattedTime = `00:${String(Math.floor(elapsedSeconds)).padStart(2, '0')}`;
  const meterBars = Array.from({ length: 31 }, (_, index) => index);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-0 backdrop-blur-[10px] sm:p-5"
        >
          <motion.div
            ref={dialogRef}
            variants={MODAL_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-calibration-title"
            aria-describedby="voice-calibration-description"
            tabIndex={-1}
            className="swiss-modal voice-calibration-modal relative flex w-full max-w-xl flex-col gap-5 p-5 sm:p-8"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-swiss-accentText">
                  <Sparkles aria-hidden="true" size={22} strokeWidth={1.7} />
                </div>
                <div>
                  <p className="manifestation-composer-eyebrow">Tu voz, tu espacio</p>
                  <h2 id="voice-calibration-title" className="mt-1 text-xl font-semibold text-swiss-ink">
                    Calibrar voz
                  </h2>
                  <p id="voice-calibration-description" className="mt-1 text-sm text-swiss-ink-muted">
                    {recordingName} · perfil independiente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label={isRecording ? 'Cerrar y cancelar grabación' : 'Cerrar calibración de voz'}
                title={isRecording ? 'Cerrar y cancelar grabación' : 'Cerrar'}
                className="swiss-pill inline-flex h-11 w-11 shrink-0 items-center justify-center text-swiss-ink-muted focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            {!targetUser && (
              <div
                role="group"
                aria-label="Perfil para calibrar"
                className="swiss-pill flex w-full gap-1 p-1"
              >
                {(['facu', 'maia'] as const).map((profile) => {
                  const selected = profile === profileId;
                  return (
                    <button
                      key={profile}
                      type="button"
                      disabled={switchDisabled}
                      aria-pressed={selected}
                      onClick={() => handleProfileChange(profile)}
                      className={`min-h-11 flex-1 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus disabled:cursor-not-allowed disabled:opacity-55 ${
                        selected ? 'bg-swiss-surface text-swiss-ink shadow-card' : 'text-swiss-ink-muted'
                      }`}
                    >
                      {profile === 'facu' ? 'Facu' : 'Maia'}
                    </button>
                  );
                })}
              </div>
            )}

            <section className="flex flex-col items-center text-center">
              <div
                className="voice-calibration-orb relative mb-3 flex h-28 w-28 items-center justify-center rounded-full"
                data-recording={isRecording}
              >
                <span className="voice-calibration-orb-ring absolute inset-[-10px] rounded-full" aria-hidden="true" />
                <span className="voice-calibration-orb-ring voice-calibration-orb-ring-delayed absolute inset-[-20px] rounded-full" aria-hidden="true" />
                <Mic aria-hidden="true" size={30} strokeWidth={1.6} className="relative z-10 text-swiss-accentFg" />
              </div>
              <div
                ref={visualizerRef}
                className="voice-calibration-visualizer flex h-9 items-center justify-center gap-[3px]"
                aria-hidden="true"
              >
                {meterBars.map((bar) => (
                  <span key={bar} data-meter-bar className="voice-calibration-meter-bar" />
                ))}
              </div>
              <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 min-h-5 text-sm text-swiss-ink-muted">
                {isStarting
                  ? 'Esperando permiso para usar el micrófono…'
                  : isRecording
                    ? `Escuchando a ${recordingName} · ${formattedTime}`
                    : isProcessing
                      ? 'Reconociendo y calibrando tu voz…'
                      : isCompleted
                        ? 'Tu voz ya está lista para Rampage.'
                        : showRegisteredVoiceView
                          ? `Ya tenés una voz registrada para ${recordingName}.`
                          : captureStage === 'sample'
                            ? 'Primero, grabaremos una muestra de voz.'
                            : 'Ahora, verificaremos tu consentimiento.'}
              </p>
            </section>

            {showRegisteredVoiceView && (
              <motion.section
                key="registered-voice-summary"
                data-testid="registered-voice-card"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="swiss-card flex flex-col items-center p-5 text-center sm:p-6"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pastel-sage)] px-3 py-1 text-xs font-semibold text-[color:var(--pastel-sage-ink)]">
                  <Check aria-hidden="true" size={14} strokeWidth={2.2} />
                  Voz registrada
                </span>
                <h3 className="mt-3 text-lg font-semibold text-swiss-ink">
                  Ya tenés una voz registrada para {recordingName}
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-swiss-ink-muted">
                  Tu huella vocal está lista para usarse en cualquier Rampage. Tono detectado:{' '}
                  <span className="font-medium text-swiss-ink">
                    {existingProfileMeta?.detectedTone || 'calma, íntima y luminosa'}
                  </span>
                  {existingProfileMeta?.fundamentalFrequency
                    ? ` · ${existingProfileMeta.fundamentalFrequency} Hz`
                    : ''}
                  .
                </p>

                <div className="mt-5 flex w-full flex-col justify-center gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void playPreview()}
                    data-testid="listen-registered-voice-btn"
                    className="swiss-btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    {isPlayingPreview ? (
                      <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                    ) : (
                      <Volume2 aria-hidden="true" size={16} />
                    )}
                    {isPlayingPreview ? 'Escuchando grabación…' : 'Escuchar grabación'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartReRecord}
                    data-testid="rerecord-voice-btn"
                    className="swiss-btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    <RotateCcw aria-hidden="true" size={15} />
                    Volver a grabar
                  </button>
                </div>
              </motion.section>
            )}

            {!isCompleted && !showRegisteredVoiceView && captureStage === 'sample' && (
              <section className="swiss-card p-4 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-swiss-ink">1. Muestra de voz</p>
                    <p className="mt-1 text-xs leading-relaxed text-swiss-ink-muted">
                      Lee las frases con naturalidad, durante 10–30 segundos. Tu audio se usa para crear
                      la voz de este perfil.
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[color:var(--pastel-peri)] px-2.5 py-1 text-xs font-medium text-[color:var(--pastel-peri-ink)]">
                    10–30 s
                  </span>
                </div>
                <div className="space-y-2.5">
                  {CALIBRATION_PHRASES.map((phrase, index) => (
                    <p key={phrase.id} className="rounded-xl bg-swiss-control px-3.5 py-3 text-sm leading-relaxed text-swiss-ink">
                      <span className="mr-2 text-xs font-semibold text-swiss-accentText">{index + 1}</span>
                      {phrase.text}
                    </p>
                  ))}
                </div>

                {sampleTranscript && (
                  <div className="mt-3 rounded-xl border border-swiss-border bg-swiss-control px-3.5 py-3 text-left">
                    <p className="text-xs font-semibold text-swiss-ink">Reconocimiento de voz</p>
                    <p className="mt-1 text-sm leading-relaxed text-swiss-ink-muted">{sampleTranscript}</p>
                  </div>
                )}

                {sampleAudio && !sampleTranscript && !isProcessing && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void analyzeSample(sampleAudio)}
                      className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm"
                    >
                      <Sparkles aria-hidden="true" size={16} />
                      Reintentar reconocimiento
                    </button>
                    <button
                      type="button"
                      onClick={resetCapture}
                      className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm"
                    >
                      Grabar de nuevo
                    </button>
                  </div>
                )}
              </section>
            )}

            {!isCompleted && !showRegisteredVoiceView && captureStage === 'consent' && (
              <section className="swiss-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" size={18} className="text-swiss-accentText" />
                  <p className="text-sm font-semibold text-swiss-ink">2. Consentimiento de {recordingName}</p>
                </div>
                <p className="text-xs leading-relaxed text-swiss-ink-muted">
                  Para crear una réplica, Gemini requiere que la misma persona lea esta frase. El perfil
                  derivado se guardará en el proyecto Gemini y se usará únicamente para la voz de este
                  perfil.
                </p>
                <blockquote className="mt-3 rounded-2xl bg-swiss-control px-4 py-4 text-center text-sm font-medium leading-relaxed text-swiss-ink">
                  “{CONSENT_PHRASE}”
                </blockquote>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-left text-xs leading-relaxed text-swiss-ink-muted">
                  <input
                    type="checkbox"
                    checked={isConsentConfirmed}
                    onChange={(event) => setIsConsentConfirmed(event.target.checked)}
                    disabled={isProcessing || isRecording || isStarting}
                    className="mt-0.5 h-4 w-4 accent-swiss-accent"
                  />
                  <span>
                    Confirmo que soy mayor de edad, titular de esta voz y autorizo a Google a crear y
                    guardar su réplica.
                  </span>
                </label>
                {consentAudio && !isCompleted && (
                  <p className="mt-3 text-center text-xs text-swiss-success">
                    Consentimiento grabado; puedes volver a verificarlo.
                  </p>
                )}
              </section>
            )}

            {isCompleted && (
              <motion.section
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="swiss-card p-5 text-center sm:p-6"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center text-swiss-accentText">
                  <Check aria-hidden="true" size={28} strokeWidth={1.7} />
                </div>
                <h3 className="text-lg font-semibold text-swiss-ink">Voz de {recordingName} calibrada</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-swiss-ink-muted">
                  Rampage usará esta voz para {recordingName}. El tono detectado es {detectedData?.tone}.
                </p>
                {warningMessage && (
                  <p role="status" className="mt-3 text-sm text-swiss-warning">
                    {warningMessage}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void playPreview()}
                    className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm"
                  >
                    {isPlayingPreview ? (
                      <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                    ) : (
                      <Volume2 aria-hidden="true" size={16} />
                    )}
                    {isPlayingPreview ? 'Escuchando grabación…' : 'Escuchar grabación'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartReRecord}
                    className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm"
                  >
                    <RotateCcw aria-hidden="true" size={15} />
                    Volver a grabar
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="swiss-btn-primary inline-flex min-h-11 items-center justify-center px-5 text-sm"
                  >
                    Listo
                  </button>
                </div>
              </motion.section>
            )}

            {errorMessage && (
              <p role="alert" className="rounded-[12px] border border-swiss-red bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-swiss-red">
                {errorMessage}
              </p>
            )}

            {!isCompleted && !showRegisteredVoiceView && (
              <footer className="flex flex-wrap items-center justify-center gap-3">
                {isRecording ? (
                  <motion.button
                    type="button"
                    whileTap={EMIL_TAP}
                    onClick={stopRecording}
                    aria-label="Detener grabación"
                    className="swiss-btn-primary inline-flex min-h-12 min-w-48 items-center justify-center gap-2 rounded-full px-5 text-sm"
                  >
                    <Square aria-hidden="true" size={16} className="fill-current" />
                    Detener grabación
                  </motion.button>
                ) : isProcessing || isStarting ? (
                  <button
                    type="button"
                    disabled
                    className="swiss-btn-primary inline-flex min-h-12 min-w-48 items-center justify-center gap-2 rounded-full px-5 text-sm opacity-75"
                  >
                    <Loader2 aria-hidden="true" size={17} className="animate-spin" />
                    {isStarting ? 'Conectando micrófono…' : 'Procesando voz…'}
                  </button>
                ) : captureStage === 'sample' ? (
                  !sampleAudio || sampleTranscript ? (
                    <motion.button
                      type="button"
                      whileTap={EMIL_TAP}
                      onClick={() => void startRecording('sample')}
                      className="swiss-btn-primary inline-flex min-h-12 min-w-48 items-center justify-center gap-2 rounded-full px-5 text-sm"
                    >
                      <Mic aria-hidden="true" size={17} />
                      Grabar mi voz
                    </motion.button>
                  ) : null
                ) : (
                  <motion.button
                    type="button"
                    whileTap={EMIL_TAP}
                    onClick={() => void startRecording('consent')}
                    disabled={!isConsentConfirmed}
                    className="swiss-btn-primary inline-flex min-h-12 min-w-52 items-center justify-center gap-2 rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mic aria-hidden="true" size={17} />
                    Grabar consentimiento
                  </motion.button>
                )}

                {!isRecording && !isStarting && !isProcessing && isReRecording && isProfileAlreadyCalibrated && captureStage === 'sample' && (
                  <button
                    type="button"
                    onClick={() => {
                      resetCapture();
                      setIsReRecording(false);
                    }}
                    className="swiss-pill inline-flex min-h-11 items-center gap-2 px-4 text-sm text-swiss-ink-muted"
                  >
                    <ArrowLeft aria-hidden="true" size={15} />
                    Conservar voz actual
                  </button>
                )}

                {!isRecording && !isStarting && !isProcessing && captureStage === 'consent' && (
                  <button
                    type="button"
                    onClick={resetCapture}
                    className="swiss-pill inline-flex min-h-11 items-center gap-2 px-4 text-sm text-swiss-ink-muted"
                  >
                    <ArrowLeft aria-hidden="true" size={15} />
                    Volver a la muestra
                  </button>
                )}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
