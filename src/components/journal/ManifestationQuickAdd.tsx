'use client';

import React, { useId, useImperativeHandle, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { putMedia } from '@/lib/mediaStorage';
import {
  buildMediaStorageKey,
  createManifestationId,
} from '@/lib/manifestationAttachments';
import { stopActivePreview } from '@/lib/audioPreviewBus';
import { useAttachmentDraft } from '@/hooks/useAttachmentDraft';
import { QuickAddComposer, type QuickAddComposerHandle } from './QuickAddComposer';
import { AttachmentMenu } from './attachments/AttachmentMenu';
import { AttachmentChipRow } from './attachments/AttachmentChipRow';
import { MusicSearchSheet } from './attachments/MusicSearchSheet';

export interface ManifestationQuickAddHandle {
  submitAndClose: () => boolean;
}

export interface ManifestationQuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onSaved?: () => void;
  onOpenAdvanced?: () => void;
}

/** Shortens the first meaningful line into a card title. */
const deriveTitle = (description: string) => {
  const firstLine = description.trim().split(/[\n.!?]/, 1)[0]?.trim() ?? '';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69).trimEnd()}…` : firstLine;
};

export const ManifestationQuickAdd = React.forwardRef<
  ManifestationQuickAddHandle,
  ManifestationQuickAddProps
>(function ManifestationQuickAdd(
  {
    isOpen,
    onClose,
    onDismiss,
    onSaved,
    onOpenAdvanced,
  },
  ref,
) {
  const { activeScope, addManifestation } = useAppStore();
  const composerRef = useRef<QuickAddComposerHandle>(null);
  const titleId = useId();
  const anchorId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const [title, setTitle] = useState('');
  const [sensoryAnchor, setSensoryAnchor] = useState('');
  const [isMusicOpen, setIsMusicOpen] = useState(false);

  const draft = useAttachmentDraft();

  useImperativeHandle(
    ref,
    () => ({
      submitAndClose: () => composerRef.current?.submitAndClose() ?? false,
    }),
    [],
  );

  const resetOptions = () => {
    setTitle('');
    setSensoryAnchor('');
    if (detailsRef.current) detailsRef.current.open = false;
  };

  const resetAttachments = () => {
    draft.reset();
    setIsMusicOpen(false);
  };

  const handleSaved = () => {
    resetOptions();
    onSaved?.();
  };

  const handleClose = () => {
    if (isMusicOpen) return;
    resetOptions();
    resetAttachments();
    onClose();
  };

  const handleDismiss = () => {
    if (isMusicOpen) return;
    resetOptions();
    resetAttachments();
    (onDismiss ?? onClose)();
  };

  const handleSubmit = async (text: string) => {
    const description = text.trim() || title.trim();
    if (!description) return;

    const generatedTitle = deriveTitle(description);
    const author = activeScope === 'maia' ? 'Maia' : activeScope === 'facu' ? 'Facu' : 'Juntos';

    const id = createManifestationId();
    const songAttachment = draft.song;
    const draftMedia = draft.media;
    const mediaAttachment = draft.buildMediaAttachment(id);

    // Capture the blob before the draft is reset, so the file survives even if
    // the composer clears its chips immediately.
    const blobToPersist = draftMedia?.blob ?? null;
    const storageKey = mediaAttachment?.storageKey ?? null;

    resetOptions();
    resetAttachments();

    if (blobToPersist && storageKey) {
      await putMedia(storageKey, blobToPersist);
    }

    await addManifestation({
      id,
      userId: activeScope,
      author,
      title: title.trim() || generatedTitle || description.slice(0, 72),
      description,
      sensoryAnchor: sensoryAnchor.trim() || undefined,
      status: 'semilla',
      songAttachment: songAttachment ?? null,
      mediaAttachment: mediaAttachment ?? null,
    });
  };

  const options = (
    <details
      ref={detailsRef}
      className="quick-add-options group mt-2.5 px-3 py-2"
    >
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[color:var(--color-ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus">
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
        <span className="min-w-0">
          Título y anclaje sensorial
          <span className="hidden sm:inline"> · opcional, se completan solos</span>
        </span>
      </summary>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={titleId}
            className="mb-1 block text-[0.6875rem] font-semibold text-[color:var(--color-ink-muted)]"
          >
            Título
          </label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Se genera si lo dejás vacío"
            maxLength={120}
            className="swiss-input min-h-10 w-full px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label
              htmlFor={anchorId}
              className="text-[0.6875rem] font-semibold text-[color:var(--color-ink-muted)]"
            >
              Anclaje sensorial
            </label>
            <VoiceDictationButton
              size="sm"
              className="h-8 w-8 rounded-full"
              label="Dictar anclaje sensorial"
              onTranscript={(transcript) =>
                setSensoryAnchor((previous) =>
                  previous ? `${previous} ${transcript}` : transcript,
                )
              }
              previousTextTail={sensoryAnchor}
            />
          </div>
          <input
            id={anchorId}
            type="text"
            value={sensoryAnchor}
            onChange={(event) => setSensoryAnchor(event.target.value)}
            placeholder="Un sonido, una sensación o un lugar."
            maxLength={200}
            className="swiss-input min-h-10 w-full px-3 py-2 text-sm"
          />
        </div>
      </div>
    </details>
  );

  const leadingAction = (
    <AttachmentMenu
      disabled={draft.isProcessing || Boolean(draft.song && draft.media)}
      onPhoto={draft.attachPhoto}
      onVideo={draft.attachVideo}
      onSong={() => {
        stopActivePreview();
        setIsMusicOpen(true);
      }}
    />
  );

  const attachments = (
    <>
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
      {draft.error ? (
        <p
          role="alert"
          className="mt-1.5 px-1 text-xs leading-5 text-[color:var(--color-swiss-red)]"
        >
          {draft.error}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <QuickAddComposer
        ref={composerRef}
        label="Nueva manifestación"
        placeholder="Quiero manifestar…"
        tone="butter"
        variant="manifestation"
        isOpen={isOpen}
        onClose={handleClose}
        onDismiss={handleDismiss}
        onSubmit={handleSubmit}
        onSaved={handleSaved}
        savedLabel="Intención guardada"
        savedLabelShort="Guardada"
        savedToast="Manifestación guardada"
        submitAriaLabel="Guardar manifestación"
        hint="Enter guarda y sigue · Shift+Enter baja de línea"
        hintMobile="Enter o ↑ guarda y cierra"
        maxRows={4}
        options={options}
        leadingAction={leadingAction}
        attachments={attachments}
        disableDismiss={isMusicOpen}
        submitDisabled={draft.isProcessing}
        dictationSample="Quiero manifestar que mi vida se ordena con facilidad"
        advancedAction={
          onOpenAdvanced
            ? { label: 'Editor completo', onClick: onOpenAdvanced }
            : undefined
        }
      />

      <MusicSearchSheet
        isOpen={isMusicOpen}
        onClose={() => setIsMusicOpen(false)}
        onSelect={draft.selectSong}
      />
    </>
  );
});
