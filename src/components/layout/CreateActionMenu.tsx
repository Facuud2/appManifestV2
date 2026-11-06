'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronRight, Mic, Sparkles, X } from 'lucide-react';
import {
  BACKDROP_TRANSITION,
  EMIL_CARD_TAP,
  EMIL_EASE_OUT,
  EMIL_SHEET_SPRING,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';

export type CreateAction = 'manifestation' | 'affirmation' | 'rampage';

interface CreateActionMenuProps {
  isOpen: boolean;
  anchor: { left: number; top: number; width: number; height: number } | null;
  onClose: () => void;
  onSelect: (action: CreateAction) => void;
}

const actions = [
  {
    id: 'manifestation' as const,
    title: 'Manifestación',
    description: 'Escribí o contá un deseo',
    icon: BookOpen,
    color: 'bg-swiss-actionBlue text-swiss-accent',
  },
  {
    id: 'affirmation' as const,
    title: 'Afirmación',
    description: 'Creá una frase con tu voz',
    icon: Mic,
    color: 'bg-swiss-actionPeach text-swiss-accent',
  },
  {
    id: 'rampage' as const,
    title: 'Rampage',
    description: 'Empezá a escuchar ahora',
    icon: Sparkles,
    color: 'bg-swiss-actionLavender text-swiss-accent',
  },
];

export const CreateActionMenu: React.FC<CreateActionMenuProps> = ({
  isOpen,
  anchor,
  onClose,
  onSelect,
}) => {
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const buttons = [
        ...Array.from(mobileMenuRef.current?.querySelectorAll('button') ?? []),
        ...Array.from(desktopMenuRef.current?.querySelectorAll('button') ?? []),
      ];
      buttons.find((button) => button.getClientRects().length > 0)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }

      if (event.key !== 'Tab') return;

      const buttons = [
        ...Array.from(mobileMenuRef.current?.querySelectorAll('button') ?? []),
        ...Array.from(desktopMenuRef.current?.querySelectorAll('button') ?? []),
      ].filter((button) => button.getClientRects().length > 0);
      if (buttons.length === 0) return;

      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAndRestoreFocus, isOpen]);

  const desktopPosition = anchor && typeof window !== 'undefined'
    ? {
        left: Math.max(16, Math.min(anchor.left - 214, window.innerWidth - 270)),
        top: Math.max(
          16,
          Math.min(anchor.top + anchor.height / 2 - 78, window.innerHeight - 230),
        ),
      }
    : { left: '50%', top: '30%' };

  const renderActions = (mobile: boolean) =>
    actions.map((action) => {
      const Icon = action.icon;

      return (
        <motion.button
          key={action.id}
          type="button"
          onClick={() => onSelect(action.id)}
          variants={STAGGER_ITEM}
          whileTap={EMIL_CARD_TAP}
          className={
            mobile
              ? 'flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-swiss-border bg-swiss-surface/70 px-2 text-center transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus'
              : 'flex min-h-[58px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus'
          }
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${action.color}`}
          >
            <Icon aria-hidden="true" size={17} />
          </span>
          {mobile ? (
            <span className="text-xs font-medium leading-tight text-swiss-ink">{action.title}</span>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-swiss-ink">{action.title}</span>
                <span className="mt-0.5 block text-xs text-swiss-ink-muted">
                  {action.description}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={15} className="text-swiss-ink-light" />
            </>
          )}
        </motion.button>
      );
    });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-backdrop"
          variants={BACKDROP_TRANSITION}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-hidden="true"
          onMouseDown={closeAndRestoreFocus}
          className="fixed inset-0 z-[60] bg-swiss-ink/25 backdrop-blur-md lg:hidden"
        />
      )}
      {isOpen && (
        <motion.div
          key="mobile-sheet"
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-action-title-mobile"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: '100%',
            transition: { duration: 0.2, ease: EMIL_EASE_OUT },
          }}
          transition={EMIL_SHEET_SPRING}
          onMouseDown={(event) => event.stopPropagation()}
          className="swiss-modal fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-[61] mx-auto w-auto max-w-lg rounded-[var(--radius-modal)] p-4 shadow-modal sm:p-5 lg:hidden"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h2
              id="create-action-title-mobile"
              className="text-base font-semibold text-swiss-ink"
            >
              ¿Qué querés crear?
            </h2>
            <button
              type="button"
              onClick={closeAndRestoreFocus}
              aria-label="Cerrar opciones de creación"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-swiss-ink-muted transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-2"
          >
            {renderActions(true)}
          </motion.div>
        </motion.div>
      )}
      {isOpen && (
        <div
          key="desktop-backdrop"
          className="fixed inset-0 z-[60] hidden lg:block"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAndRestoreFocus();
          }}
        />
      )}
      {isOpen && (
        <motion.div
          key="desktop-popover"
          ref={desktopMenuRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-action-title-desktop"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0.99,
            transition: { duration: 0.15, ease: EMIL_EASE_OUT },
          }}
          transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            left: desktopPosition.left,
            top: desktopPosition.top,
            transformOrigin: '100% 50%',
          }}
          className="swiss-card absolute z-[61] hidden w-60 p-2.5 shadow-dropdown lg:block"
        >
          <h2
            id="create-action-title-desktop"
            className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-ink-light"
          >
            ¿Qué querés crear?
          </h2>
          <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show">
            {renderActions(false)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
