'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Footprints, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_CARD_TAP, EMIL_EASE_OUT, STAGGER_CONTAINER, STAGGER_ITEM } from '@/lib/iosSprings';

interface ProgressViewProps {
  onOpenNewProgress: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ onOpenNewProgress }) => {
  const { progressLogs, manifestations, deleteProgressLog } = useAppStore();
  const shouldStaggerCards = progressLogs.length <= 6;

  const getManifestationTitle = (id?: string) => {
    if (!id) return undefined;
    return manifestations.find((m) => m.id === id)?.title || 'Manifestación eliminada';
  };

  const getSignBadge = (sign?: string) => {
    switch (sign) {
      case 'angel_number':
        return { label: '11:11 / Números' };
      case 'coincidence':
        return { label: 'Coincidencia' };
      case 'dream':
        return { label: 'Sueño' };
      case 'intuitive':
        return { label: 'Certeza interior' };
      default:
        return { label: 'Sincronía' };
    }
  };

  return (
    <div className="space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Evidencia del camino</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Avances</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Cada señal, número repetido o paso concreto, registrado sin fricción.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewProgress}
          className="swiss-btn-primary inline-flex min-h-10 items-center gap-2 self-start px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
        >
          <Plus size={16} />
          Registrar sincronía
        </button>
      </header>

      {progressLogs.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center text-swiss-accent">
            <Footprints size={24} strokeWidth={1.6} />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay avances</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Anotá las coincidencias y los pasos dados para mantener viva la evidencia de
            alineación.
          </p>
          <button
            type="button"
            onClick={onOpenNewProgress}
            className="swiss-btn-primary mt-5 inline-flex min-h-10 items-center gap-2 px-4 text-[0.8125rem]"
          >
            <Plus size={16} />
            Registrar primer avance
          </button>
        </div>
      ) : (
        <div className="relative ml-3 sm:ml-4">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.25, ease: EMIL_EASE_OUT }}
            style={{ transformOrigin: 'top' }}
            className="absolute bottom-0 left-0 top-0 w-px bg-swiss-border"
          />
          <motion.div
            variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
            initial={shouldStaggerCards ? 'hidden' : false}
            animate={shouldStaggerCards ? 'show' : undefined}
            className="relative space-y-3.5 py-2 pl-px"
          >
            <AnimatePresence initial={false}>
              {progressLogs.map((log) => {
                const badge = getSignBadge(log.signType);
                const manifTitle = getManifestationTitle(log.manifestationId);

                return (
                  <motion.div
                    key={log.id}
                    layout
                    variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
                    whileTap={EMIL_CARD_TAP}
                    exit={{
                      opacity: 0,
                      y: 4,
                      scale: 0.98,
                      transition: { duration: 0.18, ease: EMIL_EASE_OUT },
                    }}
                    className="relative pl-5 sm:pl-7"
                  >
                    <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full bg-swiss-accent ring-4 ring-swiss-base" />

                    <div className="swiss-card swiss-card-hover p-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-[color:var(--pastel-sky)] px-2.5 py-1 text-xs font-medium text-[color:var(--pastel-sky-ink)]">
                          {badge.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs tabular-nums text-swiss-ink-light">
                            {new Date(log.createdAt).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteProgressLog(log.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red"
                            title="Eliminar"
                            aria-label="Eliminar avance"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm leading-6 text-swiss-ink">“{log.note}”</p>

                      {manifTitle ? (
                        <div className="mt-3 flex items-center gap-1.5 border-t border-swiss-border pt-2.5 text-xs text-swiss-ink-light">
                          <Sparkles size={12} className="shrink-0 text-swiss-accent" />
                          <span className="truncate">Vinculado a {manifTitle}</span>
                        </div>
                      ) : (
                        <p className="mt-3 border-t border-swiss-border pt-2.5 text-xs text-swiss-ink-light">
                          Avance independiente
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
};
