'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock,
  Mic,
  Square,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';

interface VoiceActionOrbProps {
  isOpen: boolean;
  isHandsFree: boolean;
  isProcessing: boolean;
  analyserNode: AnalyserNode | null;
  onCancel: () => void;
  onSubmit: () => void;
  onLockHandsFree: () => void;
  holdProgress?: number; // 0..1 indicating hold time towards 1.5s
}

export const VoiceActionOrb: React.FC<VoiceActionOrbProps> = ({
  isOpen,
  isHandsFree,
  isProcessing,
  analyserNode,
  onCancel,
  onSubmit,
  onLockHandsFree,
  holdProgress = 0,
}) => {
  const [audioLevel, setAudioLevel] = useState(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!isOpen || isProcessing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setAudioLevel(0);
      return;
    }

    if (!analyserNode) {
      let angle = 0;
      const loop = () => {
        angle += 0.05;
        const simulated = 0.18 + 0.12 * Math.sin(angle);
        setAudioLevel(simulated);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const bufferLength = analyserNode.frequencyBinCount;
    if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
    }
    const dataArray = dataArrayRef.current;

    const tick = () => {
      analyserNode.getByteFrequencyData(dataArray as any);
      let sum = 0;
      const sampleCount = Math.min(bufferLength, 32);
      for (let i = 0; i < sampleCount; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (sampleCount * 255);
      setAudioLevel((prev) => prev * 0.7 + avg * 0.3);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isOpen, isProcessing, analyserNode]);

  if (!isOpen) return null;

  // Normalized visual dynamics
  const scale = isProcessing ? 1.02 : 1 + audioLevel * 0.25;

  const handleCenterCircleClick = () => {
    if (isProcessing) return;
    onSubmit();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: EMIL_EASE_OUT }}
        className="fixed inset-0 z-50 flex flex-col justify-end bg-[color:var(--color-scrim)] backdrop-blur-xl pb-[max(1.75rem,env(safe-area-inset-bottom))] px-4 pointer-events-auto select-none"
        role="dialog"
        aria-modal="true"
        aria-label="Captura de comando de voz con Gemini"
      >
        {/* Top bar with Status & Cancel */}
        <div className="absolute top-5 inset-x-5 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)]/90 px-3.5 py-1.5 text-xs font-medium text-swiss-ink shadow-card backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              {isProcessing ? (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-swiss-accent animate-pulse" />
              ) : (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-swiss-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-swiss-accent" />
                </>
              )}
            </span>
            <span>
              {isProcessing
                ? 'Gemini interpretando intención...'
                : isHandsFree
                  ? 'Modo manos libres'
                  : 'Escuchando tu voz...'}
            </span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar comando de voz"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)] text-swiss-ink-muted transition-all hover:bg-swiss-control hover:text-swiss-ink active:scale-95 shadow-card"
          >
            <X size={18} />
          </button>
        </div>

        {/* Central Sanctuary Orb & Interactive Mic/Square */}
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center text-center">
          <div className="relative flex h-52 w-52 items-center justify-center">
            {/* Outer Sanctuary Glow (Uses project tokens: pastel peri & rose aura) */}
            <motion.div
              animate={{
                scale: [scale * 0.96, scale * 1.05, scale],
                opacity: isProcessing ? [0.4, 0.65, 0.4] : [0.55, 0.85, 0.55],
              }}
              transition={{
                duration: isProcessing ? 1.8 : 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full blur-2xl filter pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, var(--orb-aura-glow1, rgba(197, 166, 233, 0.5)) 0%, var(--orb-aura-glow2, rgba(245, 179, 202, 0.4)) 50%, transparent 75%)',
              }}
            />

            {/* Middle Liquid Glass Plate */}
            <motion.div
              animate={{
                scale: [scale, scale * 1.02, scale],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative flex h-36 w-36 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)]/80 p-1 shadow-modal backdrop-blur-2xl"
            >
              {/* Central Interactive Circle Button */}
              <button
                type="button"
                onClick={handleCenterCircleClick}
                disabled={isProcessing}
                title={isProcessing ? 'Procesando voz...' : 'Tocar para detener y enviar'}
                aria-label={isProcessing ? 'Procesando voz con Gemini' : 'Detener y procesar voz'}
                className="relative flex h-full w-full items-center justify-center rounded-full bg-[color:var(--color-surface-card)] border border-[color:var(--border-subtle)] text-swiss-ink transition-transform hover:scale-[1.03] active:scale-95 focus-visible:ring-2 focus-visible:ring-swiss-focus overflow-hidden shadow-inner group"
              >
                {/* Rotating Circular SVG Spinner right inside/around the microphone circle */}
                {isProcessing && (
                  <svg
                    className="absolute inset-0 h-full w-full -rotate-90 animate-spin text-swiss-accent"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray="180 90"
                      strokeLinecap="round"
                      className="opacity-90"
                    />
                  </svg>
                )}

                {/* Content inside the central circle: Morph between Mic/Square and Spinner */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    {isProcessing ? (
                      <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col items-center justify-center text-swiss-accent"
                      >
                        <Loader2 size={34} className="animate-spin text-swiss-accent" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="recording"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col items-center justify-center gap-1"
                      >
                        {/* Square icon inside the circle to stop recording */}
                        <div className="relative flex items-center justify-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-swiss-red/10 text-swiss-red transition-colors group-hover:bg-swiss-red/20">
                            <Square size={18} className="fill-current text-swiss-red" />
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>

            {/* Reactive frequency waveform rays around the plate */}
            {!isProcessing && (
              <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center gap-1.5"
                aria-hidden="true"
              >
                {[0.4, 0.75, 1, 0.8, 0.5].map((factor, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      height: `${Math.max(10, audioLevel * 72 * factor)}px`,
                      opacity: Math.max(0.3, audioLevel * 1.4),
                    }}
                    transition={{ duration: 0.08 }}
                    className="w-1 rounded-full bg-[color:var(--pastel-peri-ink)] dark:bg-swiss-accent opacity-80"
                  />
                ))}
              </div>
            )}
          </div>

          {/* User Feedback Cues */}
          <div className="mt-3 flex flex-col items-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-semibold text-swiss-ink flex items-center gap-1.5">
                  <Sparkles size={15} className="text-swiss-accent" />
                  <span>Procesando voz con Gemini...</span>
                </p>
                <p className="text-xs text-swiss-ink-muted">
                  Resolviendo la acción según la Ley de la Asunción
                </p>
              </div>
            ) : isHandsFree ? (
              <div className="flex flex-col items-center gap-0.5">
                <p className="text-sm font-semibold text-swiss-ink">Modo Manos Libres Activo</p>
                <p className="text-xs text-swiss-ink-muted">
                  Tocá el botón cuadrado al terminar o esperá 2.5s de silencio
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <p className="text-sm font-semibold text-swiss-ink">
                  {holdProgress < 1
                    ? 'Mantené presionado para grabar...'
                    : 'Soltá o tocá el cuadrado para procesar'}
                </p>
                <p className="text-xs text-swiss-ink-muted">
                  Deslizá hacia arriba o tocá el candado para manos libres
                </p>
              </div>
            )}
          </div>

          {/* Dedicated Action Buttons (Square stop & Lock Hands-Free) */}
          <div className="mt-5 flex items-center justify-center gap-2.5 w-full">
            {!isProcessing && !isHandsFree && (
              <button
                type="button"
                onClick={onLockHandsFree}
                className="swiss-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-swiss-ink-muted hover:text-swiss-ink hover:bg-swiss-control active:scale-95 transition-all shadow-card"
              >
                <Lock size={13} />
                <span>Bloquear Manos Libres</span>
              </button>
            )}

            {/* Dedicated Square Stop & Send Button */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={isProcessing}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold shadow-dropdown transition-all active:scale-95 ${
                isProcessing
                  ? 'border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)] text-swiss-ink-muted cursor-wait'
                  : 'bg-swiss-accent text-swiss-accentFg hover:bg-swiss-accentHover'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={13} className="animate-spin text-swiss-accent" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Square size={13} className="fill-current text-white" />
                  <span>Detener y Enviar ✨</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
