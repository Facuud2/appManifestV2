'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { BACKDROP_TRANSITION, MODAL_TRANSITION } from '@/lib/iosSprings';

interface SuccessStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifestationTitle?: string;
  manifestationId?: string;
}

export const SuccessStoryModal: React.FC<SuccessStoryModalProps> = ({
  isOpen,
  onClose,
  manifestationTitle = '',
  manifestationId,
}) => {
  const { activeScope, manifestations: allManifestations, addSuccessStory, updateManifestationStatus } = useAppStore();
  const manifestations = allManifestations.filter((item) => item.userId === activeScope);
  const linkedManifestation = manifestations.find((item) => item.id === manifestationId);
  const resolvedTitle = manifestationTitle || linkedManifestation?.title || '';

  const [story, setStory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    setSaveError(false);
    setStory('');

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [isOpen, manifestationId, manifestationTitle]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const finalTitle = resolvedTitle.trim();
    if (!finalTitle || !story.trim()) return;

    setIsSubmitting(true);
    setSaveError(false);
    try {
      const targetManifId = manifestationId || undefined;
      await addSuccessStory({
        manifestationId: targetManifId,
        userId: activeScope,
        author: activeScope === 'maia' ? 'Maia' : activeScope === 'facu' ? 'Facu' : 'Juntos',
        title: finalTitle,
        story: story.trim(),
        gratitudeNote: '',
        manifestedDate: new Date().toISOString().split('T')[0],
        signsEncountered: [],
        mindsetShift: '',
      });

      if (targetManifId) {
        await updateManifestationStatus(targetManifId, 'materializado');
      }

      setStory('');

      try {
        confetti({
          particleCount: 110,
          spread: 72,
          startVelocity: 34,
          origin: { y: 0.72 },
          colors: ['--color-accent', '--color-success', '--color-warning'].map((token) =>
            getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
          ),
        });
      } catch (error) {
        console.warn('[SuccessStory] Confetti could not be displayed:', error);
      }

      onClose();
    } catch (err) {
      setSaveError(true);
      console.warn('[SuccessStory] Error:', err);
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
          onClick={onClose}
          className="swiss-composer-scrim fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
        >
          <motion.div
            ref={dialogRef}
            variants={MODAL_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-story-modal-title"
            aria-describedby="success-story-modal-description"
            tabIndex={-1}
            className="swiss-modal swiss-composer relative w-full max-w-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8"
          >
            <header className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Trophy size={22} strokeWidth={1.7} className="mt-1 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <div>
                  <h2 id="success-story-modal-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Celebra lo que ya pasó
                  </h2>
                  <p id="success-story-modal-description" className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Guarda la historia real de una intención cumplida.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar historia de éxito"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--control-hover)] hover:text-[var(--color-ink)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="success-story-title" className="mb-2 block text-sm font-semibold">
                  ¿Qué se hizo realidad?
                </label>
                <input
                  id="success-story-title"
                  type="text"
                  value={resolvedTitle}
                  disabled
                  readOnly
                  aria-readonly="true"
                  className="swiss-composer-field min-h-12 w-full cursor-not-allowed select-none bg-[var(--control-bg)] px-4 py-3 text-base font-medium text-[var(--color-ink-muted)] opacity-80"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="success-story-body" className="text-sm font-semibold">
                    Cuenta cómo ocurrió
                  </label>
                  <VoiceDictationButton
                    size="md"
                    className="h-11 w-11 rounded-full"
                    onTranscript={(text) => setStory((previous) => (previous ? `${previous} ${text}` : text))}
                    previousTextTail={story}
                  />
                </div>
                <textarea
                  id="success-story-body"
                  rows={5}
                  value={story}
                  onChange={(event) => setStory(event.target.value)}
                  placeholder="Anota los detalles, las señales que recuerdas y cómo te sentiste."
                  required
                  className="swiss-composer-field min-h-32 w-full resize-y px-4 py-3 text-base leading-6"
                />
              </div>

              {saveError && (
                <p role="alert" className="text-sm font-medium text-[var(--color-swiss-red)]">
                  No se pudo guardar la historia. Inténtalo de nuevo.
                </p>
              )}

              <footer className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="swiss-btn-secondary min-h-12 rounded-full px-5 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !resolvedTitle.trim() || !story.trim()}
                  aria-busy={isSubmitting}
                  className="swiss-btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-60"
                >
                  {isSubmitting ? <Check size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                  {isSubmitting ? 'Guardando…' : 'Guardar historia'}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
