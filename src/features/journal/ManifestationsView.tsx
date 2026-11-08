'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Feather, Plus, Trophy, Footprints, Trash2 } from 'lucide-react';
import { useAppStore, ManifestationItem } from '@/store';
import { ManifestationQuickAdd } from '@/components/journal/ManifestationQuickAdd';
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
  isQuickAddOpen: boolean;
  onQuickAddOpen: (trigger: HTMLElement) => void;
  onQuickAddClose: (restoreFocus?: boolean) => void;
}

const statusTone: Record<ManifestationItem['status'], string> = {
  semilla: 'bg-[color:var(--pastel-butter)] text-[color:var(--pastel-butter-ink)]',
  alineacion: 'bg-[color:var(--pastel-sky)] text-[color:var(--pastel-sky-ink)]',
  evidencia: 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]',
  materializado: 'bg-[color:var(--pastel-rose)] text-[color:var(--pastel-rose-ink)]',
};

const statusLabel: Record<ManifestationItem['status'], string> = {
  semilla: 'Semilla',
  alineacion: 'Alineación',
  evidencia: 'Evidencia',
  materializado: 'Materializado',
};

const nextStatusMap: Record<ManifestationItem['status'], ManifestationItem['status']> = {
  semilla: 'alineacion',
  alineacion: 'evidencia',
  evidencia: 'materializado',
  materializado: 'semilla',
};

export const ManifestationsView: React.FC<ManifestationsViewProps> = ({
  onOpenNewManifestation,
  onOpenNewProgress,
  onOpenCrownSuccess,
  isQuickAddOpen,
  onQuickAddOpen,
  onQuickAddClose,
}) => {
  const {
    activeScope,
    manifestations: allManifestations,
    progressLogs: allProgressLogs,
    successStories: allSuccessStories,
    updateManifestationStatus,
    deleteManifestation,
  } = useAppStore();

  const manifestations = allManifestations.filter((item) => item.userId === activeScope);
  const progressLogs = allProgressLogs.filter((item) => item.userId === activeScope);
  const successStories = allSuccessStories.filter((item) => item.userId === activeScope);

  const shouldStaggerCards = manifestations.length <= 6;

  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const handleQuickAddSaved = useCallback(() => {
    window.requestAnimationFrame(() => {
      const newest = useAppStore.getState().manifestations[0];
      if (!newest) return;

      setFlashId(newest.id);
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = window.setTimeout(() => setFlashId(null), 650);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="quick-add-page space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Tu jardín de intenciones</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Manifestaciones</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Deseos sensoriales escritos en tiempo presente, desde la semilla inicial hasta su materialización física.
          </p>
        </div>

        <button
          type="button"
          data-quick-add-trigger="true"
          onClick={(event) =>
            isQuickAddOpen
              ? onQuickAddClose()
              : onQuickAddOpen(event.currentTarget)
          }
          className={
            isQuickAddOpen
              ? 'swiss-btn-secondary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] font-semibold text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto'
              : 'swiss-btn-primary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto'
          }
        >
          {isQuickAddOpen ? (
            <>
              <Check size={16} aria-hidden="true" />
              Listo
            </>
          ) : (
            <>
              <Plus size={16} aria-hidden="true" />
              Nueva manifestación
            </>
          )}
        </button>
      </header>

      <ManifestationQuickAdd
        isOpen={isQuickAddOpen}
        onClose={() => onQuickAddClose()}
        onDismiss={() => onQuickAddClose(false)}
        onSaved={handleQuickAddSaved}
        onOpenAdvanced={() => {
          onQuickAddClose(false);
          onOpenNewManifestation();
        }}
      />

      {manifestations.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--pastel-sky)] text-[color:var(--pastel-sky-ink)]">
            <Feather size={24} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay manifestaciones</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Empezá escribiendo o dictando tus deseos sensorialmente, como hechos reales en presente.
          </p>
          {!isQuickAddOpen && (
            <button
              type="button"
              onClick={(event) => onQuickAddOpen(event.currentTarget)}
              className="swiss-btn-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5 text-[0.8125rem]"
            >
              <Plus size={16} aria-hidden="true" />
              Crear manifestación
            </button>
          )}
        </div>
      ) : (
        <motion.div
          variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
          initial={shouldStaggerCards ? 'hidden' : false}
          animate={shouldStaggerCards ? 'show' : undefined}
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        >
          <AnimatePresence initial={false}>
            {manifestations.map((item) => {
              const nextStatus = nextStatusMap[item.status] ?? 'semilla';
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
                  data-flash-tone={flashId === item.id ? 'butter' : undefined}
                  className={`swiss-card swiss-card-hover flex flex-col justify-between p-5 ${
                    flashId === item.id ? 'quick-add-card-flash' : ''
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs tabular-nums text-swiss-ink-light">
                        {new Date(item.createdAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {item.author ? ` · Por ${item.author}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteManifestation(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red focus-visible:ring-2 focus-visible:ring-swiss-focus"
                        title="Eliminar"
                        aria-label={`Eliminar ${item.title}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-swiss-ink">
                      {item.title}
                    </h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-swiss-ink-muted">
                      {item.description}
                    </p>

                    {item.sensoryAnchor && (
                      <div className="surface-butter mt-3.5 rounded-[12px] border px-3.5 py-3 text-[0.8125rem] leading-5 text-swiss-ink-muted">
                        <span className="mb-1 block text-xs font-semibold text-[color:var(--pastel-butter-ink)]">
                          Anclaje sensorial
                        </span>
                        “{item.sensoryAnchor}”
                      </div>
                    )}

                    {(() => {
                      const linkedLogsCount = progressLogs.filter(
                        (log) => log.manifestationId === item.id
                      ).length;
                      const linkedStoriesCount = successStories.filter(
                        (story) => story.manifestationId === item.id
                      ).length;
                      if (linkedLogsCount === 0 && linkedStoriesCount === 0) return null;
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-swiss-ink-muted">
                          {linkedLogsCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-swiss-control px-2.5 py-1 font-medium">
                              <Footprints size={12} aria-hidden="true" />
                              {linkedLogsCount}{' '}
                              {linkedLogsCount === 1 ? 'avance vinculado' : 'avances vinculados'}
                            </span>
                          )}
                          {linkedStoriesCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pastel-peach)] px-2.5 py-1 font-medium text-[color:var(--pastel-peach-ink)]">
                              <Trophy size={12} aria-hidden="true" />
                              {linkedStoriesCount}{' '}
                              {linkedStoriesCount === 1
                                ? 'Success Story cumplida'
                                : 'Success Stories cumplidas'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-swiss-border pt-3.5">
                    <button
                      type="button"
                      onClick={() => void updateManifestationStatus(item.id, nextStatus)}
                      title="Tocar para cambiar etapa de evolución"
                      aria-label={`Etapa actual: ${statusLabel[item.status] ?? item.status}. Tocar para cambiar a ${statusLabel[nextStatus]}`}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                        statusTone[item.status] ?? 'bg-swiss-control text-swiss-ink-muted'
                      }`}
                    >
                      <span className="pastel-dot" aria-hidden="true" />
                      {statusLabel[item.status] ?? item.status}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenNewProgress(item.id)}
                        className="swiss-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-swiss-focus"
                      >
                        <Footprints size={13} aria-hidden="true" />
                        Avance
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenCrownSuccess(item.title, item.id)}
                        className="swiss-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-swiss-focus"
                      >
                        <Trophy size={13} aria-hidden="true" />
                        ¡Se cumplió!
                      </button>
                    </div>
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
