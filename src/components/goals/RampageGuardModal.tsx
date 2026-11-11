'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookmarkCheck, Trash2 } from 'lucide-react';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';

interface RampageGuardModalProps {
  isOpen: boolean;
  activeTitle?: string;
  affirmationCount?: number;
  onConfirmSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const RampageGuardModal: React.FC<RampageGuardModalProps> = ({
  isOpen,
  activeTitle = 'Rampage actual',
  affirmationCount = 0,
  onConfirmSave,
  onDiscard,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
          onClick={onCancel}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={APPLE_ELASTIC_SPRING}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rampage-guard-title"
            className="w-full max-w-md rounded-[24px] border border-[color:var(--glass-border)] bg-[color:var(--bg-card)] p-6 text-swiss-ink shadow-2xl"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-swiss-accent/15 text-swiss-accentText">
                <BookmarkCheck size={22} aria-hidden="true" />
              </span>
              <div>
                <h3
                  id="rampage-guard-title"
                  className="text-lg font-semibold leading-tight text-swiss-ink"
                >
                  ¿Deseas guardar este Rampage?
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm leading-5 text-swiss-ink-muted">
                  Tienes una sesión activa con <strong>&ldquo;{activeTitle}&rdquo;</strong>
                  {affirmationCount > 0 ? ` (${affirmationCount} afirmaciones)` : ''} que aún no has
                  guardado en tu Santuario. Si abres uno nuevo sin guardar, se perderá.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onConfirmSave}
                className="swiss-btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-card focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <BookmarkCheck size={17} aria-hidden="true" />
                Sí, guardar en mi Santuario
              </button>

              <button
                type="button"
                onClick={onDiscard}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Trash2 size={16} aria-hidden="true" />
                No, descartar
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="mt-1 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full text-xs font-medium text-swiss-ink-muted hover:text-swiss-ink transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Volver al rampage
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
