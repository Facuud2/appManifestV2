'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Square, Check, Volume2, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { CALIBRATION_PHRASES, detectPitchFromAudioBuffer, saveProfileAudioSample, saveVoiceProfileMeta } from '@/lib/voiceStorage';
import { useAppStore } from '@/store';
import { VoiceProfileMeta } from '@/types';
import { audioEngine } from '@/lib/audioEngine';
import { BACKDROP_TRANSITION, MODAL_TRANSITION, EMIL_TAP } from '@/lib/iosSprings';

interface VoiceCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: 'maia' | 'facu';
}

export const VoiceCalibrationModal: React.FC<VoiceCalibrationModalProps> = ({
  isOpen,
  onClose,
  targetUser,
}) => {
  const { activeScope, refreshVoiceCalibrationStatus } = useAppStore();
  const [profileId, setProfileId] = useState<'maia' | 'facu'>(
    targetUser || (activeScope === 'maia' ? 'maia' : 'facu')
  );

  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [detectedData, setDetectedData] = useState<{ tone: string; f0: number } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (targetUser) {
      setProfileId(targetUser);
    } else if (activeScope === 'maia' || activeScope === 'facu') {
      setProfileId(activeScope);
    }
  }, [targetUser, activeScope]);

  const currentPhrase = CALIBRATION_PHRASES[currentStep] || CALIBRATION_PHRASES[0];

  const startRecording = async () => {
    try {
      if (audioEngine) {
        await audioEngine.unlock();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await processCalibrationAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('[Calibration] Mic access error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processCalibrationAudio = async (blob: Blob) => {
    try {
      setIsProcessing(true);

      // 1. Detect pitch F0 via Web Audio
      const AudioCtxClass =
        (typeof window !== 'undefined' &&
          ((window as any).AudioContext || (window as any).webkitAudioContext)) ||
        null;

      let f0 = profileId === 'maia' ? 210 : 135;
      let pitchRate = profileId === 'maia' ? 1.05 : 0.95;

      if (AudioCtxClass) {
        try {
          const ctx = new AudioCtxClass();
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const pitchData = detectPitchFromAudioBuffer(audioBuffer);
          f0 = pitchData.f0;
          pitchRate = pitchData.pitchRate;
          ctx.close();
        } catch (_) {}
      }

      // 2. Call Gemini transcribe to extract detected emotional tone
      const formData = new FormData();
      formData.append('audio', blob, 'calibration.webm');
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      let detectedTone = 'calma, íntima y luminosa';
      if (res.ok) {
        const json = await res.json();
        if (json.data?.detectedTone) {
          detectedTone = json.data.detectedTone;
        }
      }

      // 3. Save sample and meta
      await saveProfileAudioSample(profileId, blob);

      const matchedVoice =
        profileId === 'maia'
          ? f0 > 220 ? 'Aoede' : 'Kore'
          : f0 < 130 ? 'Fenrir' : 'Charon';

      const meta: VoiceProfileMeta = {
        voiceProfileId: `profile_${profileId}_${Date.now()}`,
        userId: profileId,
        recordedAt: new Date().toISOString(),
        durationSeconds: 5,
        detectedTone,
        detectedPitch: pitchRate,
        fundamentalFrequency: f0,
        matchedVoice,
        isCalibrated: true,
      };

      saveVoiceProfileMeta(profileId, meta);

      // Sync to Turso
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'profile',
          action: 'save',
          data: {
            id: profileId,
            name: profileId === 'maia' ? 'Maia' : 'Facu',
            avatar: profileId === 'maia' ? '🌸' : '⚡',
            hasCalibratedVoice: 1,
            voiceToneProfile: meta,
          },
        }),
      }).catch(console.error);

      setDetectedData({ tone: detectedTone, f0 });
      refreshVoiceCalibrationStatus();

      if (currentStep < CALIBRATION_PHRASES.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setIsCompleted(true);
      }
    } catch (e) {
      console.warn('[Calibration] Processing failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const playPreviewAffirmation = () => {
    if (!audioEngine) return;
    setIsPlayingPreview(true);
    const text =
      profileId === 'maia'
        ? 'Merezco todo lo bueno y me permito recibirlo con infinita gratitud.'
        : 'Soy abundante y mi realidad refleja mi serenidad.';

    const meta = profileId === 'maia' ? { pitch: 1.08, gender: 'female' as const } : { pitch: 0.94, gender: 'male' as const };

    audioEngine.speakVoice(
      text,
      { pitch: meta.pitch, rate: 0.88, gender: meta.gender },
      () => {
        setIsPlayingPreview(false);
      }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            variants={MODAL_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="swiss-modal relative w-full max-w-lg p-6 sm:p-8"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg border border-zinc-200 dark:border-zinc-700">
              {profileId === 'maia' ? '🌸' : '⚡'}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
                Calibración Vocal: {profileId === 'maia' ? 'Maia' : 'Facu'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Captura tu timbre y cadencia natural en 3 pasos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Profile Switcher inside modal */}
        <div className="flex items-center justify-center gap-1.5 my-5 p-1 bg-zinc-100 dark:bg-zinc-850 rounded-md border border-zinc-200 dark:border-zinc-800 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => {
              setProfileId('maia');
              setCurrentStep(0);
              setIsCompleted(false);
            }}
            className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${
              profileId === 'maia'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-sm font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50'
            }`}
          >
            🌸 Maia
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileId('facu');
              setCurrentStep(0);
              setIsCompleted(false);
            }}
            className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${
              profileId === 'facu'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-sm font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50'
            }`}
          >
            ⚡ Facu
          </button>
        </div>

        {!isCompleted ? (
          <div>
            {/* Step Indicators */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {CALIBRATION_PHRASES.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    transform: `scaleX(${idx === currentStep ? 2 : 1})`,
                    transition:
                      'transform var(--duration-normal) var(--ease-out), background-color var(--duration-normal) var(--ease-out)',
                  }}
                  className={`h-1 w-3 origin-center rounded-sm ${
                    idx === currentStep
                      ? 'bg-swiss-accent'
                      : idx < currentStep
                      ? 'bg-zinc-900 dark:bg-zinc-100'
                      : 'bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800'
                  }`}
                />
              ))}
            </div>

            {/* Phrase Card */}
            <div className="swiss-card p-5 mb-6 text-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 block">
                Frase {currentStep + 1} de 3 • {currentPhrase.focus}
              </span>
              <p className="text-sm sm:text-base font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                "{currentPhrase.text}"
              </p>
            </div>

            {/* Mic Action Area */}
            <div className="flex flex-col items-center justify-center py-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`relative w-16 h-16 rounded-md flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-swiss-accent text-swiss-accentFg animate-pulse'
                    : isProcessing
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
                    : 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90'
                }`}
              >
                {isProcessing ? (
                  <Loader2 size={26} className="animate-spin" />
                ) : isRecording ? (
                  <Square size={20} className="fill-current" />
                ) : (
                  <Mic size={24} />
                )}
              </motion.button>

              <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mt-3 text-center">
                {isRecording
                  ? 'Grabando tu voz... Toca para finalizar'
                  : isProcessing
                  ? 'Analizando timbre con Gemini 3.5...'
                  : 'Presiona y lee la frase en voz alta'}
              </p>
            </div>
          </div>
        ) : (
          /* Completion State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-3">
              <Check size={22} className="text-swiss-accent" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              ¡Voz de {profileId === 'maia' ? 'Maia' : 'Facu'} Calibrada con Éxito!
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-5">
              Tono detectado: <strong className="text-swiss-accent font-mono">{detectedData?.tone}</strong>.
              El motor de Rampage utilizará esta cadencia para tus afirmaciones subliminales.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={playPreviewAffirmation}
                disabled={isPlayingPreview}
                className="swiss-btn-secondary px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-1.5"
              >
                <Volume2 size={14} />
                {isPlayingPreview ? 'Escuchando...' : 'Escuchar Muestra'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="swiss-btn-primary px-4 py-2 rounded-md text-xs font-medium"
              >
                Listo
              </button>
            </div>
          </motion.div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
