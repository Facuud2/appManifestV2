'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Feather, Plus, Trophy, Footprints, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  EMIL_CARD_TAP,
  EMIL_EASE_OUT,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';

interface ManifestationsViewProps {
  onOpenNewManifestation: () => void;
  onOpenNewProgress: (manifId?: string) => void;
  onOpenCrownSuccess: (title: string, manifId?: string) => void;
}

const statusTone: Record<string, string> = {
  semilla: 'bg-[color:var(--pastel-butter)] text-[color:var(--pastel-butter-ink)]',
  alineacion: 'bg-[color:var(--pastel-sky)] text-[color:var(--pastel-sky-ink)]',
  evidencia: 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]',
  materializado: 'bg-[color:var(--pastel-rose)] text-[color:var(--pastel-rose-ink)]',
};

const statusLabel: Record<string, string> = {
  semilla: 'Semilla',
  alineacion: 'Alineación',
  evidencia: 'Evidencia',
  materializado: 'Materializado',
};

export const ManifestationsView: React.FC<ManifestationsViewProps> = ({
  onOpenNewManifestation,
  onOpenNewProgress,
  onOpenCrownSuccess,
}) => {
  const { manifestations, deleteManifestation } = useAppStore();

  const shouldStaggerCards = manifestations.length <= 6;

  return (
    <div className="space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Tu jardín de intenciones</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Escritos</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Detalles sensoriales, situaciones específicas y registro continuo.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewManifestation}
          className="swiss-btn-primary inline-flex min-h-10 items-center gap-2 self-start px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
        >
          <Plus size={16} />
          Nuevo escrito
        </button>
      </header>

      {manifestations.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center text-swiss-accentText">
            <Feather size={24} strokeWidth={1.6} />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay escritos</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Empezá escribiendo o dictando tus deseos sensorialmente, en presente.
          </p>
          <button
            type="button"
            onClick={onOpenNewManifestation}
            className="swiss-btn-primary mt-5 inline-flex min-h-10 items-center gap-2 px-4 text-[0.8125rem]"
          >
            <Plus size={16} />
            Crear escrito
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
            {manifestations.map((item) => (
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
                    <span className="text-xs tabular-nums text-swiss-ink-light">
                      {new Date(item.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteManifestation(item.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red"
                      title="Eliminar"
                      aria-label={`Eliminar ${item.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-swiss-ink">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-swiss-ink-muted whitespace-pre-line">
                    {item.description}
                  </p>

                  {item.sensoryAnchor && (
                    <div className="mt-3.5 rounded-[12px] bg-swiss-control px-3.5 py-3 text-[0.8125rem] leading-5 text-swiss-ink-muted">
                      <span className="mb-1 block text-xs font-semibold text-swiss-ink-light">
                        Anclaje sensorial
                      </span>
                      “{item.sensoryAnchor}”
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-swiss-border pt-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[item.status] ?? 'bg-swiss-control text-swiss-ink-muted'}`}>
                    <span className="pastel-dot" aria-hidden="true" />
                    {statusLabel[item.status] ?? item.status}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenNewProgress(item.id)}
                      className="swiss-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <Footprints size={13} />
                      Avance
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCrownSuccess(item.title, item.id)}
                      className="swiss-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <Trophy size={13} />
                      ¡Se cumplió!
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
