'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { SiriOrb } from './VoiceActionOrb';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';
import {
  countProposedItems,
  type NarrativeDraft,
  type NarrativeLink,
  type NarrativeProposedPlan,
} from '@/lib/narrativeOrganizer';
import type { NarrativeErrorKind, NarrativePhase } from '@/hooks/useNarrativeOrganizer';

interface SiriOrganizerOverlayProps {
  isOpen: boolean;
  phase: NarrativePhase;
  draft: NarrativeDraft | null;
  error: string | null;
  errorKind: NarrativeErrorKind | null;
  analyserNode: AnalyserNode | null;
  canConfirm: boolean;
  canRetryCommit: boolean;
  onCancel: () => void;
  onConfirm: (saveRampage: boolean) => void;
  onReRecord: () => void;
  onSubmit: () => void;
}

type ItemKind = 'manifestation' | 'progress' | 'success' | 'affirmation' | 'rampage';

const KIND_LABELS: Record<ItemKind, string> = {
  manifestation: 'Manifestación',
  progress: 'Avance',
  success: 'Éxito',
  affirmation: 'Afirmación',
  rampage: 'Rampage',
};

function useOrbLevel(analyserNode: AnalyserNode | null, active: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    if (!analyserNode) {
      let angle = 0;
      const loop = () => {
        angle += 0.05;
        setLevel(0.18 + 0.12 * Math.sin(angle));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const buffer = new Uint8Array(analyserNode.frequencyBinCount);
    const tick = () => {
      analyserNode.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
      let sum = 0;
      const count = Math.min(buffer.length, 32);
      for (let i = 0; i < count; i += 1) sum += buffer[i];
      const avg = sum / (count * 255);
      setLevel((previous) => previous * 0.7 + avg * 0.3);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [analyserNode, active]);

  return level;
}

function linkBadge(link: NarrativeLink): string | null {
  if (link.kind === 'temp') return 'Vinculada al borrador';
  if (link.kind === 'existing') return 'Vinculada a manifestación existente';
  return 'Sin vincular';
}

interface PlanItemProps {
  kind: ItemKind;
  title: string;
  content: string;
  badge?: string | null;
}

/**
 * Authentic iOS Inset Grouped item.
 * Clean SF-Pro style typography, subtle hairpins, zero emojis, zero pastel blocks.
 */
const PlanItem: React.FC<PlanItemProps> = ({ kind, title, content, badge }) => {
  return (
    <li
      data-testid={`narrative-card-${kind}`}
      className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-surface-card)]/80 px-4 py-3.5 transition-colors duration-150 hover:bg-[var(--color-surface-card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent-text)]">
          {KIND_LABELS[kind]}
        </span>
        {badge && (
          <span className="rounded-full bg-[var(--control-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-ink)]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-ink)] [overflow-wrap:anywhere]">
        {title}
      </p>
      {content && (
        <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--color-ink-muted)] [overflow-wrap:anywhere]">
          {content}
        </p>
      )}
    </li>
  );
};

function renderPlanItems(plan: NarrativeProposedPlan) {
  const items: React.ReactNode[] = [];

  plan.manifestations.forEach((item) => {
    items.push(
      <PlanItem
        key={`m_${item.tempId}`}
        kind="manifestation"
        title={item.title}
        content={item.context || item.content}
        badge={item.isNewPersonWithSameName ? 'Persona nueva · mismo nombre' : 'Nueva'}
      />
    );
  });

  plan.progressLogs.forEach((item) => {
    items.push(
      <PlanItem
        key={`p_${item.tempId}`}
        kind="progress"
        title={item.title}
        content={item.content}
        badge={linkBadge(item.link)}
      />
    );
  });

  plan.successStories.forEach((item) => {
    items.push(
      <PlanItem
        key={`s_${item.tempId}`}
        kind="success"
        title={item.title}
        content={item.content}
        badge={linkBadge(item.link)}
      />
    );
  });

  plan.affirmations.forEach((item) => {
    items.push(
      <PlanItem
        key={`a_${item.tempId}`}
        kind="affirmation"
        title={item.text}
        content=""
        badge={item.category || 'Afirmación'}
      />
    );
  });

  return items;
}

