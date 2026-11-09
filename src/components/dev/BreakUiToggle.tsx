'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store';

type FixtureMode = 'demo' | 'worst' | 'empty' | 'one' | 'thousand';

const SEGMENTS: { id: FixtureMode; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'worst', label: 'Worst case' },
  { id: 'empty', label: 'Empty' },
  { id: 'one', label: 'One' },
  { id: 'thousand', label: '1,000 rows' },
];

export const BreakUiToggle: React.FC = () => {
  const { fixtureMode, setFixtureMode } = useAppStore();

  // Read URL param on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data') as FixtureMode | null;
    if (dataParam && ['demo', 'worst', 'empty', 'one', 'thousand'].includes(dataParam)) {
      setFixtureMode(dataParam);
    }
  }, [setFixtureMode]);

  const handleSelect = (mode: FixtureMode) => {
    setFixtureMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'demo') {
        url.searchParams.delete('data');
      } else {
        url.searchParams.set('data', mode);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <aside
      aria-label="Break UI dev fixture toggle"
      data-testid="break-ui-toggle"
      className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 select-none"
    >
      <nav
        role="group"
        aria-label="Seleccionar conjunto de datos de prueba"
        className="flex items-center gap-0.5 rounded-full border border-neutral-300 bg-neutral-200/95 p-1 shadow-md backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/95 font-sans text-xs"
      >
        <span className="sr-only">Modo de datos:</span>
        {SEGMENTS.map((seg) => {
          const isActive = fixtureMode === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => handleSelect(seg.id)}
              aria-pressed={isActive}
              className={`rounded-full min-h-[36px] px-3 py-1.5 font-medium transition-colors ${
                isActive
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {seg.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
