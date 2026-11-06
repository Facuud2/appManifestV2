'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import {
  BACKDROP_TRANSITION,
  EMIL_SHEET_SPRING,
  MODAL_TRANSITION,
} from '@/lib/iosSprings';

interface AffirmationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = ['Relaciones', 'Bienestar', 'Abundancia', 'Proyecto personal'];

export const AffirmationEditorModal: React.FC<AffirmationEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addAffirmation } = useAppStore();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const syncViewport = () => setIsMobileSheet(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setText('');
    setCategory('');
    setError('');

    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', closeOnEscape);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const affirmation = text.trim();
    if (!affirmation || isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    try {
      await addAffirmation(affirmation, category || undefined);
      onClose();
    } catch (submitError) {
      console.error('No se pudo guardar la afirmación.', submitError);
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled)',
      ),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const modalTransition = isMobileSheet
    ? {
        hidden: { opacity: 0, y: '100%' },
        visible: {
          opacity: 1,
          y: 0,
          transition: EMIL_SHEET_SPRING,
        },
        exit: {
          opacity: 0,
          y: '100%',
          transition: EMIL_SHEET_SPRING,
        },
      }
    : MODAL_TRANSITION;

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
          className="fixed inset-0 z-50 flex items-end justify-center bg-swiss-ink/25 p-0 backdrop-blur-md sm:items-center sm:p-4"
        >
          <motion.section
            variants={modalTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleDialogKeyDown}
            aria-labelledby="affirmation-editor-title"
            aria-modal="true"
            role="dialog"
            className="swiss-modal w-full max-w-lg rounded-t-[var(--radius-modal)] rounded-b-none p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[var(--radius-modal)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-ink-light">
                  Nueva afirmación
                </p>
                <h2
                  id="affirmation-editor-title"
                  className="mt-2 text-xl font-medium tracking-tight text-swiss-ink sm:text-2xl"
                >
                  Creá una frase que sea tuya
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar nueva afirmación"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-swiss-ink-muted transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <p className="mt-4 max-w-md text-sm leading-5 text-swiss-ink-muted">
              Decime qué querés sentir o manifestar. Vamos a convertirlo en una afirmación breve y
              natural.
            </p>

            <form onSubmit={handleSubmit} className="mt-5">
              <label htmlFor="new-affirmation-text" className="sr-only">
                Escribí una afirmación
              </label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="new-affirmation-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Quiero sentir más..."
                  maxLength={500}
                  rows={4}
                  required
                  className="swiss-input min-h-32 w-full resize-none px-4 py-4 pr-16 text-sm leading-6"
                />
                <VoiceDictationButton
                  size="md"
                  className="absolute bottom-3 right-3 h-11 w-11 rounded-xl border-0 bg-swiss-accent text-swiss-accentFg hover:opacity-90"
                  onTranscript={(transcript) =>
                    setText((previous) => (previous ? `${previous} ${transcript}` : transcript))
                  }
                  previousTextTail={text}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2" aria-label="Categoría opcional">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => setCategory(category === item ? '' : item)}
                    className={`min-h-8 rounded-full px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                      category === item
                        ? 'bg-swiss-accent text-swiss-accentFg'
                        : 'bg-swiss-control text-swiss-ink-muted hover:text-swiss-ink'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" className="mt-3 text-sm text-swiss-red">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!text.trim() || isSubmitting}
                className="swiss-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando…' : 'Crear afirmación'}
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
