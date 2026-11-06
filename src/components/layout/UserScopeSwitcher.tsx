'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store';
import { UserScope } from '@/types';
import { Check, ChevronDown, Users } from 'lucide-react';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export const UserScopeSwitcher: React.FC = () => {
  const { activeScope, setActiveScope, isFacuCalibrated, isMaiaCalibrated } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const scopes: { id: UserScope; label: string; indicator?: boolean }[] = [
    { id: 'maia', label: 'Maia', indicator: isMaiaCalibrated },
    { id: 'facu', label: 'Facu', indicator: isFacuCalibrated },
    { id: 'shared', label: 'Ambos' },
  ];

  const activeLabel = scopes.find((scope) => scope.id === activeScope)?.label ?? 'Perfil';

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !switcherRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div
      ref={switcherRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Perfil actual: ${activeLabel}. Cambiar perfil`}
        className="swiss-pill inline-flex min-h-11 items-center gap-2 px-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-swiss-focus"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-swiss-actionLavender text-xs font-semibold text-swiss-accent">
          {activeScope === 'shared' ? <Users aria-hidden="true" size={15} /> : activeLabel[0]}
        </span>
        <span className="max-w-20 truncate text-swiss-ink">{activeLabel}</span>
        <ChevronDown
          aria-hidden="true"
          size={15}
          className={`text-swiss-ink-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="group"
            aria-label="Perfiles disponibles"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
            style={{ transformOrigin: '100% 0%' }}
            className="swiss-card absolute right-0 top-full z-50 mt-2 min-w-40 p-1.5"
          >
            {scopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                aria-pressed={activeScope === scope.id}
                onClick={() => {
                  setActiveScope(scope.id);
                  setIsOpen(false);
                }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm text-swiss-ink transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <span className="flex items-center gap-2">
                  {scope.label}
                  {scope.indicator && (
                    <span
                      aria-label="Voz calibrada"
                      className="h-1.5 w-1.5 rounded-full bg-swiss-success"
                    />
                  )}
                </span>
                {activeScope === scope.id && <Check aria-hidden="true" size={16} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
