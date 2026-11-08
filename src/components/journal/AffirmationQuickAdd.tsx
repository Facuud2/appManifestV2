'use client';

import React, { useImperativeHandle, useRef } from 'react';
import { useAppStore } from '@/store';
import { findPoeticTerm } from '@/lib/affirmationEngine';
import { QuickAddComposer, type QuickAddComposerHandle } from './QuickAddComposer';

export interface AffirmationQuickAddHandle {
  submitAndClose: () => boolean;
}

export interface AffirmationQuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onSaved?: () => void;
  onOpenAdvanced?: () => void;
}

export const AffirmationQuickAdd = React.forwardRef<
  AffirmationQuickAddHandle,
  AffirmationQuickAddProps
>(function AffirmationQuickAdd(
  {
    isOpen,
    onClose,
    onDismiss,
    onSaved,
    onOpenAdvanced,
  },
  ref,
) {
  const { addAffirmation } = useAppStore();
  const composerRef = useRef<QuickAddComposerHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      submitAndClose: () => composerRef.current?.submitAndClose() ?? false,
    }),
    [],
  );

  return (
    <QuickAddComposer
      ref={composerRef}
      label="Nueva afirmación"
      placeholder="Soy siempre la primera opción"
      tone="rose"
      isOpen={isOpen}
      onClose={onClose}
      onDismiss={onDismiss}
      onSubmit={(text) => addAffirmation(text)}
      onSaved={onSaved}
      savedLabel="Guardada"
      submitAriaLabel="Agregar afirmación y seguir"
      hint="Enter guarda y sigue · Shift+Enter baja de línea"
      hintMobile="Enter o + guarda y sigue"
      maxRows={3}
      dictationSample="Soy siempre la primera opción y todo funciona a mi favor"
      advancedAction={
        onOpenAdvanced
          ? { label: 'Editor completo', onClick: onOpenAdvanced }
          : undefined
      }
      getWarning={(text) => {
        const term = findPoeticTerm(text);
        return term
          ? `«${term}» es un término poético; probá con algo más directo.`
          : null;
      }}
    />
  );
});