export const SiriOrganizerOverlay: React.FC<SiriOrganizerOverlayProps> = ({
  isOpen,
  phase,
  draft,
  error,
  errorKind,
  analyserNode,
  canConfirm,
  canRetryCommit,
  onCancel,
  onConfirm,
  onReRecord,
  onSubmit,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const orbActive = isOpen && (phase === 'listening' || phase === 'review' || phase === 'error');
  const audioLevel = useOrbLevel(analyserNode, orbActive);

  const [saveRampage, setSaveRampage] = useState(true);

  const itemCount = draft ? countProposedItems(draft.proposedPlan) : 0;
  const plan = draft?.proposedPlan;
  const showPlan = Boolean(plan) && itemCount > 0;

  const planItems = useMemo(() => (plan ? renderPlanItems(plan) : []), [plan]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus="true"]') ||
        panel.querySelector<HTMLElement>('button, [role="button"]');
      target?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, phase === 'review']);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [role="button"]:not([aria-disabled="true"]), [href], input, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const panelMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 32, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.95 },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="narrative-organizer-overlay"
          data-testid="narrative-organizer-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="narrative-organizer-title"
          aria-describedby="narrative-organizer-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: EMIL_EASE_OUT }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onCancel();
          }}
          className="fixed inset-0 z-[80] flex items-end justify-center px-3 pb-[calc(var(--safe-bottom,0px)+0.75rem)] pt-12 sm:items-center sm:px-4 sm:pb-4"
        >
          {/* Frosted Siri Glass Backdrop: Dark, ultra-blurred Apple Intelligence scrim */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-black/45 backdrop-blur-3xl"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            data-testid="narrative-organizer-panel"
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={prefersReducedMotion ? { duration: 0.12 } : APPLE_ELASTIC_SPRING}
            onClick={(event) => event.stopPropagation()}
            className="relative z-[81] flex max-h-[88dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[var(--color-modal-surface)] shadow-[var(--shadow-modal)] backdrop-blur-3xl sm:rounded-[28px]"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.45), var(--shadow-modal)',
            }}
          >
            {/* iOS Grabber Handle */}
            <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-black/15 dark:bg-white/20" />
            </div>

            {/* Header: Clean iOS Title & State */}
            <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-3.5">
              <h2
                id="narrative-organizer-title"
                className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--color-ink)]"
              >
                {phase === 'listening'
                  ? 'Te escucho'
                  : phase === 'processing'
                    ? 'Ordenando tu relato'
                    : phase === 'committing'
                      ? 'Registrando'
                      : phase === 'success'
                        ? 'Listo'
                        : phase === 'error'
                          ? 'Algo salió mal'
                          : 'Siri'}
              </h2>
              <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                {phase === 'review' ? 'Revisión' : 'Voz en vivo'}
              </span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <p id="narrative-organizer-hint" className="sr-only">
                {phase === 'listening'
                  ? 'Habla con naturalidad. Toca el orbe para enviar o toca fuera para cancelar.'
                  : 'Toca fuera para cancelar. Para corregir, toca el orbe y habla.'}
              </p>

              {/* ---------------------------- LISTENING / PROCESSING ---------------------------- */}
              {(phase === 'listening' || phase === 'processing') && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="touch-manipulation select-none active:scale-[0.96] transition-transform duration-100 ease-out">
                    <SiriOrb
                      size={112}
                      audioLevel={audioLevel}
                      isProcessing={phase === 'processing'}
                      interactive={phase === 'listening'}
                      label={
                        phase === 'listening'
                          ? 'Enviar el relato al organizador'
                          : 'Ordenando tu relato'
                      }
                      onClick={onSubmit}
                    />
                  </div>
                  <div className="text-center" aria-live="polite">
                    <p className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                      {phase === 'listening' ? 'Te escucho…' : 'Ordenando tu relato…'}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
                      {phase === 'listening'
                        ? 'Habla libremente y toca el orbe cuando termines.'
                        : 'Interpretando tus palabras con precisión…'}
                    </p>
                  </div>

                  {draft && itemCount > 0 && (
                    <p className="text-center text-[12px] text-[var(--color-ink-muted)]">
                      Borrador anterior conservado ({itemCount} elementos).
                    </p>
                  )}
                </div>
              )}

              {/* ------------------------------ REVIEW (Authentic Siri Voice Experience) ----------------------------- */}
              {(phase === 'review' || phase === 'committing' || (phase === 'error' && draft)) && (
                <div className="space-y-4">
                  {/* Siri Conversational Response Bubble */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-surface-card)]/90 px-4 py-3.5 shadow-sm">
                    <p
                      data-testid="narrative-siri-response"
                      aria-live="polite"
                      className="text-[16px] font-normal leading-[1.45] tracking-[-0.01em] text-[var(--color-ink)]"
                    >
                      {draft?.siriResponse}
                    </p>
                  </div>

                  {phase === 'error' && error && (
                    <p
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--color-danger)]"
                    >
                      <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}

                  {/* Clean Inset Grouped Items (Zero emojis, Zero AI-colored pills) */}
                  {plan && showPlan && (
                    <ul data-testid="narrative-plan-list" className="space-y-2.5">
                      {planItems}
                    </ul>
                  )}

                  {/* iOS Native Switch for Rampage */}
                  {plan?.rampageToStart && (
                    <div
                      data-testid="narrative-card-rampage"
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-surface-card)]/80 px-4 py-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent-text)]">
                            Rampage
                          </p>
                          <p className="mt-1 break-words text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                            {plan.rampageToStart.title}
                          </p>
                          <p className="text-[13px] text-[var(--color-ink-muted)]">
                            {plan.rampageToStart.count} afirmaciones para escuchar
                          </p>
                        </div>

                        {/* Authentic iOS UISwitch control */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={saveRampage}
                          data-testid="narrative-save-rampage"
                          onClick={() => setSaveRampage((previous) => !previous)}
                          className="touch-manipulation select-none flex items-center gap-2.5 text-[13px] font-medium text-[var(--color-ink-muted)] focus:outline-none"
                        >
                          <span className="hidden sm:inline">Guardar</span>
                          <span
                            aria-hidden="true"
                            className="relative inline-block h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-out"
                            style={{
                              background: saveRampage
                                ? 'var(--color-accent)'
                                : 'var(--control-active)',
                            }}
                          >
                            <span
                              className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out"
                              style={{
                                transform: saveRampage ? 'translateX(22px)' : 'translateX(2px)',
                              }}
                            />
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Real-time Voice Correction Siri Orb */}
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="touch-manipulation select-none active:scale-[0.94] transition-transform duration-100 ease-out">
                      <SiriOrb
                        size={68}
                        audioLevel={audioLevel}
                        isProcessing={phase === 'committing'}
                        interactive={phase !== 'committing'}
                        label="Corregir el borrador por voz"
                        onClick={onReRecord}
                      />
                    </div>
                    <p className="text-center text-[12px] font-medium text-[var(--color-ink-muted)] tracking-[-0.005em]">
                      Toca o habla para corregir en tiempo real
                    </p>
                  </div>
                </div>
              )}

              {/* ------------------------------- ERROR (No draft) ----------------------------- */}
              {phase === 'error' && !draft && (
                <div className="flex flex-col items-center gap-5 py-8">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                    <AlertCircle size={26} aria-hidden />
                  </span>
                  <p role="alert" className="max-w-[28ch] text-center text-[15px] leading-relaxed text-[var(--color-ink)]">
                    {error || 'No se pudo procesar tu relato.'}
                  </p>
                  <div className="touch-manipulation select-none active:scale-[0.94] transition-transform duration-100 ease-out">
                    <SiriOrb
                      size={88}
                      audioLevel={audioLevel}
                      interactive
                      label="Volver a intentar con el orbe"
                      onClick={onReRecord}
                    />
                  </div>
                  <p className="text-center text-[12px] text-[var(--color-ink-muted)]">
                    {errorKind === 'microphone'
                      ? 'Toca el orbe para reintentar cuando el permiso esté concedido.'
                      : 'Toca el orbe y cuéntamelo de nuevo.'}
                  </p>
                </div>
              )}

              {/* ------------------------------ SUCCESS ---------------------------- */}
              {phase === 'success' && (
                <div className="flex flex-col items-center gap-4 py-10">
                  <motion.span
                    initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={APPLE_ELASTIC_SPRING}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/12 text-[var(--color-success)]"
                  >
                    <Check size={28} aria-hidden />
                  </motion.span>
                  <p className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                    Listo, quedó registrado.
                  </p>
                </div>
              )}
            </div>

            {/* ------------------------------- CTA: Authentic iOS Pill Button -------------------------------- */}
            {(phase === 'review' || phase === 'committing' || canRetryCommit) && showPlan && (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--color-modal-surface)] px-6 pb-[calc(var(--safe-bottom,0px)+1.25rem)] pt-3.5">
                <button
                  type="button"
                  data-testid="narrative-confirm"
                  data-autofocus="true"
                  onClick={() => onConfirm(saveRampage)}
                  disabled={!canConfirm || phase === 'committing'}
                  aria-busy={phase === 'committing'}
                  className="touch-manipulation select-none inline-flex h-[50px] min-h-[50px] w-full items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-accent-fg)] shadow-sm active:scale-[0.98] transition-transform duration-100 ease-out disabled:opacity-60"
                  style={{
                    background: 'var(--color-accent)',
                  }}
                >
                  {phase === 'committing' ? (
                    <>
                      <Loader2 size={18} aria-hidden className="animate-spin" />
                      Registrando…
                    </>
                  ) : (
                    'Sí, registrar todo'
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
