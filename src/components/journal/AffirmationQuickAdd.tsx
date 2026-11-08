'use client';

import React from 'react';
import { useAppStore } from '@/store';
import { findPoeticTerm } from '@/lib/affirmationEngine';
import { QuickAddComposer } from './QuickAddComposer';

interface AffirmationQuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onSaved?: () => void;
  onOpenAdvanced?: () => void;
}

export const AffirmationQuickAdd: React.FC<AffirmationQuickAddProps> = ({
  isOpen,
  onClose,
  onDismiss,
  onSaved,
  onOpenAdvanced,
}) => {
  const { addAffirmation } = useAppStore();

  return (
    <QuickAddComposer
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
};
