'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

interface ProgressHeroBannerProps {
  onOpenNewProgress: () => void;
}

export const ProgressHeroBanner: React.FC<ProgressHeroBannerProps> = ({
  onOpenNewProgress,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EMIL_EASE_OUT }}
      className="relative overflow-hidden rounded-[26px] border border-white/80 bg-white/70 p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(157,117,224,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60"
    >
      {/* Background Soft Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[#eee7ff]/60 via-[#ffe1ec]/30 to-transparent blur-3xl"
      />

      <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="max-w-xl space-y-3">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--pastel-peri)] px-3 py-1 text-[11px] font-semibold tracking-wider text-[color:var(--pastel-peri-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--pastel-peri-ink)]" />
            <span>TU CAMINO</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl font-bold tracking-tight text-swiss-ink sm:text-3xl sm:leading-tight">
            Pequeños movimientos, grandes transformaciones.
          </h1>

          {/* Subtitle */}
          <p className="text-sm leading-relaxed text-swiss-ink-muted sm:text-base">
            Registrá señales, cambios internos y momentos que te acercan a lo que manifestás.
          </p>
        </div>

        {/* Action Button */}
        <div className="shrink-0">
          <motion.button
            type="button"
            onClick={onOpenNewProgress}
            whileTap={{ scale: 0.97 }}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9d75e0] to-[#865fd4] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(157,117,224,0.45)] transition-all hover:from-[#8f64d8] hover:to-[#7950ca] hover:shadow-[0_10px_24px_-4px_rgba(157,117,224,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto"
          >
            <Plus size={18} strokeWidth={2.6} />
            <span>Registrar avance</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
