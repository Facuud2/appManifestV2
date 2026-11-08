'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CloudRain,
  Headphones,
  Radio,
  RotateCcw,
  Sparkles,
  VolumeX,
  X,
} from 'lucide-react';
import { Affirmation, AmbientSoundType } from '@/types';
import {
  BACKDROP_TRANSITION,
  EMIL_TAP,
  MODAL_TRANSITION,
  TRANSITIONS_SMOOTH_OUT,
} from '@/lib/iosSprings';

interface PinnedRampageModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedAffirmations: Affirmation[];
  onStartPractice: (affirmations: string[], ambientSound: AmbientSoundType) => void;
}

export const PinnedRampageModal: React.FC<PinnedRampageModalProps> = ({
  isOpen,
  onClose,
  pinnedAffirmations,
  onStartPractice,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedAffirmations, setSelectedAffirmations] = useState<Affirmation[]>([]);
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('astral_rain');
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Sync selected affirmations when modal opens
  useEffect(() => {
    if (isOpen) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelectedAffirmations([...pinnedAffirmations]);
      const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isOpen, pinnedAffirmations]);

  // Focus trap and escape key
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  useEffect(() => {
    if (!isOpen && returnFocusRef.current?.isConnected) {
      returnFocusRef.current.focus();
    }
  }, [isOpen]);

  const handleRemove = (id: string) => {
    setSelectedAffirmations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRestoreAll = () => {
    setSelectedAffirmations([...pinnedAffirmations]);
  };

  const handleStart = () => {
    const texts = selectedAffirmations.map((item) => item.text.trim()).filter(Boolean);
    if (texts.length === 0) return;
    onStartPractice(texts, ambientSound);
    onClose();
  };

  const hasExclusions = selectedAffirmations.length < pinnedAffirmations.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pinned-rampage-backdrop"
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        >
          <motion.div
            variants={MODAL_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pinned-rampage-title"
            aria-describedby="pinned-rampage-desc"
            tabIndex={-1}
            ref={dialogRef}
            className="swiss-card relative flex w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-swiss-borderStrong bg-swiss-card shadow-elevated focus:outline-none max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-swiss-border/60 px-6 py-5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)] shadow-sm"
                >
                  <Headphones size={18} />
                </span>
                <div>
                  <h2
                    id="pinned-rampage-title"
                    className="text-base font-semibold text-swiss-ink"
                  >
                    Practicar en Rampage
                  </h2>
                  <p
                    id="pinned-rampage-desc"
                    className="text-xs text-swiss-ink-muted"
                  >
                    Bucle continuo con tus afirmaciones fijadas y audio cacheado.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 space-y-4">
              {/* Affirmations List Heading & Reset Action */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-swiss-ink-muted">
                  Afirmaciones a repetir ({selectedAffirmations.length} de {pinnedAffirmations.length})
                </span>

                {hasExclusions && (
                  <button
                    type="button"
                    onClick={handleRestoreAll}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--pastel-peri-ink)] hover:underline focus-visible:ring-2 focus-visible:ring-swiss-focus rounded"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Restablecer todas</span>
                  </button>
                )}
              </div>

              {/* List of Affirmations with X to remove */}
              <div
                role="list"
                aria-label="Lista de afirmaciones que se repetirán"
                className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1"
              >
                <AnimatePresence initial={false}>
                  {selectedAffirmations.length > 0 ? (
                    selectedAffirmations.map((item, index) => (
                      <motion.div
                        key={item.id}
                        layout={prefersReducedMotion ? false : 'position'}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          scale: 0.96,
                          height: 0,
                          marginBottom: 0,
                          paddingTop: 0,
                          paddingBottom: 0,
                          transition: {
                            duration: 0.16,
                            ease: TRANSITIONS_SMOOTH_OUT,
                          },
                        }}
                        className="group flex items-center justify-between gap-3 rounded-[14px] border border-swiss-border/70 bg-swiss-control/50 px-3.5 py-2.5 transition-colors hover:border-swiss-borderStrong hover:bg-swiss-control"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-swiss-surface text-[11px] font-semibold text-swiss-ink-muted"
                          >
                            {index + 1}
                          </span>
                          <p className="text-sm font-medium leading-snug text-swiss-ink line-clamp-2">
                            “{item.text}”
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          aria-label={`Quitar de la repetición: ${item.text}`}
                          title="Quitar de esta práctica"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-swiss-ink-muted transition-colors hover:bg-swiss-surface hover:text-[var(--color-danger,#e53e3e)] focus-visible:ring-2 focus-visible:ring-swiss-focus"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[14px] border border-dashed border-swiss-border p-5 text-center"
                    >
                      <p className="text-xs text-swiss-ink-muted">
                        Quitaste todas las afirmaciones de la lista.
                      </p>
                      <button
                        type="button"
                        onClick={handleRestoreAll}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-swiss-control px-3 py-1.5 text-xs font-semibold text-swiss-ink hover:bg-swiss-border"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Restablecer afirmaciones fijadas
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Ambient Sound Selection */}
              <div className="pt-2 border-t border-swiss-border/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-swiss-ink-muted">
                  Atmósfera continua
                </span>
                <div
                  role="group"
                  aria-label="Atmósfera continua"
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setAmbientSound('none')}
                    aria-pressed={ambientSound === 'none'}
                    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[12px] border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                      ambientSound === 'none'
                        ? 'border-swiss-ink bg-swiss-ink text-white font-semibold'
                        : 'border-swiss-border bg-swiss-control/40 text-swiss-ink-muted hover:text-swiss-ink'
                    }`}
                  >
                    <VolumeX size={14} aria-hidden="true" />
                    <span>Silencio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAmbientSound('white_noise')}
                    aria-pressed={ambientSound === 'white_noise'}
                    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[12px] border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                      ambientSound === 'white_noise'
                        ? 'border-swiss-ink bg-swiss-ink text-white font-semibold'
                        : 'border-swiss-border bg-swiss-control/40 text-swiss-ink-muted hover:text-swiss-ink'
                    }`}
                  >
                    <Radio size={14} aria-hidden="true" />
                    <span>Ruido blanco</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAmbientSound('astral_rain')}
                    aria-pressed={ambientSound === 'astral_rain'}
                    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[12px] border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                      ambientSound === 'astral_rain'
                        ? 'border-swiss-ink bg-swiss-ink text-white font-semibold'
                        : 'border-swiss-border bg-swiss-control/40 text-swiss-ink-muted hover:text-swiss-ink'
                    }`}
                  >
                    <CloudRain size={14} aria-hidden="true" />
                    <span>Lluvia</span>
                  </button>
                </div>
              </div>

              {/* Cache explanation badge */}
              <div className="flex items-center gap-2 rounded-[12px] bg-[color:var(--pastel-peri)]/40 p-2.5 text-[11px] text-[color:var(--pastel-peri-ink)]">
                <Sparkles size={14} className="shrink-0" aria-hidden="true" />
                <span>
                  Audio cacheado permanentemente: cada afirmación se sintetiza una sola vez y se repite sin límite ni consumo de cuota.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-swiss-border/60 bg-swiss-surface/40 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-medium text-swiss-ink-muted hover:text-swiss-ink hover:bg-swiss-control transition-colors"
              >
                Cancelar
              </button>

              <motion.button
                whileTap={prefersReducedMotion ? undefined : EMIL_TAP}
                type="button"
                disabled={selectedAffirmations.length === 0}
                onClick={handleStart}
                className="swiss-btn-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Headphones size={15} aria-hidden="true" />
                <span>
                  Iniciar Rampage ({selectedAffirmations.length})
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
