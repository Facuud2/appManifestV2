'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Sparkles, Heart, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { STAGGER_CONTAINER, STAGGER_ITEM, EMIL_CARD_TAP } from '@/lib/iosSprings';

interface SuccessStoriesViewProps {
  onOpenNewStory: () => void;
}

export const SuccessStoriesView: React.FC<SuccessStoriesViewProps> = ({ onOpenNewStory }) => {
  const { successStories, deleteSuccessStory } = useAppStore();
  const shouldStaggerCards = successStories.length <= 6;

  return (
    <div className="space-y-6 pb-24 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Muro de Success Stories
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manifestaciones que ya se materializaron en tu realidad física
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewStory}
          className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={15} />
          Nueva Historia
        </button>
      </div>

      {successStories.length === 0 ? (
        <div className="swiss-empty p-12 text-center rounded-lg border border-dashed">
          <Trophy size={32} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Aún no has registrado manifestaciones cumplidas
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4 max-w-sm mx-auto">
            Cuando un deseo se materialice, inmortalízalo aquí para fortalecer tu certeza inquebrantable.
          </p>
          <button
            type="button"
            onClick={onOpenNewStory}
            className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium"
          >
            Registrar Primer Éxito
          </button>
        </div>
      ) : (
        <motion.div
          variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
          initial={shouldStaggerCards ? 'hidden' : false}
          animate={shouldStaggerCards ? 'show' : undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {successStories.map((story) => (
            <motion.div
              key={story.id}
              variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
              whileTap={EMIL_CARD_TAP}
              className="swiss-card p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 flex items-center gap-1.5">
                    <Trophy size={11} className="text-swiss-accent" />
                    Materializado
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{story.manifestedDate}</span>
                    <button
                      type="button"
                      onClick={() => deleteSuccessStory(story.id)}
                      className="text-zinc-400 hover:text-swiss-red dark:text-zinc-500 dark:hover:text-swiss-red p-1 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-snug">
                  {story.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-2 leading-relaxed whitespace-pre-line font-sans">
                  {story.story}
                </p>

                {story.gratitudeNote && (
                  <div className="mt-3.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border-l-2 border-swiss-accent text-xs text-zinc-700 dark:text-zinc-300">
                    <span className="font-mono block text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                      Gratitud
                    </span>
                    "{story.gratitudeNote}"
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                <span>Por {story.author}</span>
                <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                  <Sparkles size={11} className="text-swiss-accent" /> Evidencia Real
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
