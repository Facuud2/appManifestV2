'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useAppStore, type ManifestationItem } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { BACKDROP_TRANSITION, MODAL_TRANSITION } from '@/lib/iosSprings';
import { extractUrls } from '@/utils/urlParser';
import { RichLinkPreview } from '@/components/journal/RichLinkPreview';

interface ProgressLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifestationId?: string;
}

const signOptions = [
  { id: 'angel_number', label: 'Números repetidos' },
  { id: 'coincidence', label: 'Coincidencia' },
  { id: 'dream', label: 'Sueño' },
  { id: 'intuitive', label: 'Certeza interior' },
];

const statusOptions: { id: ManifestationItem['status']; label: string }[] = [
  { id: 'alineacion', label: 'En alineación' },
  { id: 'evidencia', label: 'Evidencia' },
  { id: 'materializado', label: 'Cumplido' },
];

export const ProgressLogModal: React.FC<ProgressLogModalProps> = ({
  isOpen,
  onClose,
  manifestationId,
}) => {
  const { activeScope, manifestations: allManifestations, addProgressLog, updateManifestationStatus } = useAppStore();
  const manifestations = allManifestations.filter((item) => item.userId === activeScope);
  const [selectedManifId, setSelectedManifId] = useState(manifestationId ?? '');
  const [note, setNote] = useState('');
  const [signType, setSignType] = useState('coincidence');
  const [newStatus, setNewStatus] = useState<ManifestationItem['status']>('alineacion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    setSelectedManifId(manifestationId ?? '');
    setNote('');
    setSignType('coincidence');
    setNewStatus('alineacion');
    setSaveError(false);
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, manifestationId]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!note.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSaveError(false);
    try {
      await addProgressLog({
        manifestationId: selectedManifId || undefined,
        userId: activeScope,
        note: note.trim(),
        signType,
      });

      if (selectedManifId) {
        await updateManifestationStatus(selectedManifId, newStatus);
      }

      setNote('');
      onClose();
    } catch (error) {
      console.warn('[ProgressLog] Error:', error);
      setSaveError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          className="progress-composer-scrim fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
        >
          <motion.div
            ref={dialogRef}
            variants={MODAL_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-log-title"
            aria-describedby="progress-log-description"
            tabIndex={-1}
            className="progress-composer swiss-modal relative w-full max-w-[26.5rem] p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6"
          >
            <header className="mb-4 flex items-start justify-between gap-4 sm:mb-3">
              <div className="min-w-0">
                <p className="progress-composer-eyebrow mb-1.5">Nuevo registro</p>
                <h2 id="progress-log-title" className="text-[1.375rem] font-semibold tracking-[-0.024em]">
                  ¿Qué cambió hoy?
                </h2>
                <p id="progress-log-description" className="mt-2 max-w-sm text-xs leading-[1.55] text-[var(--color-ink-muted)] sm:text-sm">
                  Podés escribir libremente o contármelo con tu voz. Yo me ocupo de ordenarlo.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar formulario de avance"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--control-bg)] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--control-hover)] hover:text-[var(--color-ink)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-3">
              <div className="progress-composer-field relative">
                <label htmlFor="progress-log-note" className="sr-only">
                  ¿Qué cambió hoy?
                </label>
                <textarea
                  id="progress-log-note"
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Hoy noté que..."
                  required
                  maxLength={3000}
                  className="swiss-composer-field h-[8.5rem] min-h-[8.5rem] w-full resize-none rounded-[12px] px-4 pb-14 pt-4 text-sm leading-6"
                />
                <VoiceDictationButton
                  size="lg"
                  className="progress-composer-mic absolute bottom-3 right-3 h-11 w-11 rounded-xl border-0"
                  onTranscript={(text) => setNote((previous) => (previous ? `${previous} ${text}` : text))}
                  previousTextTail={note}
                />
              </div>

              {(() => {
                const detected = extractUrls(note);
                if (detected.length === 0) return null;
                return (
                  <div className="mt-1">
                    <RichLinkPreview url={detected[0].cleanUrl} compact />
                  </div>
                );
              })()}

              <div className="progress-composer-link">
                <label htmlFor="progress-manifestation" className="mb-1.5 block text-xs font-medium">
                  Vincular una manifestación <span className="text-[var(--color-ink-light)]">(opcional)</span>
                </label>
                <select
                  id="progress-manifestation"
                  value={selectedManifId}
                  onChange={(event) => setSelectedManifId(event.target.value)}
                  className="swiss-composer-field min-h-11 w-full px-3 text-sm"
                >
                  <option value="">Sin vincular</option>
                  {manifestations.map((manifestation) => (
                    <option key={manifestation.id} value={manifestation.id}>
                      {manifestation.title}
                    </option>
                  ))}
                </select>
              </div>

              <details className="progress-composer-details group">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--color-ink-muted)] focus-visible:outline">
                  Más opciones
                  <ChevronDown
                    size={14}
                    className="shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="progress-composer-details-panel space-y-3 pt-2">
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-medium">Tipo de señal</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {signOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={signType === option.id}
                          onClick={() => setSignType(option.id)}
                          className={`min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            signType === option.id
                              ? 'manifestation-category-selected'
                              : 'manifestation-category text-[var(--color-ink-muted)] hover:bg-[var(--control-hover)]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {selectedManifId && (
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-medium">Estado de la manifestación</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {statusOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={newStatus === option.id}
                            onClick={() => setNewStatus(option.id)}
                            className={`min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                              newStatus === option.id
                                ? 'manifestation-category-selected'
                                : 'manifestation-category text-[var(--color-ink-muted)] hover:bg-[var(--control-hover)]'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              </details>

              {saveError && (
                <p role="alert" className="text-sm font-medium text-[var(--color-swiss-red)]">
                  No se pudo guardar el avance. Inténtalo de nuevo.
                </p>
              )}

              <footer className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !note.trim()}
                  aria-busy={isSubmitting}
                  className="progress-composer-submit swiss-btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 text-sm font-semibold disabled:opacity-60"
                >
                  {isSubmitting && <Check size={17} aria-hidden="true" />}
                  {isSubmitting ? 'Guardando…' : 'Guardar avance'}
                  {!isSubmitting && <ChevronRight size={17} aria-hidden="true" />}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
