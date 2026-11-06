'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronRight, Mic, Sparkles, X } from 'lucide-react';
import {
  BACKDROP_TRANSITION,
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
    color: 'bg-[color:var(--pastel-sky)] text-[color:var(--pastel-sky-ink)]',
  },
  {
    id: 'affirmation' as const,
    title: 'Afirmación',
    description: 'Creá una frase con tu voz',
    icon: Mic,
    color: 'bg-[color:var(--pastel-peach)] text-[color:var(--pastel-peach-ink)]',
  },
  {
    id: 'rampage' as const,
    title: 'Rampage',
    description: 'Empezá a escuchar ahora',
    icon: Sparkles,
    color: 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]',
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
      const visibleMenu = [mobileMenuRef.current, desktopMenuRef.current].find(
        (menu) => menu && menu.getClientRects().length > 0,
      );
      visibleMenu?.focus();
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

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (mobileMenuRef.current?.contains(target) || desktopMenuRef.current?.contains(target)) {
        return;
      }
      // The trigger toggles the menu itself; let its click decide.
      if (target instanceof Element && target.closest('[aria-expanded="true"]')) return;
      closeAndRestoreFocus();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeAndRestoreFocus, isOpen]);

  const desktopPosition = anchor && typeof window !== 'undefined'
    ? {
        left: Math.max(16, Math.min(anchor.left - 214, window.innerWidth - 286)),
        top: Math.max(
          16,
          Math.min(anchor.top + anchor.height / 2 - 96, window.innerHeight - 264),
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
          whileTap={{ scale: 0.98 }}
          className={`create-action group relative flex w-full items-center gap-3.5 text-left transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-swiss-focus ${action.color} ${
            mobile
              ? 'mx-2 mb-1.5 min-h-[4.25rem] w-[calc(100%-1rem)] rounded-[16px] px-3.5'
              : 'min-h-[3.5rem] rounded-[12px] px-2.5'
          }`}
        >
          <span className="create-action-icon flex h-9 w-9 shrink-0 items-center justify-center">
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold">
              {action.title}
            </span>
            <span className="mt-0.5 block truncate text-xs opacity-80">
              {action.description}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            size={16}
            className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5"
          />
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
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[10px] lg:hidden"
        />
      )}
      {isOpen && (
        <motion.div
          key="mobile-sheet"
          ref={mobileMenuRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-action-title-mobile"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: '100%',
            transition: { duration: 0.22, ease: EMIL_EASE_OUT },
          }}
          transition={EMIL_SHEET_SPRING}
          onMouseDown={(event) => event.stopPropagation()}
          className="swiss-modal fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-3 right-3 z-[61] mx-auto w-auto max-w-lg overflow-hidden rounded-[28px] p-0 shadow-modal focus:outline-none lg:hidden"
        >
          <div aria-hidden="true" className="flex justify-center pb-1 pt-2.5">
            <span className="h-1 w-9 rounded-full bg-swiss-ink-light/40" />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-1">
            <div>
              <h2
                id="create-action-title-mobile"
                className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-swiss-ink"
              >
                Crear
              </h2>
              <p className="mt-0.5 text-xs text-swiss-ink-light">¿Qué querés sumar hoy?</p>
            </div>
            <button
              type="button"
              onClick={closeAndRestoreFocus}
              aria-label="Cerrar opciones de creación"
              className="swiss-pill inline-flex min-h-9 min-w-9 items-center justify-center text-swiss-ink-muted transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
            className="pb-2"
          >
            {renderActions(true)}
          </motion.div>
          <div className="border-t border-swiss-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={closeAndRestoreFocus}
              className="min-h-11 w-full rounded-[14px] text-[0.9375rem] font-medium text-swiss-ink transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              Cancelar
            </button>
          </div>
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
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-action-title-desktop"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{
            opacity: 0,
            scale: 0.98,
            y: -2,
            transition: { duration: 0.15, ease: EMIL_EASE_OUT },
          }}
          transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            left: desktopPosition.left,
            top: desktopPosition.top,
            transformOrigin: '100% 50%',
          }}
          className="swiss-modal absolute z-[61] hidden w-[17.5rem] overflow-hidden rounded-[18px] p-1.5 shadow-dropdown focus:outline-none lg:block"
        >
          <h2
            id="create-action-title-desktop"
            className="px-2.5 pb-1 pt-2 text-xs font-medium text-swiss-ink-light"
          >
            Crear
          </h2>
          <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show">
            {renderActions(false)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
