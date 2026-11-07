'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Headphones,
  Pin,
  Plus,
  Quote,
  Repeat,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { Affirmation } from '@/types';
import {
  EMIL_CARD_TAP,
  EMIL_EASE_OUT,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';

interface AffirmationsViewProps {
  onOpenNewAffirmation: () => void;
  onOpenRampage: () => void;
}

export const AffirmationsView: React.FC<AffirmationsViewProps> = ({
  onOpenNewAffirmation,
  onOpenRampage,
}) => {
  const {
    affirmations,
    togglePinAffirmation,
    incrementAffirmationRepeat,
    deleteAffirmation,
  } = useAppStore();

  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const pinnedAffirmations = useMemo(
    () => affirmations.filter((item) => item.pinned),
    [affirmations]
  );

  const shouldStaggerCards = affirmations.length <= 6;

  const handleSpeakPreview = (item: Affirmation) => {
    setSpeakingId(item.id);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'es-AR';
      utterance.rate = 0.96;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingId(null), 1500);
    }
  };

  return (
    <div className="space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Asunción en primera persona</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Afirmaciones</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Frases directas, naturales y en presente. Sin metáforas poéticas, listas para repetir o llevar a tu Rampage de voz.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewAffirmation}
          className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
        >
          <Plus size={16} aria-hidden="true" />
          Nueva afirmación
        </button>
      </header>

      {/* Spotlight de Decretos Fijados */}
      {pinnedAffirmations.length > 0 && (
        <section
          aria-labelledby="pinned-affirmations-heading"
          className="swiss-card surface-peri p-5 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]"
              >
                <Pin size={15} />
              </span>
              <div>
                <h2
                  id="pinned-affirmations-heading"
                  className="text-sm font-semibold text-swiss-ink"
                >
                  Decretos fijados en foco ({pinnedAffirmations.length})
                </h2>
                <p className="text-xs text-swiss-ink-muted">
                  Tus afirmaciones ancla listas para repetir o escuchar con tu voz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRampage}
              className="swiss-btn-secondary inline-flex min-h-9 items-center gap-2 self-start px-3.5 text-xs font-semibold text-[color:var(--pastel-peri-ink)] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
            >
              <Headphones size={14} aria-hidden="true" />
              <span>Practicar en Rampage</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedAffirmations.slice(0, 3).map((pinned) => (
              <div
                key={pinned.id}
                className="glass-panel flex flex-col justify-between rounded-[16px] p-3.5"
              >
                <p className="text-sm font-semibold leading-snug text-swiss-ink">
                  “{pinned.text}”
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-swiss-ink-light">
                    Por {pinned.author}
                  </span>
                  <button
                    type="button"
                    onClick={() => void incrementAffirmationRepeat(pinned.id)}
                    aria-label={`Repetir decreto fijado. Repetido ${pinned.repeatCount} veces`}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-swiss-control px-2.5 py-1 text-xs font-semibold text-swiss-accentText transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    <Repeat size={12} aria-hidden="true" />
                    <motion.span
                      key={pinned.repeatCount}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                      className="inline-block tabular-nums"
                    >
                      {pinned.repeatCount}
                    </motion.span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {affirmations.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--pastel-peach)] text-[color:var(--pastel-peach-ink)]">
            <Quote size={24} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay afirmaciones</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Creá frases cortas y directas en primera persona, como hechos que ya son parte de tu realidad.
          </p>
          <button
            type="button"
            onClick={onOpenNewAffirmation}
            className="swiss-btn-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5 text-[0.8125rem]"
          >
            <Plus size={16} aria-hidden="true" />
            Crear afirmación
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
            {affirmations.map((item) => {
              const isSpeaking = speakingId === item.id;
              return (
                <motion.article
                  key={item.id}
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
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                          item.pinned
                            ? 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]'
                            : 'bg-swiss-control text-swiss-ink-muted'
                        }`}
                      >
                        <span className="pastel-dot" aria-hidden="true" />
                        {item.pinned ? 'En foco' : 'Decreto'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSpeakPreview(item)}
                          aria-label={`Escuchar afirmación: ${item.text}`}
                          title="Escuchar con voz"
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            isSpeaking
                              ? 'bg-swiss-accent text-swiss-accentFg'
                              : 'text-swiss-ink-light hover:bg-swiss-control hover:text-swiss-ink'
                          }`}
                        >
                          <Volume2 size={14} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void togglePinAffirmation(item.id)}
                          aria-pressed={Boolean(item.pinned)}
                          aria-label={
                            item.pinned
                              ? `Quitar de foco: ${item.text}`
                              : `Fijar en foco: ${item.text}`
                          }
                          title={item.pinned ? 'Fijada en foco' : 'Fijar en foco'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            item.pinned
                              ? 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]'
                              : 'text-swiss-ink-light hover:bg-swiss-control hover:text-swiss-ink'
                          }`}
                        >
                          <Pin size={14} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteAffirmation(item.id)}
                          aria-label={`Eliminar afirmación: ${item.text}`}
                          title="Eliminar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red focus-visible:ring-2 focus-visible:ring-swiss-focus"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.018em] text-swiss-ink">
                      “{item.text}”
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-swiss-border pt-3.5">
                    <span className="text-xs text-swiss-ink-light">
                      Por {item.author}
                    </span>

                    <button
                      type="button"
                      onClick={() => void incrementAffirmationRepeat(item.id)}
                      aria-label={`Repetir afirmación. Repetida ${item.repeatCount} veces`}
                      className="swiss-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3.5 text-xs font-semibold text-swiss-accentText focus-visible:ring-2 focus-visible:ring-swiss-focus"
                    >
                      <Repeat size={13} aria-hidden="true" />
                      <span>Repetida</span>
                      <motion.span
                        key={item.repeatCount}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                        className="inline-block tabular-nums"
                      >
                        {item.repeatCount}
                      </motion.span>
                      <span>veces</span>
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
