'use client';

import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LiquidIridescentOrbProps {
  size?: number;
  audioLevel?: number; // 0..1
  isProcessing?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  className?: string;
  showRings?: boolean;
}

/**
 * LiquidIridescentOrb:
 * Inspirado en la estética de la Imagen 3 (iridescent liquid glass mercury bubble).
 *
 * Características:
 * 1. Morfología orgánica viva: deformación continua de bordes elásticos (morphing border-radius).
 * 2. Núcleo cromático líquido iridiscente: mezclas fluidas de cian (#00F0FF), índigo profundo (#4338CA),
 *    magenta (#D946EF) y blanco perlado caústico con refracción óptica.
 * 3. Menisco de cristal exterior y brillos especulares de lente caústica Apple.
 * 4. Reactividad acústica con Web Audio API: modulación de escala, dilatación de relieve y anillos concéntricos
 *    verde neón lima (#CCFF00) que pulsan hacia afuera con la voz.
 */
export const LiquidIridescentOrb: React.FC<LiquidIridescentOrbProps> = ({
  size = 112,
  audioLevel = 0,
  isProcessing = false,
  interactive = false,
  disabled = false,
  label = 'Orbe de voz iridiscente',
  onClick,
  className = '',
  showRings = true,
}) => {
  const prefersReduced = useReducedMotion();
  const filterId = useId().replace(/:/g, '');

  // Escala reactiva suave con límite elástico
  const reactiveScale = isProcessing
    ? 1.06
    : 1 + Math.min(0.28, audioLevel * 0.48);

  // Intensidad del halo exterior según la voz
  const glowOpacity = isProcessing
    ? 0.85
    : Math.min(0.9, 0.45 + audioLevel * 0.6);

  // Velocidad de rotación del fluido interior
  const rotationDuration = isProcessing ? 2.2 : 9.5;

  return (
    <div
      data-ui="liquid-iridescent-orb"
      className={`relative flex items-center justify-center select-none ${
        interactive && !disabled
          ? 'cursor-pointer active:scale-95 transition-transform duration-150 ease-out focus:outline-none'
          : ''
      } ${className}`}
      style={{ width: size, height: size }}
      onClick={interactive && !disabled ? onClick : undefined}
      onKeyDown={
        interactive && !disabled
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive && !disabled ? 0 : undefined}
      aria-label={label}
      aria-disabled={interactive ? disabled : undefined}
      data-testid="siri-orb"
    >
      {/* 0. Filtro SVG para distorsión caústica subyacente */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id={`liquid-chroma-${filterId}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={isProcessing ? '0.04' : '0.02'}
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={isProcessing ? 8 : 4 + audioLevel * 8}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* 1. Anillos Acústicos de Resonancia (Radar/Soundwave ripples estilo Imagen 3) */}
      {showRings && !prefersReduced && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Anillo 1: Expansión inmediata (armonizado con acento en modo claro y neón lima en modo oscuro) */}
          <motion.div
            animate={{
              scale: isProcessing
                ? [1, 1.45, 1.8]
                : [1, 1.25 + audioLevel * 0.5, 1.5 + audioLevel * 0.7],
              opacity: isProcessing
                ? [0.6, 0.25, 0]
                : [0.7 * Math.max(0.2, audioLevel), 0.3 * Math.max(0.2, audioLevel), 0],
            }}
            transition={{
              duration: isProcessing ? 1.6 : 1.8,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className="absolute rounded-full border border-[var(--color-accent)]/35 dark:border-[var(--color-neon-lime,#CCFF00)]/60"
            style={{ width: size * 1.05, height: size * 1.05 }}
          />

          {/* Anillo 2: Expansión secundaria retardada */}
          <motion.div
            animate={{
              scale: isProcessing
                ? [1, 1.6, 2.1]
                : [1, 1.35 + audioLevel * 0.6, 1.8 + audioLevel * 0.8],
              opacity: isProcessing
                ? [0.5, 0.15, 0]
                : [0.5 * Math.max(0.15, audioLevel), 0.15 * Math.max(0.15, audioLevel), 0],
            }}
            transition={{
              duration: isProcessing ? 1.6 : 1.8,
              delay: 0.6,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className="absolute rounded-full border border-cyan-400/35 dark:border-cyan-400/50"
            style={{ width: size * 1.15, height: size * 1.15 }}
          />
        </div>
      )}

      {/* 2. Halo ambiental cromático (Deep Iridescent Bloom) */}
      <motion.div
        animate={
          prefersReduced
            ? undefined
            : {
                scale: isProcessing
                  ? [1.12, 1.3, 1.12]
                  : [reactiveScale * 1.08, reactiveScale * 1.2, reactiveScale * 1.08],
                opacity: glowOpacity,
              }
        }
        transition={{
          duration: isProcessing ? 1.4 : 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-[-12px] rounded-full blur-2xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(0, 240, 255, 0.45) 0%, rgba(168, 85, 247, 0.4) 38%, rgba(204, 255, 0, 0.28) 65%, transparent 85%)',
        }}
      />

      {/* 3. Cuerpo del Orbe Líquido con Deformación Orgánica Viva (Morphing Blob) */}
      <motion.div
        animate={
          prefersReduced
            ? { scale: reactiveScale }
            : {
                scale: reactiveScale,
                borderRadius: [
                  '62% 38% 54% 46% / 48% 58% 42% 52%',
                  '45% 55% 62% 38% / 56% 44% 56% 44%',
                  '38% 62% 44% 56% / 46% 54% 46% 54%',
                  '58% 42% 52% 48% / 42% 58% 42% 58%',
                  '62% 38% 54% 46% / 48% 58% 42% 52%',
                ],
              }
        }
        transition={{
          scale: { duration: 0.12, ease: 'easeOut' },
          borderRadius: {
            duration: isProcessing ? 3.5 : 7.5,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }}
        className="relative overflow-hidden flex items-center justify-center shadow-2xl"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: '#0a0d14',
          boxShadow:
            '0 16px 36px -10px rgba(0, 0, 0, 0.65), 0 0 28px rgba(0, 240, 255, 0.35), inset 0 0 18px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Capa A: Fondo oscuro y profundo del vórtice */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 45% 52%, #0b0f19 0%, #06080d 70%, #020305 100%)',
          }}
        />

        {/* Capa B: Fluido cromático iridiscente en rotación (Cian, Índigo, Magenta, Blanco) */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  rotate: [0, 360],
                  scale: [1, 1.08, 1],
                }
          }
          transition={{
            rotate: {
              duration: rotationDuration,
              repeat: Infinity,
              ease: 'linear',
            },
            scale: {
              duration: 3.8,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
          className="absolute inset-[-15%] blur-[3px]"
          style={{
            background:
              'conic-gradient(from 40deg, #00F0FF 0%, #3B82F6 18%, #8B5CF6 36%, #EC4899 54%, #00F0FF 72%, #A3E635 88%, #00F0FF 100%)',
            mixBlendMode: 'screen',
            opacity: 0.88,
          }}
        />

        {/* Capa C: Fluido de contra-rotación con gradientes elípticos (Reflejos internos orgánicos) */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  rotate: [360, 0],
                  scale: [1.05, 0.95, 1.05],
                }
          }
          transition={{
            rotate: {
              duration: rotationDuration * 1.35,
              repeat: Infinity,
              ease: 'linear',
            },
            scale: {
              duration: 4.2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
          className="absolute inset-[-10%] blur-sm"
          style={{
            background:
              'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(0,240,255,0.65) 26%, rgba(147,51,234,0.55) 55%, transparent 75%)',
            mixBlendMode: 'color-dodge',
            opacity: 0.78,
          }}
        />

        {/* Capa D: Zona de sombra y profundidad central de mercurio líquido */}
        <div
          className="absolute inset-[14%] rounded-full blur-md pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 62% 65%, rgba(5,8,14,0.85) 0%, rgba(10,15,26,0.4) 60%, transparent 100%)',
          }}
        />

        {/* Capa E: Menisco de cristal óptico 3D y refracción caústica (Efecto lente líquido) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow:
              'inset 0 3px 6px rgba(255, 255, 255, 0.85), inset 0 -8px 16px rgba(0, 0, 0, 0.65), inset 0 0 14px rgba(0, 240, 255, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
          }}
        />

        {/* Capa F: Brillo especular nítido de luz reflejada (Crescent glare de cristal) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 22%, transparent 52%)',
          }}
        />

        {/* Capa G: Destello caústico secundario inferior en el borde */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 68% 78%, rgba(204, 255, 0, 0.35) 0%, rgba(0, 240, 255, 0.25) 28%, transparent 55%)',
            mixBlendMode: 'screen',
          }}
        />
      </motion.div>
    </div>
  );
};
