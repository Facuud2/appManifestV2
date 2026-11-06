'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
        return { label: 'Certeza Interior' };
      default:
        return { label: 'Sincronía' };
    }
  };

  return (
    <div className="space-y-6 pb-24 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Avances y Sincronías del Camino
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Cada señal, número repetido o paso concreto registrado sin fricción
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewProgress}
          className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={15} />
          Registrar Sincronía
        </button>
      </div>

      {progressLogs.length === 0 ? (
        <div className="swiss-empty p-12 text-center rounded-lg border border-dashed">
          <Footprints size={32} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Aún no has registrado avances o señales
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4 max-w-sm mx-auto">
            Anota las coincidencias y pasos dados para mantener viva la evidencia de alineación.
          </p>
          <button
            type="button"
            onClick={onOpenNewProgress}
            className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium"
          >
            Registrar Primer Avance
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
            className="absolute bottom-0 left-0 top-0 w-px bg-zinc-200 dark:bg-zinc-800"
          />
          <motion.div
            variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
            initial={shouldStaggerCards ? 'hidden' : false}
            animate={shouldStaggerCards ? 'show' : undefined}
            className="relative space-y-5 py-2 pl-px"
          >
            {progressLogs.map((log) => {
              const badge = getSignBadge(log.signType);
              const manifTitle = getManifestationTitle(log.manifestationId);

              return (
                <motion.div
                  key={log.id}
                  variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
                  whileTap={EMIL_CARD_TAP}
                  className="relative pl-5 sm:pl-7"
                >
                  {/* Dot on timeline */}
                  <span className="absolute -left-[5px] top-3.5 w-2.5 h-2.5 rounded-full bg-swiss-accent ring-4 ring-white dark:ring-zinc-950" />

                  <div className="swiss-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60">
                        {badge.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
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
                          className="text-zinc-400 hover:text-swiss-red dark:text-zinc-500 dark:hover:text-swiss-red p-1 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                      "{log.note}"
                    </p>

                    {manifTitle ? (
                      <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        <Sparkles size={11} className="text-swiss-accent" />
                        <span>Vinculado a: {manifTitle}</span>
                      </div>
                    ) : (
                      <p className="mt-3 border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                        Avance independiente
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
};
