'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, CloudRain, Radio, VolumeX, Loader2 } from 'lucide-react';
import { RampageSet } from '@/types';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';

interface DeleteRampageModalProps {
  isOpen: boolean;
  rampage: RampageSet | null;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const DeleteRampageModal: React.FC<DeleteRampageModalProps> = ({
  isOpen,
  rampage,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap, default focus on cancel (Apple HIG safe default), and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = requestAnimationFrame(() => {
      cancelBtnRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(timer);
      document.body.style.overflow = originalOverflow;
      previousActive?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!isDeleting) {
        event.stopPropagation();
        onCancel();
      }
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

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

  return (
    <AnimatePresence>
      {isOpen && rampage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
          onClick={() => {
            if (!isDeleting) onCancel();
          }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-md -webkit-backdrop-blur-md sm:items-center sm:p-4"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={APPLE_ELASTIC_SPRING}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-rampage-title"
            aria-describedby="delete-rampage-description"
            className="w-full max-w-md rounded-t-[32px] border border-[color:var(--border-subtle)] bg-[color:var(--color-modal-surface)] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 text-swiss-ink shadow-2xl backdrop-blur-xl sm:rounded-[26px] sm:border-[color:var(--glass-border)] sm:p-6"
          >
            {/* Grabber indicator for mobile action sheet */}
            <div
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-swiss-ink/15 sm:hidden"
              aria-hidden="true"
            />

            {/* Header with Apple-style Squircle icon */}
            <div className="flex items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-red-500/20 bg-red-500/10 text-red-500 shadow-sm dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-400">
                <Trash2 size={22} aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Confirmación requerida
                </span>
                <h3
                  id="delete-rampage-title"
                  className="mt-0.5 text-base sm:text-lg font-semibold leading-tight text-swiss-ink"
                >
                  ¿Eliminar este set de Rampage?
                </h3>
                <p
                  id="delete-rampage-description"
                  className="mt-1 text-xs sm:text-sm leading-relaxed text-swiss-ink-muted"
                >
                  Esta acción es permanente. El set y sus decretos dejarán de estar disponibles en tu Santuario.
                </p>
              </div>
            </div>

            {/* Set Preview Card */}
            <div className="mt-4 rounded-2xl border border-[color:var(--border-subtle)] bg-swiss-surface/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-semibold text-swiss-ink">
                  {rampage.title}
                </h4>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-swiss-control px-2 py-0.5 text-[10px] font-medium text-swiss-ink-muted">
                    {rampage.ambientSound === 'white_noise' ? (
                      <>
                        <Radio size={10} aria-hidden="true" /> Ruido blanco
                      </>
                    ) : rampage.ambientSound === 'astral_rain' ? (
                      <>
                        <CloudRain size={10} aria-hidden="true" /> Lluvia astral
                      </>
                    ) : (
                      <>
                        <VolumeX size={10} aria-hidden="true" /> Sin ambiente
                      </>
                    )}
                  </span>
                  <span className="rounded-md bg-swiss-accent/10 px-2 py-0.5 text-[10px] font-medium text-swiss-accentText">
                    {rampage.affirmations.length} {rampage.affirmations.length === 1 ? 'decreto' : 'decretos'}
                  </span>
                </div>
              </div>

              {rampage.affirmations[0]?.text && (
                <p className="mt-2 truncate text-xs italic text-swiss-ink-muted">
                  &ldquo;{rampage.affirmations[0].text}&rdquo;
                </p>
              )}
            </div>

            {/* Action Buttons (iOS Action Sheet style) */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white shadow-sm shadow-red-500/20 transition-all hover:bg-red-600 active:scale-[0.98] active:bg-red-700 disabled:pointer-events-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Eliminando set...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Eliminar set</span>
                  </>
                )}
              </button>

              <button
                ref={cancelBtnRef}
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-swiss-control px-5 text-sm font-semibold text-swiss-ink transition-all hover:bg-swiss-control/80 active:scale-[0.98] active:bg-swiss-control/60 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
