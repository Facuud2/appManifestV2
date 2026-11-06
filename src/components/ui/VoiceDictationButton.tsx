'use client';

import React, { useState, useRef } from 'react';
import { Mic, Loader2, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  previousTextTail?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  previousTextTail = '',
  className = '',
  size = 'md',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 500) {
          await sendToGeminiTranscribe(audioBlob);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('[VoiceDictation] Mic permission or capture error:', err);
    }
  };

  const stopRecording = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendToGeminiTranscribe = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'dictation.webm');
      formData.append('previousTextTail', previousTextTail);

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data?.text) {
        onTranscript(json.data.text);
      }
    } catch (err) {
      console.warn('[VoiceDictation] Transcribe error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size];

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18,
  }[size];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      aria-label={
        isProcessing
          ? 'Procesando dictado'
          : isRecording
            ? 'Detener dictado'
            : 'Dictar con Gemini 3.5'
      }
      aria-pressed={isRecording}
      title={isRecording ? 'Detener dictado' : 'Dictar con Gemini 3.5'}
      className={`relative inline-flex items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
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
