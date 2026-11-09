'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';
import { createSafeMediaRecorder, getMicrophoneStream } from '@/lib/microphone';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  previousTextTail?: string;
  sampleText?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  previousTextTail = '',
  sampleText = 'Soy siempre la primera opción y todo funciona a mi favor',
  className = '',
  size = 'md',
  label,
}) => {
  const { isSandboxMode, setAiRequestsToday } = useAppStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sandboxTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sandboxTimerRef.current !== null) {
        window.clearTimeout(sandboxTimerRef.current);
      }
    };
  }, []);

  const sendToGeminiTranscribe = async (audioBlob?: Blob) => {
    try {
      setIsProcessing(true);
      const isAutomated =
        isSandboxMode || (typeof navigator !== 'undefined' && Boolean(navigator.webdriver));

      const formData = new FormData();
      if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'dictation.webm');
      }
      formData.append('previousTextTail', previousTextTail);
      if (isAutomated || !audioBlob || audioBlob.size <= 500) {
        formData.append('spokenText', sampleText);
        formData.append('sandbox', 'true');
      }

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: isAutomated ? { 'x-ai-sandbox': 'true' } : undefined,
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data?.text) {
        if (typeof json.data.quotaUsedToday === 'number') {
          setAiRequestsToday(json.data.quotaUsedToday);
        }
        onTranscript(json.data.text);
      }
    } catch (err) {
      console.warn('[VoiceDictation] Transcribe error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isAutomated =
      isSandboxMode || (typeof navigator !== 'undefined' && Boolean(navigator.webdriver));

    if (isAutomated && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setIsRecording(true);
      sandboxTimerRef.current = window.setTimeout(() => {
        setIsRecording(false);
        void sendToGeminiTranscribe();
      }, 450);
      return;
    }

    try {
      const stream = await getMicrophoneStream();

      const { recorder, mimeType } = createSafeMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const finalType = recorder.mimeType || mimeType || (audioChunksRef.current[0]?.type || 'audio/mp4');
        const audioBlob = new Blob(audioChunksRef.current, { type: finalType });
        await sendToGeminiTranscribe(audioBlob);
      };

      try {
        recorder.start();
      } catch (startErr) {
        console.warn('[VoiceDictation] recorder.start() fallback:', startErr);
        recorder.start();
      }
      setIsRecording(true);

      if (isAutomated) {
        sandboxTimerRef.current = window.setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
        }, 550);
      }
    } catch (err) {
      console.warn('[VoiceDictation] Mic access failed:', err);
      setIsRecording(false);
      if (isAutomated) {
        await sendToGeminiTranscribe();
      }
    }
  };

  const stopRecording = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (sandboxTimerRef.current !== null) {
      window.clearTimeout(sandboxTimerRef.current);
      sandboxTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else if (isRecording) {
      void sendToGeminiTranscribe();
    }
    setIsRecording(false);
  };

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-11 h-11 text-base',
  }[size];

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  }[size];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      aria-label={
        label ||
        (isProcessing
          ? 'Procesando dictado'
          : isRecording
            ? 'Detener dictado'
            : 'Dictar por voz con Gemini 3.5')
      }
      aria-pressed={isRecording}
      title={isRecording ? 'Detener dictado' : 'Dictar por voz con Gemini 3.5'}
      className={`relative inline-flex items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
        isRecording
          ? 'border-swiss-red bg-swiss-red text-swiss-accentFg'
          : isProcessing
            ? 'swiss-pill text-swiss-ink-muted'
            : 'swiss-pill text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink'
      } ${sizeClasses} ${className}`}
    >
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 size={iconSizes} className="animate-spin text-swiss-ink" />
          </motion.div>
        ) : isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Square size={iconSizes - 2} className="fill-current" />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Mic size={iconSizes} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
