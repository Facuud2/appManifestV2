'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Mic,
  Sparkles,
  X,
  RotateCcw,
  ArrowRightLeft,
  AlertCircle,
  Check,
} from 'lucide-react';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';
import type { VoiceActionToastState } from './VoiceActionToast';

export interface VoiceActionOrbProps {
  isOpen: boolean;
  isHandsFree?: boolean;
  isProcessing: boolean;
  analyserNode: AnalyserNode | null;
  onCancel: () => void;
  onSubmit: () => void;
  onLockHandsFree?: () => void;
  holdProgress?: number;
  activeResponse?: VoiceActionToastState | null;
  onDismissResponse?: () => void;
}

/**
 * Componente SiriOrb: Esfera multicolor de Siri con gradientes fluidos de iOS 18
 * y respuesta acústica en tiempo real basada en Web Audio API AnalyserNode.
 */
export const SiriOrb: React.FC<{
  size?: number;
  audioLevel?: number;
  isProcessing?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}> = ({
  size = 104,
  audioLevel = 0,
  isProcessing = false,
  interactive = false,
  onClick,
}) => {
  // Escala reactiva según el volumen vocal con amortiguación
  const reactiveScale = isProcessing
    ? 1.05
    : 1 + Math.min(0.26, audioLevel * 0.42);

  return (
    <div
      data-ui="siri-orb"
      className={`relative flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer active:scale-95 transition-transform duration-150 ease-out' : ''
      }`}
      style={{ width: size, height: size }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label="Orbe multicolor de Siri"
    >
      {/* 1. Halo difuso exterior cromático (Apple Intelligence Ambient Bloom) */}
      <motion.div
        animate={{
          scale: isProcessing ? [1.1, 1.25, 1.1] : [reactiveScale * 1.05, reactiveScale * 1.16, reactiveScale * 1.05],
          opacity: isProcessing ? [0.65, 0.92, 0.65] : [0.55 + audioLevel * 0.4, 0.72 + audioLevel * 0.4, 0.55 + audioLevel * 0.4],
        }}
        transition={{
          duration: isProcessing ? 1.4 : 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(125,85,255,0.6) 0%, rgba(0,199,190,0.55) 35%, rgba(255,55,95,0.5) 65%, rgba(255,214,10,0.25) 85%, transparent 100%)', /* taste-skill-ignore */
        }}
      />

      {/* 2. Esfera base con gradiente multicolor giratorio iOS 18 */}
      <motion.div
        animate={{
          scale: reactiveScale,
          rotate: 360,
        }}
        transition={{
          scale: { duration: 0.1, ease: 'easeOut' },
          rotate: {
            duration: isProcessing ? 1.6 : 8,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
        className="relative rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: 'conic-gradient(from 0deg, #7D55FF 0%, #00C7BE 22%, #FF375F 45%, #FFD60A 68%, #5856D6 85%, #7D55FF 100%)', /* taste-skill-ignore */
          boxShadow: '0 0 32px rgba(125,85,255,0.45), inset 0 0 16px rgba(255,255,255,0.4)',
        }}
      >
        {/* Capa de fluido interno difuso con rotación inversa */}
        <div
          className="absolute inset-1 rounded-full blur-sm opacity-90"
          style={{
            background: 'conic-gradient(from 180deg, #FF375F 0%, #7D55FF 25%, #00C7BE 50%, #FFD60A 75%, #FF375F 100%)', /* taste-skill-ignore */
            mixBlendMode: 'screen',
          }}
        />

        {/* 3. Brillo especular y relieve de cristal 3D (Lente óptica Apple) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 35%, transparent 60%)', /* taste-skill-ignore */
            boxShadow: 'inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.6)',
          }}
        />

        {/* 4. Ondas acústicas concéntricas de vocalización */}
        {audioLevel > 0.08 && !isProcessing && (
          <motion.div
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.7, 0.2, 0.7],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full border border-white/50 pointer-events-none"
          />
        )}
      </motion.div>
    </div>
  );
};

