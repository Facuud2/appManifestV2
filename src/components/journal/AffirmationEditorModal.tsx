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
import { putMedia } from '@/lib/mediaStorage';
import { stopActivePreview } from '@/lib/audioPreviewBus';
import { useAttachmentDraft } from '@/hooks/useAttachmentDraft';
import { AttachmentMenu } from './attachments/AttachmentMenu';
import { AttachmentChipRow } from './attachments/AttachmentChipRow';
import { MusicSearchSheet } from './attachments/MusicSearchSheet';

interface AffirmationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AffirmationEditorModal: React.FC<AffirmationEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addAffirmation } = useAppStore();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const draft = useAttachmentDraft();

  const handleClose = () => {
    if (isMusicOpen) return;
    setIsMusicOpen(false);
    draft.reset();
    onClose();
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const syncViewport = () => setIsMobileSheet(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      draft.reset();
      setIsMusicOpen(false);
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setText('');
    setError('');

    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', closeOnEscape);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const affirmation = text.trim();
    if (!affirmation || isSubmitting) return;

    const id = `aff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const songAttachment = draft.song;
    const draftMedia = draft.media;
    const mediaAttachment = draft.buildMediaAttachment(id);
    const blobToPersist = draftMedia?.blob ?? null;
    const storageKey = mediaAttachment?.storageKey ?? null;

    setIsSubmitting(true);
    setError('');
    try {
      if (blobToPersist && storageKey) {
        await putMedia(storageKey, blobToPersist);
      }

      await addAffirmation({
        text: affirmation,
        songAttachment: songAttachment ?? null,
        mediaAttachment: mediaAttachment ?? null,
      });
      handleClose();
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
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="affirmation-editor-scrim"
            variants={BACKDROP_TRANSITION}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[10px] sm:items-center sm:p-4"
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
                <p className="text-[0.8125rem] font-semibold text-swiss-ink-light">
                  Nueva afirmación
                </p>
                <h2
                  id="affirmation-editor-title"
                  className="mt-1.5 text-[1.375rem] font-semibold tracking-[-0.024em] text-swiss-ink sm:text-2xl"
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
              Escribí una frase directa y natural, como si ya fuera real. Sin poesía ni palabras
              raras.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <AttachmentChipRow
                song={draft.song}
                media={
                  draft.media
                    ? { attachment: draft.media.attachment, previewUrl: draft.media.previewUrl }
                    : null
                }
                onRemoveSong={draft.removeSong}
                onRemoveMedia={draft.removeMedia}
              />

              <label htmlFor="new-affirmation-text" className="sr-only">
                Escribí una afirmación
              </label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="new-affirmation-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Por ejemplo: Soy siempre la primera opción"
                  maxLength={500}
                  rows={4}
                  required
                  className="swiss-input min-h-32 w-full resize-none px-4 pb-14 pt-4 pr-16 text-sm leading-6"
                />
                <div className="absolute bottom-3 left-3">
                  <AttachmentMenu
                    disabled={draft.isProcessing || Boolean(draft.song && draft.media)}
                    onPhoto={draft.attachPhoto}
                    onVideo={draft.attachVideo}
                    onSong={() => {
                      stopActivePreview();
                      setIsMusicOpen(true);
                    }}
                  />
                </div>
                <VoiceDictationButton
                  size="md"
                  className="!absolute bottom-3 right-3 h-11 w-11 rounded-xl border-0 bg-swiss-accent text-swiss-accentFg hover:opacity-90"
                  onTranscript={(transcript) =>
                    setText((previous) => (previous ? `${previous} ${transcript}` : transcript))
                  }
                  previousTextTail={text}
                />
              </div>

              {draft.error ? (
                <p role="alert" className="text-xs leading-5 text-[var(--color-swiss-red)]">
                  {draft.error}
                </p>
              ) : null}

              {error && (
                <p role="alert" className="mt-3 text-sm text-swiss-red">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!text.trim() || isSubmitting}
                className="swiss-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando…' : 'Crear afirmación'}
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>

    <MusicSearchSheet
      isOpen={isMusicOpen}
      onClose={() => setIsMusicOpen(false)}
      onSelect={(track) => draft.selectSong(track)}
    />
  </>
  );
};
