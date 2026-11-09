'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRightLeft,
  HelpCircle,
  Mic,
  Quote,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { APPLE_ELASTIC_SPRING } from '@/lib/iosSprings';
import type { VoiceActionIntent } from '@/lib/gemini';

export type VoiceActionToastVariant = 'success' | 'error' | 'unclear';

export interface VoiceActionToastState {
  id: string;
  intent?: VoiceActionIntent;
  message: string;
  detail?: string;
  variant?: VoiceActionToastVariant;
  manifestationId?: string;
  progressId?: string;
  storyId?: string;
  retroactiveManifestationId?: string;
  onUndo?: () => Promise<void> | void;
  onSwitchType?: () => Promise<void> | void;
  switchLabel?: string;
  onRetry?: () => void;
}

interface VoiceActionToastProps {
  toast: VoiceActionToastState | null;
  onDismiss: () => void;
}

export const VoiceActionToast: React.FC<VoiceActionToastProps> = ({ toast, onDismiss }) => {
  const [isUndoing, setIsUndoing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const isErrorVariant = toast?.variant === 'error';
  const isUnclearVariant = toast?.variant === 'unclear';
  const durationSeconds = isErrorVariant || isUnclearVariant ? 7.5 : 6;

  useEffect(() => {
    if (!toast) return;
    setIsUndoing(false);
    setIsSwitching(false);

    const timer = window.setTimeout(() => {
      onDismiss();
    }, durationSeconds * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, onDismiss, durationSeconds]);

  if (!toast) return null;

  const handleUndo = async () => {
    if (isUndoing || !toast.onUndo) return;
    setIsUndoing(true);
    try {
      await toast.onUndo();
    } finally {
      setIsUndoing(false);
      onDismiss();
    }
  };

  const handleSwitch = async () => {
    if (isSwitching || !toast.onSwitchType) return;
    setIsSwitching(true);
    try {
      await toast.onSwitchType();
    } finally {
      setIsSwitching(false);
      onDismiss();
    }
  };

  const handleRetry = () => {
    if (toast.onRetry) {
      toast.onRetry();
    }
    onDismiss();
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={toast.id}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{
          opacity: 0,
          y: 8,
          scale: 0.98,
          transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
        }}
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md sm:bottom-24 pointer-events-auto select-none"
      >
        <div
          className={`relative overflow-hidden rounded-2xl border bg-[color:var(--color-surface-card)]/95 p-3.5 shadow-dropdown backdrop-blur-2xl transition-all ${
            isErrorVariant
              ? 'border-swiss-red/25 shadow-[0_12px_32px_-12px_rgba(184,56,55,0.2)]'
              : isUnclearVariant
                ? 'border-[color:var(--border-subtle)] shadow-[0_12px_32px_-12px_rgba(84,64,143,0.18)]'
                : 'border-[color:var(--border-subtle)]'
          }`}
        >
          {/* Subtle timer progress bar aligned with Swiss design & GPU scaleX */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              style={{ transformOrigin: 'left' }}
              transition={{ duration: durationSeconds, ease: 'linear' }}
              className={`h-full w-full ${
                isErrorVariant
                  ? 'bg-swiss-red'
                  : isUnclearVariant
                    ? 'bg-[color:var(--pastel-peri-ink)] dark:bg-swiss-accent'
                    : toast.intent === 'CREATE_AFFIRMATION'
                      ? 'bg-[color:var(--pastel-sage-ink)] dark:bg-swiss-accent'
                      : 'bg-swiss-accent'
              }`}
            />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              {/* Swiss Category-Colored Status Bead */}
              <span
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                  isErrorVariant
                    ? 'bg-[color:var(--pastel-rose)] text-swiss-red'
                    : isUnclearVariant
                      ? 'bg-[color:var(--pastel-sky)] text-[color:var(--pastel-sky-ink)]'
                      : toast.intent === 'CREATE_AFFIRMATION'
                        ? 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]'
                        : 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]'
                }`}
              >
                {isErrorVariant ? (
                  <AlertCircle size={15} />
                ) : isUnclearVariant ? (
                  <HelpCircle size={15} />
                ) : toast.intent === 'CREATE_AFFIRMATION' ? (
                  <Quote size={13} strokeWidth={2.2} />
                ) : (
                  <Sparkles size={14} />
                )}
              </span>

              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold leading-tight text-swiss-ink">
                  {toast.message}
                </p>
                {toast.detail && (
                  <p className="mt-1 text-xs leading-relaxed text-swiss-ink-muted break-words">
                    {toast.detail}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Cerrar notificación"
              className="p-1 text-swiss-ink-light transition-colors hover:text-swiss-ink hover:bg-swiss-control rounded-lg active:scale-90"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Action buttons */}
          <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-[color:var(--border-subtle)]">
            {toast.onRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="swiss-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-swiss-ink hover:bg-swiss-control active:scale-95 transition-all shadow-card"
              >
                <Mic size={12} className="text-swiss-accent" />
                <span>Reintentar</span>
              </button>
            )}

            {toast.onSwitchType && toast.switchLabel && (
              <button
                type="button"
                onClick={handleSwitch}
                disabled={isSwitching}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-swiss-accentText transition-all hover:bg-swiss-control active:scale-95 disabled:opacity-50"
              >
                <ArrowRightLeft size={13} />
                <span>{toast.switchLabel}</span>
              </button>
            )}

            {toast.onUndo && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={isUndoing}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-swiss-red transition-all hover:bg-swiss-red/10 active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={13} />
                <span>{isUndoing ? 'Deshaciendo...' : 'Deshacer'}</span>
              </button>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