export const VoiceActionOrb: React.FC<VoiceActionOrbProps> = ({
  isOpen,
  isProcessing,
  analyserNode,
  onCancel,
  onSubmit,
  activeResponse,
  onDismissResponse,
}) => {
  const [audioLevel, setAudioLevel] = useState(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const [isUndoing, setIsUndoing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Escuchar niveles del AnalyserNode
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
      setAudioLevel((prev) => prev * 0.65 + avg * 0.35);
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

  // Manejar acciones de respuesta
  const handleUndo = async () => {
    if (isUndoing || !activeResponse?.onUndo) return;
    setIsUndoing(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([20, 40]);
      } catch (_) {}
    }
    try {
      await activeResponse.onUndo();
    } finally {
      setIsUndoing(false);
      onDismissResponse?.();
    }
  };

  const handleSwitch = async () => {
    if (isSwitching || !activeResponse?.onSwitchType) return;
    setIsSwitching(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch (_) {}
    }
    try {
      await activeResponse.onSwitchType();
    } finally {
      setIsSwitching(false);
      onDismissResponse?.();
    }
  };

  const handleDismiss = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch (_) {}
    }
    // Detiene inmediatamente la escucha y libera el micrófono
    onCancel();
    if (activeResponse) {
      onDismissResponse?.();
    }
  };

  const shouldRender = isOpen || Boolean(activeResponse);
  if (!shouldRender) return null;

  const isResponseView = Boolean(activeResponse);
  const isErrorVariant = activeResponse?.variant === 'error' || activeResponse?.variant === 'unclear';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none select-none">
        {/* 1. Iluminación perimetral cromática de pantalla (Apple Intelligence iOS 18 Edge Glow) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EMIL_EASE_OUT }}
          className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
          aria-hidden="true"
        >
          {/* Borde perimetral resplandeciente */}
          <div
            className="absolute inset-0 border-[3px] border-transparent opacity-80 blur-md"
            style={{
              borderImage: 'linear-gradient(135deg, rgba(200,57,124,0.45), rgba(125,85,255,0.45), rgba(0,199,190,0.45), rgba(255,214,10,0.35)) 1', /* taste-skill-ignore */
            }}
          />
          {/* Resplandor inferior ambiental suave */}
          <div
            className="absolute bottom-0 inset-x-0 h-44 pointer-events-none opacity-35 blur-3xl"
            style={{
              background: 'radial-gradient(ellipse at bottom, rgba(200,57,124,0.5) 0%, rgba(125,85,255,0.4) 40%, rgba(0,199,190,0.3) 70%, transparent 100%)', /* taste-skill-ignore */
            }}
          />
        </motion.div>

        {/* 2. Capa translúcida sutil (no tapamos agresivamente la pantalla con un velo negro) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-[color:var(--color-scrim)] pointer-events-auto"
          aria-hidden="true"
        />

        {/* 3. Panel Flotante Siri Chat (Diseño Apple Glassmorphism & Mobile-Native) */}
        <div className="relative z-50 w-full max-w-lg mx-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={APPLE_ELASTIC_SPRING}
            className="w-full rounded-[2rem] border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)]/90 backdrop-blur-xl shadow-modal p-5 text-swiss-ink flex flex-col items-center" /* taste-skill-ignore */
            role="dialog"
            aria-modal="true"
            aria-label="Asistente Siri Gemini"
          >
            {/* Header: Badge Siri + Botón Cerrar */}
            <div className="w-full flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SiriOrb size={22} audioLevel={audioLevel} isProcessing={isProcessing} />
                <span className="text-xs font-semibold tracking-tight text-swiss-ink">
                  Siri
                </span>
                <span className="text-[11px] font-medium text-swiss-ink-muted">
                  · Gemini
                </span>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Cerrar Siri"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--control-bg)] hover:bg-[color:var(--control-hover)] text-swiss-ink-muted hover:text-swiss-ink transition-colors duration-150 active:scale-90"
              >
                <X size={15} />
              </button>
            </div>

            {/* CONTENIDO INTERACTIVO SEGÚN ESTADO */}
            <AnimatePresence mode="wait">
              {isResponseView && activeResponse ? (
                /* --- ESTADO 3 / 4: RESPUESTA EN LENGUAJE NATURAL DE SIRI --- */
                <motion.div
                  key="siri-response-card"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={APPLE_ELASTIC_SPRING}
                  className="w-full flex flex-col items-start gap-3 py-1"
                >
                  <div className="flex items-start gap-3 w-full">
                    {/* Icono de estado semántico */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                        isErrorVariant
                          ? 'bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]'
                          : 'bg-[color:var(--pastel-sage)] text-[color:var(--color-success)]'
                      }`}
                    >
                      {isErrorVariant ? <AlertCircle size={18} /> : <Check size={18} />}
                    </div>

                    {/* Mensaje en Lenguaje Natural al estilo Siri */}
                    <div className="flex-1 flex flex-col">
                      <p className="text-base font-medium tracking-tight text-swiss-ink leading-snug">
                        {activeResponse.message}
                      </p>
                      {activeResponse.detail && (
                        <p className="mt-1 text-xs text-swiss-ink-muted leading-relaxed">
                          {activeResponse.detail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones interactivas estilo iOS pills con tokens del sistema */}
                  <div className="w-full flex items-center justify-end gap-2 pt-2 border-t border-[color:var(--border-subtle)]">
                    {activeResponse.onUndo && (
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={isUndoing}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-[color:var(--control-bg)] hover:bg-[color:var(--control-hover)] text-swiss-ink border border-[color:var(--border-subtle)] transition-[transform,colors] duration-150 ease-out active:scale-95"
                      >
                        <RotateCcw size={13} className={isUndoing ? 'animate-spin' : ''} />
                        <span>Deshacer</span>
                      </button>
                    )}

                    {activeResponse.onSwitchType && (
                      <button
                        type="button"
                        onClick={handleSwitch}
                        disabled={isSwitching}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-[color:var(--control-bg)] hover:bg-[color:var(--control-hover)] text-swiss-ink border border-[color:var(--border-subtle)] transition-[transform,colors] duration-150 ease-out active:scale-95"
                      >
                        <ArrowRightLeft size={13} className={isSwitching ? 'animate-spin' : ''} />
                        <span>{activeResponse.switchLabel || 'Cambiar tipo'}</span>
                      </button>
                    )}

                    {activeResponse.onRetry && (
                      <button
                        type="button"
                        onClick={() => {
                          activeResponse.onRetry?.();
                          onDismissResponse?.();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-swiss-accent hover:bg-swiss-accentHover text-swiss-accentFg transition-[transform,background-color] duration-150 ease-out active:scale-95"
                      >
                        <Mic size={13} />
                        <span>Volver a hablar</span>
                      </button>
                    )}

                    {!activeResponse.onRetry && (
                      <button
                        type="button"
                        onClick={handleDismiss}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-swiss-ink text-[color:var(--color-surface-card)] hover:opacity-90 transition-[transform,opacity] duration-150 ease-out active:scale-95"
                      >
                        <span>Listo</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* --- ESTADO 1 / 2: ESCUCHANDO / PROCESANDO (BOLA MULTICOLOR SIRI NATIVA) --- */
                <motion.div
                  key="siri-listening-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={APPLE_ELASTIC_SPRING}
                  className="w-full flex flex-col items-center text-center py-3"
                >
                  {/* Orbe Multicolor Central Siri */}
                  <div className="my-2 relative flex items-center justify-center">
                    <SiriOrb
                      size={104}
                      audioLevel={audioLevel}
                      isProcessing={isProcessing}
                      interactive={!isProcessing}
                      onClick={onSubmit}
                    />
                  </div>

                  {/* Texto de conversación Siri */}
                  <div className="mt-3 flex flex-col items-center">
                    {isProcessing ? (
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-semibold tracking-tight text-swiss-ink flex items-center gap-1.5">
                          <Sparkles size={16} className="text-swiss-accent animate-spin" />
                          <span>Pensando...</span>
                        </p>
                        <p className="text-xs text-swiss-ink-muted">
                          Gemini interpretando tu intención...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-semibold tracking-tight text-swiss-ink">
                          Escuchando tu voz...
                        </p>
                        <p className="text-xs text-swiss-ink-muted max-w-xs">
                          Hablame o tocá el orbe para enviar · Tocá afuera para cancelar
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
