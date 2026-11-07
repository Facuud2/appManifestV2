'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_CARD_TAP, EMIL_EASE_OUT, STAGGER_CONTAINER, STAGGER_ITEM } from '@/lib/iosSprings';

interface SuccessStoriesViewProps {
  onOpenNewStory: () => void;
}

export const SuccessStoriesView: React.FC<SuccessStoriesViewProps> = ({ onOpenNewStory }) => {
  const { successStories, manifestations, deleteSuccessStory } = useAppStore();
  const shouldStaggerCards = successStories.length <= 6;

  return (
    <div className="space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Tu evidencia real</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Historias</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Manifestaciones que ya se materializaron en tu realidad física.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewStory}
          className="swiss-btn-primary inline-flex min-h-10 items-center gap-2 self-start px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
        >
          <Plus size={16} />
          Nueva historia
        </button>
      </header>

      {successStories.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center text-swiss-accentText">
            <Trophy size={24} strokeWidth={1.6} />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay historias</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Cuando un deseo se materialice, inmortalizalo acá para fortalecer tu certeza.
          </p>
          <button
            type="button"
            onClick={onOpenNewStory}
            className="swiss-btn-primary mt-5 inline-flex min-h-10 items-center gap-2 px-4 text-[0.8125rem]"
          >
            <Plus size={16} />
            Registrar primer éxito
          </button>
        </div>
      ) : (
        <motion.div
          variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
          initial={shouldStaggerCards ? 'hidden' : false}
          animate={shouldStaggerCards ? 'show' : undefined}
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        >
          <AnimatePresence initial={false}>
            {successStories.map((story) => (
              <motion.article
                key={story.id}
                layout
                variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pastel-peach)] px-2.5 py-1 text-xs font-medium text-[color:var(--pastel-peach-ink)]">
                      <Trophy size={12} />
                      Materializado
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs tabular-nums text-swiss-ink-light">
                        {story.manifestedDate}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSuccessStory(story.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red"
                        title="Eliminar"
                        aria-label={`Eliminar ${story.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-swiss-ink">
                    {story.title}
                  </h2>
                  {story.manifestationId && (
                    <p className="mt-1 text-xs font-medium text-swiss-accentText">
                      Vinculada a:{' '}
                      {manifestations.find((m) => m.id === story.manifestationId)?.title ||
                        'Manifestación cumplida'}
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-swiss-ink-muted whitespace-pre-line">
                    {story.story}
                  </p>

                  {story.gratitudeNote && (
                    <div className="mt-3.5 rounded-[12px] bg-swiss-control px-3.5 py-3 text-[0.8125rem] leading-5 text-swiss-ink-muted">
                      <span className="mb-1 block text-xs font-semibold text-swiss-ink-light">
                        Gratitud
                      </span>
                      “{story.gratitudeNote}”
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-swiss-border pt-3.5 text-xs text-swiss-ink-light">
                  <span>Por {story.author}</span>
                  <span className="flex items-center gap-1.5 font-medium text-swiss-ink-muted">
                    <Sparkles size={12} className="text-swiss-accentText" />
                    Evidencia real
                  </span>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
