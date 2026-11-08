'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Feather, Sparkles, Trash2, Trophy } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  EMIL_CARD_TAP,
  EMIL_EASE_OUT,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';
import {
  ProgressHeroBanner,
  ProgressSectionTab,
} from './components/ProgressHeroBanner';
import { ProgressTimeline } from './components/ProgressTimeline';
import { FeaturedIntentionCard } from './components/FeaturedIntentionCard';

interface ProgressViewProps {
  onOpenNewProgress: (manifId?: string) => void;
  onSelectManifestation?: (id: string) => void;
  initialSection?: ProgressSectionTab;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  onOpenNewProgress,
  onSelectManifestation,
  initialSection = 'progress',
}) => {
  const {
    activeScope,
    progressLogs: allProgressLogs,
    successStories: allSuccessStories,
    manifestations: allManifestations,
    deleteSuccessStory,
  } = useAppStore();
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<ProgressSectionTab>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const progressLogs = useMemo(
    () => allProgressLogs.filter((item) => item.userId === activeScope),
    [allProgressLogs, activeScope],
  );
  const successStories = useMemo(
    () => allSuccessStories.filter((item) => item.userId === activeScope),
    [allSuccessStories, activeScope],
  );
  const manifestations = useMemo(
    () => allManifestations.filter((item) => item.userId === activeScope),
    [allManifestations, activeScope],
  );

  const shouldStaggerStories = successStories.length <= 6;

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 pb-28 sm:space-y-7 sm:pb-12">
      {/* 1. Editorial Page Header + Profile-Aware Pill Selector */}
      <ProgressHeroBanner
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        progressCount={progressLogs.length}
        storiesCount={successStories.length}
        onOpenNewProgress={onOpenNewProgress}
        onGoToManifestations={
          onSelectManifestation ? () => onSelectManifestation('') : undefined
        }
      />

      {/* 2. Section Panels */}
      <AnimatePresence mode="wait" initial={false}>
        {activeSection === 'progress' ? (
          <motion.div
            key="progress-panel"
            id="progress-panel-progress"
            role="tabpanel"
            aria-labelledby="progress-tab-progress"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: EMIL_EASE_OUT }
            }
            className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7"
          >
            {/* Left Column: Registro Personal & Timeline */}
            <div className="min-w-0 lg:col-span-7 xl:col-span-8">
              <ProgressTimeline onOpenNewProgress={onOpenNewProgress} />
            </div>

            {/* Right Column: Intención en foco */}
            <div className="min-w-0 lg:col-span-5 xl:col-span-4">
              <FeaturedIntentionCard
                onSelectManifestation={onSelectManifestation}
                onOpenNewProgress={onOpenNewProgress}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="stories-panel"
            id="progress-panel-stories"
            role="tabpanel"
            aria-labelledby="progress-tab-stories"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: EMIL_EASE_OUT }
            }
          >
            {successStories.length === 0 ? (
              <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-swiss-accentBorder bg-swiss-accentSubtle text-swiss-accentText">
                  <Trophy size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h2 className="section-heading mt-4">Todavía no hay Success Stories</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-swiss-ink-muted">
                  Cuando un deseo se materialice en tu realidad física, pulsá «¡Se cumplió!» dentro de tu manifestación para inmortalizar la historia acá.
                </p>
                {onSelectManifestation && (
                  <button
                    type="button"
                    onClick={() => onSelectManifestation('')}
                    className="swiss-btn-primary mt-5 inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    <Feather size={15} aria-hidden="true" className="shrink-0" />
                    <span>Ir a Manifestaciones</span>
                    <ChevronRight size={15} aria-hidden="true" className="shrink-0" />
                  </button>
                )}
              </div>
            ) : (
              <motion.div
                variants={shouldStaggerStories ? STAGGER_CONTAINER : undefined}
                initial={shouldStaggerStories ? 'hidden' : false}
                animate={shouldStaggerStories ? 'show' : undefined}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <AnimatePresence initial={false}>
                  {successStories.map((story) => {
                    const linkedManifestation = story.manifestationId
                      ? manifestations.find((m) => m.id === story.manifestationId)
                      : undefined;

                    return (
                      <motion.article
                        key={story.id}
                        layout
                        variants={shouldStaggerStories ? STAGGER_ITEM : undefined}
                        whileTap={EMIL_CARD_TAP}
                        exit={{
                          opacity: 0,
                          y: 4,
                          scale: 0.97,
                          transition: { duration: 0.18, ease: EMIL_EASE_OUT },
                        }}
                        className="swiss-card swiss-card-hover flex flex-col justify-between p-5"
                      >
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-swiss-accentBorder bg-swiss-accentSubtle px-2.5 py-1 text-xs font-semibold text-swiss-accentText">
                              <Trophy size={12} aria-hidden="true" className="shrink-0" />
                              <span>Materializado</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="text-xs tabular-nums text-swiss-ink-light">
                                {story.manifestedDate}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteSuccessStory(story.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red focus-visible:ring-2 focus-visible:ring-swiss-focus"
                                title="Eliminar historia"
                                aria-label={`Eliminar historia: ${story.title}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-swiss-ink">
                            {story.title}
                          </h3>

                          {linkedManifestation?.category && (
                            <p className="mt-1 text-xs font-medium text-swiss-accentText">
                              Intención vinculada ·{' '}
                              {linkedManifestation.category.charAt(0).toUpperCase() +
                                linkedManifestation.category.slice(1)}
                            </p>
                          )}

                          <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-swiss-ink-muted">
                            {story.story}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-swiss-border pt-3.5 text-xs text-swiss-ink-light">
                          <span>Por {story.author}</span>
                          <span className="flex items-center gap-1.5 font-medium text-swiss-ink-muted">
                            <Sparkles
                              size={12}
                              aria-hidden="true"
                              className="shrink-0 text-swiss-accentText"
                            />
                            <span>Evidencia real</span>
                          </span>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
