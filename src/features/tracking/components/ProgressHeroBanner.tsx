'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface ProgressHeroBannerProps {
  onOpenNewProgress: (manifId?: string) => void;
}

export const ProgressHeroBanner: React.FC<ProgressHeroBannerProps> = ({
  onOpenNewProgress,
}) => {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display-title text-swiss-ink">Avances</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
          Bitácora de señales, certezas internas y movimientos reales que te acercan a lo que manifestás.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onOpenNewProgress()}
        className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
      >
        <Plus size={16} aria-hidden="true" />
        Registrar avance
      </button>
    </header>
  );
};
