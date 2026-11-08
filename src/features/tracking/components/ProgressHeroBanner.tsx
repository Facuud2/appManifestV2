'use client';

import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Feather, Footprints, Plus, Trophy } from 'lucide-react';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export type ProgressSectionTab = 'progress' | 'stories';

interface ProgressHeroBannerProps {
  activeSection: ProgressSectionTab;
  onChangeSection: (section: ProgressSectionTab) => void;
  progressCount: number;
  storiesCount: number;
  onOpenNewProgress: (manifId?: string) => void;
  onGoToManifestations?: () => void;
}

export const ProgressHeroBanner: React.FC<ProgressHeroBannerProps> = ({
  activeSection,
  onChangeSection,
  progressCount,
  storiesCount,
  onOpenNewProgress,
  onGoToManifestations,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const tabRefs = useRef<Record<ProgressSectionTab, HTMLButtonElement | null>>({
    progress: null,
    stories: null,
  });

  const pills: Array<{
    id: ProgressSectionTab;
    label: string;
    shortLabel: string;
    count: number;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  }> = [
    {
      id: 'progress',
      label: 'Bitácora de avances',
      shortLabel: 'Bitácora',
      count: progressCount,
      icon: Footprints,
    },
    {
      id: 'stories',
      label: 'Success Stories',
      shortLabel: 'Success Stories',
      count: storiesCount,
      icon: Trophy,
    },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const total = pills.length;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % total;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + total) % total;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = total - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTab = pills[nextIndex].id;
      onChangeSection(targetTab);
      tabRefs.current[targetTab]?.focus();
    }
  };

  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">
            {activeSection === 'progress' ? 'Tu camino en movimiento' : 'Tu evidencia real'}
          </p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Avances</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            {activeSection === 'progress'
              ? 'Bitácora de señales, certezas internas y movimientos reales que te acercan a lo que manifestás.'
              : 'Manifestaciones que ya se materializaron en tu realidad física.'}
          </p>
        </div>

        {activeSection === 'progress' ? (
          <button
            type="button"
            onClick={() => onOpenNewProgress()}
            className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 self-start whitespace-nowrap px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
          >
            <Plus size={16} aria-hidden="true" className="shrink-0" />
            <span>Registrar avance</span>
          </button>
        ) : (
          onGoToManifestations && (
            <button
              type="button"
              onClick={onGoToManifestations}
              className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 self-start whitespace-nowrap border border-swiss-border bg-swiss-card px-5 text-[0.8125rem] font-semibold text-swiss-ink shadow-card focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
            >
              <Feather size={15} aria-hidden="true" className="shrink-0 text-swiss-accentText" />
              <span>Ver manifestaciones</span>
            </button>
          )
        )}
      </div>

      {/* Profile-Aware Pill Selector */}
      <div
        role="tablist"
        aria-label="Cambiar entre bitácora de avances y success stories"
        className="inline-flex w-full max-w-full sm:max-w-md items-center gap-1 rounded-full border border-swiss-border bg-swiss-control p-1 sm:w-auto"
      >
        {pills.map((pill, index) => {
          const Icon = pill.icon;
          const isActive = activeSection === pill.id;

          return (
            <button
              key={pill.id}
              ref={(node) => {
                tabRefs.current[pill.id] = node;
              }}
              id={`progress-tab-${pill.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`progress-panel-${pill.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChangeSection(pill.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`relative flex min-h-10 sm:min-h-11 flex-1 min-w-0 items-center justify-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-5 py-2 text-xs sm:text-[0.8125rem] transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus sm:flex-initial ${
                isActive
                  ? 'font-semibold text-swiss-ink'
                  : 'font-medium text-swiss-ink-muted hover:text-swiss-ink'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="progressSectionPill"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.22, ease: EMIL_EASE_OUT }
                  }
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border border-swiss-accentBorder bg-swiss-card shadow-card"
                />
              )}

              <span className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2">
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.1 : 1.8}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-swiss-accentText' : 'text-swiss-ink-light'
                  }`}
                />
                <span className="min-w-0 truncate whitespace-nowrap">
                  <span className="sm:hidden">{pill.shortLabel}</span>
                  <span className="hidden sm:inline">{pill.label}</span>
                </span>
                <span
                  aria-label={`${pill.count} ${
                    pill.count === 1 ? 'registro' : 'registros'
                  }`}
                  className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                    isActive
                      ? 'bg-swiss-accent text-swiss-accentFg'
                      : 'bg-swiss-card text-swiss-ink-muted'
                  }`}
                >
                  {pill.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
