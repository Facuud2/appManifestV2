'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { BACKDROP_TRANSITION, MODAL_TRANSITION } from '@/lib/iosSprings';
import { putMedia } from '@/lib/mediaStorage';
import { createManifestationId } from '@/lib/manifestationAttachments';
import { stopActivePreview } from '@/lib/audioPreviewBus';
import { useAttachmentDraft } from '@/hooks/useAttachmentDraft';
import { AttachmentMenu } from './attachments/AttachmentMenu';
import { AttachmentChipRow } from './attachments/AttachmentChipRow';
import { MusicSearchSheet } from './attachments/MusicSearchSheet';

interface ManifestationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManifestationEditorModal: React.FC<ManifestationEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeScope, addManifestation } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sensoryAnchor, setSensoryAnchor] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const draft = useAttachmentDraft();

  const handleClose = () => {
    if (isMusicOpen) return;
    setIsMusicOpen(false);
    draft.reset();
    onClose();
  };

  /* If the parent closes the modal, drop any attachment the user had picked. */
  useEffect(() => {
    if (isOpen) return;
    draft.reset();
    setIsMusicOpen(false);
    // `reset` is stable; running this only on close keeps the draft intact while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    setSaveError(false);

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (isMusicOpen) return;
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
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
    if (!description.trim()) return;

    const firstLine = description.trim().split(/[\n.!?]/, 1)[0].trim();
    const generatedTitle =
      firstLine.length > 72 ? `${firstLine.slice(0, 69).trimEnd()}…` : firstLine;

    const id = createManifestationId();
    const songAttachment = draft.song;
    const draftMedia = draft.media;
    const mediaAttachment = draft.buildMediaAttachment(id);
    const blobToPersist = draftMedia?.blob ?? null;
    const storageKey = mediaAttachment?.storageKey ?? null;

    setIsSubmitting(true);
    setSaveError(false);
    try {
      if (blobToPersist && storageKey) {
        await putMedia(storageKey, blobToPersist);
      }

      await addManifestation({
        id,
        userId: activeScope,
        author: activeScope === 'maia' ? 'Maia' : activeScope === 'facu' ? 'Facu' : 'Juntos',
        title: title.trim() || generatedTitle || description.trim().slice(0, 72),
        description: description.trim(),
        sensoryAnchor: sensoryAnchor.trim() || undefined,
        status: 'semilla',
        targetDate: targetDate || undefined,
        songAttachment: songAttachment ?? null,
        mediaAttachment: mediaAttachment ?? null,
      });

      setTitle('');
      setDescription('');
      setSensoryAnchor('');
      setTargetDate('');
      handleClose();
    } catch (err) {
      setSaveError(true);
      console.warn('[ManifestationEditor] Error saving:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
        <motion.div
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
          className="manifestation-composer-scrim fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
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
            aria-labelledby="manifestation-modal-title"
            aria-describedby="manifestation-modal-description"
            tabIndex={-1}
            className="manifestation-composer swiss-modal relative w-full max-w-[27rem] p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6"
          >
            <header className="mb-4 flex items-start justify-between gap-4 sm:mb-3">
              <div className="min-w-0">
                <p className="manifestation-composer-eyebrow mb-1.5">Nueva intención</p>
                <h2 id="manifestation-modal-title" className="text-[1.375rem] font-semibold tracking-[-0.024em]">
                  Manifestá a tu manera
                </h2>
                <p id="manifestation-modal-description" className="mt-2 max-w-sm text-xs leading-[1.55] text-[var(--color-ink-muted)] sm:text-sm">
                  Podés escribir libremente o contármelo con tu voz. Yo me ocupo de ordenarlo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar formulario de manifestación"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--control-bg)] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--control-hover)] hover:text-[var(--color-ink)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-3">
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

              <div className="manifestation-composer-field relative">
                <label htmlFor="manifestation-description" className="sr-only">
                  Tu intención
                </label>
                <textarea
                  id="manifestation-description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Quiero manifestar..."
                  required
                  className="swiss-composer-field h-[8.5rem] min-h-[8.5rem] w-full resize-none rounded-[12px] px-4 pb-14 pt-4 text-sm leading-6"
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
                  size="lg"
                  className="manifestation-composer-mic absolute bottom-3 right-3 h-11 w-11 rounded-xl border-0"
                  onTranscript={(text) =>
                    setDescription((previous) => (previous ? `${previous} ${text}` : text))
                  }
                  previousTextTail={description}
                />
              </div>

              {draft.error ? (
                <p role="alert" className="text-xs leading-5 text-[var(--color-swiss-red)]">
                  {draft.error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-1">
                <details className="group manifestation-composer-details">
                  <summary
                    aria-label="Más opciones para personalizar la intención"
                    className="flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-full px-0 text-xs text-[var(--color-ink-muted)] focus-visible:outline"
                  >
                    <span>Más opciones</span>
                    <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="manifestation-composer-details-panel mt-2 space-y-3">
                    <div>
                      <label htmlFor="manifestation-title" className="mb-1.5 block text-xs font-medium">
                        Título
                      </label>
                      <input
                        id="manifestation-title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Se genera automáticamente si lo dejas vacío"
                        className="swiss-composer-field min-h-11 w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor="manifestation-anchor" className="text-xs font-medium">
                          Anclaje sensorial
                        </label>
                        <VoiceDictationButton
                          size="md"
                          className="h-9 w-9 rounded-full"
                          onTranscript={(text) =>
                            setSensoryAnchor((previous) => (previous ? `${previous} ${text}` : text))
                          }
                          previousTextTail={sensoryAnchor}
                        />
                      </div>
                      <input
                        id="manifestation-anchor"
                        type="text"
                        value={sensoryAnchor}
                        onChange={(event) => setSensoryAnchor(event.target.value)}
                        placeholder="Un sonido, una sensación o un lugar."
                        className="swiss-composer-field min-h-11 w-full px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </details>
              </div>

              {saveError && (
                <p role="alert" className="text-sm font-medium text-[var(--color-swiss-red)]">
                  No se pudo guardar la manifestación. Inténtalo de nuevo.
                </p>
              )}

              <footer className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  aria-busy={isSubmitting}
                  className="manifestation-composer-submit swiss-btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 text-sm font-semibold disabled:opacity-60"
                >
                  {isSubmitting ? <Check size={17} aria-hidden="true" /> : null}
                  {isSubmitting ? 'Guardando…' : 'Guardar intención'}
                  {!isSubmitting && <ChevronRight size={17} aria-hidden="true" />}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <MusicSearchSheet
      isOpen={isMusicOpen}
      onClose={() => setIsMusicOpen(false)}
      onSelect={draft.selectSong}
    />
  </>
  );
};
