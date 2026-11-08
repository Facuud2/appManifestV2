'use client';

import React, { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { QuickAddComposer } from './QuickAddComposer';

interface ManifestationQuickAddProps {
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

export const ManifestationQuickAdd: React.FC<ManifestationQuickAddProps> = ({
  isOpen,
  onClose,
  onDismiss,
  onSaved,
  onOpenAdvanced,
}) => {
  const { activeScope, addManifestation } = useAppStore();
  const titleId = useId();
  const anchorId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const [title, setTitle] = useState('');
  const [sensoryAnchor, setSensoryAnchor] = useState('');

  const handleSaved = () => {
    setTitle('');
    setSensoryAnchor('');
    if (detailsRef.current) detailsRef.current.open = false;
    onSaved?.();
  };

  const handleSubmit = (text: string) => {
    const description = text.trim();
    const generatedTitle = deriveTitle(description);
    const author = activeScope === 'maia' ? 'Maia' : activeScope === 'facu' ? 'Facu' : 'Juntos';

    return addManifestation({
      userId: activeScope,
      author,
      title: title.trim() || generatedTitle || description.slice(0, 72),
      description,
      sensoryAnchor: sensoryAnchor.trim() || undefined,
      status: 'semilla',
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

  return (
    <QuickAddComposer
      label="Nueva manifestación"
      placeholder="Quiero manifestar…"
      tone="butter"
      isOpen={isOpen}
      onClose={onClose}
      onDismiss={onDismiss}
      onSubmit={handleSubmit}
      onSaved={handleSaved}
      savedLabel="Intención guardada"
      savedLabelShort="Guardada"
      submitAriaLabel="Agregar manifestación y seguir"
      hint="Enter guarda y sigue · Shift+Enter baja de línea"
      hintMobile="Enter o + guarda y sigue"
      maxRows={4}
      options={options}
      dictationSample="Quiero manifestar que mi vida se ordena con facilidad"
      advancedAction={
        onOpenAdvanced
          ? { label: 'Editor completo', onClick: onOpenAdvanced }
          : undefined
      }
    />
  );
};
