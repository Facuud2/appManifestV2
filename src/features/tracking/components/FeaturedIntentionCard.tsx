'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_CARD_TAP, EMIL_EASE_OUT } from '@/lib/iosSprings';

interface FeaturedIntentionCardProps {
  onSelectManifestation?: (id: string) => void;
}

export const FeaturedIntentionCard: React.FC<FeaturedIntentionCardProps> = ({
  onSelectManifestation,
}) => {
  const { manifestations, progressLogs } = useAppStore();

  const featuredData = useMemo(() => {
    // Find first active manifestation or fallback to mockup default
    const active = manifestations.find((m) => m.status === 'alineacion' || m.status === 'evidencia') || manifestations[0];

    if (!active) {
      return {
        id: 'mock_featured',
        category: 'PROYECTO PERSONAL',
        title: 'Mi trabajo creativo crece de forma liviana y sostenida.',
        advancesCount: 0,
        daysCount: 1,
      };
    }

    const linkedLogs = progressLogs.filter((log) => log.manifestationId === active.id);
    const createdDate = new Date(active.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      id: active.id,
      category: active.category ? active.category.toUpperCase() : 'PROYECTO PERSONAL',
      title: active.title || 'Mi trabajo creativo crece de forma liviana y sostenida.',
      advancesCount: linkedLogs.length,
      daysCount: diffDays,
    };
  }, [manifestations, progressLogs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EMIL_EASE_OUT }}
      className="relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[26px] border border-white/80 bg-white/75 p-6 text-center shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60 sm:p-7"
    >
      {/* Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-44 w-44 rounded-full bg-purple-200/40 blur-3xl dark:bg-purple-900/20"
      />

      {/* Top Header */}
      <div className="w-full">
        <p className="text-[11px] font-bold tracking-widest uppercase text-swiss-ink-muted/80">
          INTENCIÓN DESTACADA
        </p>
      </div>

      {/* 3D Celestial Purple Sphere with White Sparkles */}
      <div className="my-5 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {/* Ambient Rim & Drop Shadow */}
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105"
            style={{
              background:
                'radial-gradient(circle at 35% 28%, #ffffff 0%, #dfccfb 18%, #9d75e0 50%, #683db8 80%, #3e1d77 100%)',
              boxShadow:
                '0 18px 36px -10px rgba(104, 61, 184, 0.45), inset 0 -6px 12px rgba(45, 17, 90, 0.55), inset 0 3px 6px rgba(255, 255, 255, 0.85)',
            }}
          >
            {/* Sparkles Cluster inside the orb */}
            <div className="relative flex items-center justify-center">
              <Sparkles
                size={28}
                className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                strokeWidth={2.2}
              />
            </div>
          </div>
        </div>

        {/* Category Pill */}
        <p className="mt-4 text-[10px] font-bold tracking-widest uppercase text-swiss-ink-muted/70">
          {featuredData.category}
        </p>

        {/* Intention Headline */}
        <h2 className="mt-2 max-w-xs text-base font-bold leading-snug text-swiss-ink sm:text-[17px]">
          {featuredData.title}
        </h2>
      </div>

      {/* Metrics Counter */}
      <div className="w-full">
        <div className="flex items-center justify-center gap-8 border-t border-slate-100 py-3.5 dark:border-white/5">
          <div className="text-center">
            <span className="block text-xl font-bold tracking-tight text-swiss-ink">
              {featuredData.advancesCount}
            </span>
            <span className="block text-xs font-medium text-swiss-ink-muted">
              avances
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800" />

          <div className="text-center">
            <span className="block text-xl font-bold tracking-tight text-swiss-ink">
              {featuredData.daysCount}
            </span>
            <span className="block text-xs font-medium text-swiss-ink-muted">
              días
            </span>
          </div>
        </div>

        {/* Action Link Button */}
        <motion.button
          type="button"
          whileTap={EMIL_CARD_TAP}
          onClick={() => onSelectManifestation?.(featuredData.id)}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-50/90 py-2.5 px-4 text-xs font-semibold text-[color:var(--pastel-peri-ink)] transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
        >
          <span>Ver recorrido completo</span>
          <ChevronRight size={14} strokeWidth={2.4} />
        </motion.button>
      </div>
    </motion.div>
  );
};
