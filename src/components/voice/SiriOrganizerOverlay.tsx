'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, Loader2, Mic, X } from 'lucide-react';
import { LiquidIridescentOrb } from './LiquidIridescentOrb';
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
  onToggleItemAction?: (kind: 'manifestation' | 'affirmation', tempId: string) => void;
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

/**
 * TopographicCurves:
 * Patrón vectorial sutil de curvas de nivel topográficas
 * inspirado en la estética de la Imagen 3 para modo oscuro.
 */
const TopographicCurves: React.FC = () => (
  <svg
    className="pointer-events-none absolute -right-16 -top-12 h-80 w-80 opacity-30 dark:opacity-40 transition-opacity"
    viewBox="0 0 300 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M280 40C240 60 210 110 230 160C250 210 210 260 170 280"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-lime-400/40 dark:text-[var(--color-neon-lime)]/30"
    />
    <path
      d="M260 20C210 45 180 100 205 160C230 220 180 270 140 290"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-lime-400/30 dark:text-[var(--color-neon-lime)]/20"
    />
    <path
      d="M240 5C185 30 150 90 180 160C210 230 150 280 110 300"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-cyan-400/25 dark:text-cyan-400/20"
    />
    <path
      d="M220 -10C160 15 120 80 155 160C190 240 120 290 80 310"
      stroke="currentColor"
      strokeWidth="1"
      className="text-purple-400/20 dark:text-purple-400/15"
    />
  </svg>
);

/**
 * AudioWaveformBars:
 * Barras verticales de audio reactivas inspiradas en la Imagen 1.
 */
const AudioWaveformBars: React.FC<{ audioLevel: number; active?: boolean }> = ({
  audioLevel,
  active = true,
}) => {
  const bars = [0.4, 0.7, 1.0, 0.65, 0.45];
  return (
    <div className="flex items-center gap-[3px] px-1" aria-hidden="true">
      {bars.map((mult, i) => {
        const height = active ? Math.max(5, Math.min(22, 5 + audioLevel * 28 * mult)) : 5;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-[var(--color-ink)] transition-all duration-75 ease-out dark:bg-white"
            style={{
              height: `${height}px`,
              opacity: active ? 0.85 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
};

interface PlanItemProps {
  kind: ItemKind;
  title: string;
  content: string;
  badge?: string | null;
  existingId?: string;
  action?: 'repeat' | 'create_new';
  onToggleAction?: () => void;
}

/**
 * Authentic Liquid Glass Inset Grouped item.
 * Inspirado en la combinación del Modo Claro de Imagen 2 y Liquid Glass de Imagen 1.
 */
const PlanItem: React.FC<PlanItemProps> = ({
  kind,
  title,
  content,
  badge,
  existingId,
  action,
  onToggleAction,
}) => {
  return (
    <li
      data-testid={`narrative-card-${kind}`}
      className="group relative rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all duration-150 hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-[0_8px_24px_rgba(0,0,0,0.3)] dark:hover:bg-white/[0.08]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 4px 16px -2px rgba(31, 38, 135, 0.05)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent-text)]">
          {KIND_LABELS[kind]}
        </span>
        {badge && (
          <span className="rounded-full border border-white/50 bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-ink)] shadow-sm dark:border-white/10 dark:bg-white/10">
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
      {existingId && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[12px]">
          <span className="text-[var(--color-ink-muted)]">
            {action === 'create_new' ? 'Se guardará como nueva' : 'Por defecto se repetirá'}
          </span>
          <button
            type="button"
            data-testid={
              kind === 'manifestation'
                ? 'toggle-save-new-manifestation'
                : 'toggle-save-new-affirmation'
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleAction?.();
            }}
            className="rounded-full border border-white/40 bg-white/70 px-3 py-1 font-medium text-[var(--color-accent-text)] shadow-sm transition-transform active:scale-95 hover:bg-white focus-visible:ring-2 focus-visible:ring-swiss-focus dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
          >
            {kind === 'manifestation'
              ? action === 'create_new'
                ? 'Repetir manifestación (por defecto)'
                : 'Guardar nueva manifestación'
              : action === 'create_new'
                ? 'Repetir afirmación (por defecto)'
                : 'Guardar nueva afirmación'}
          </button>
        </div>
      )}
    </li>
  );
};

function renderPlanItems(
  plan: NarrativeProposedPlan,
  onToggleAction?: (kind: 'manifestation' | 'affirmation', tempId: string) => void
) {
  const items: React.ReactNode[] = [];

  plan.manifestations.forEach((item) => {
    const isRepeated = Boolean(item.existingId);
    const badgeText = isRepeated
      ? item.action === 'create_new'
        ? 'Nueva manifestación'
        : 'Repetir · ya presente'
      : item.isNewPersonWithSameName
        ? 'Persona nueva · mismo nombre'
        : 'Nueva';

    items.push(
      <PlanItem
        key={`m_${item.tempId}`}
        kind="manifestation"
        title={item.title}
        content={item.context || item.content}
        badge={badgeText}
        existingId={item.existingId}
        action={item.action}
        onToggleAction={
          onToggleAction ? () => onToggleAction('manifestation', item.tempId) : undefined
        }
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
    const isRepeated = Boolean(item.existingId);
    const badgeText = isRepeated
      ? item.action === 'create_new'
        ? 'Nueva afirmación'
        : 'Repetir · ya presente'
      : item.category || 'Afirmación';

    items.push(
      <PlanItem
        key={`a_${item.tempId}`}
        kind="affirmation"
        title={item.text}
        content=""
        badge={badgeText}
        existingId={item.existingId}
        action={item.action}
        onToggleAction={
          onToggleAction ? () => onToggleAction('affirmation', item.tempId) : undefined
        }
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
  onToggleItemAction,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const orbActive = isOpen && (phase === 'listening' || phase === 'review' || phase === 'error');
  const audioLevel = useOrbLevel(analyserNode, orbActive);

  const [saveRampage, setSaveRampage] = useState(true);

  const itemCount = draft ? countProposedItems(draft.proposedPlan) : 0;
  const plan = draft?.proposedPlan;
  const showPlan = Boolean(plan) && itemCount > 0;

  const planItems = useMemo(
    () => (plan ? renderPlanItems(plan, onToggleItemAction) : []),
    [plan, onToggleItemAction]
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        phase === 'review'
          ? panel.querySelector<HTMLElement>('[data-autofocus="true"]') ||
            panel.querySelector<HTMLElement>('button, [role="button"]')
          : panel;
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
        initial: { opacity: 0, y: 36, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 24, scale: 0.94 },
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
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.24, ease: EMIL_EASE_OUT }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onCancel();
          }}
          className="fixed inset-0 z-[80] flex items-end justify-center px-3 pb-[calc(var(--safe-bottom,0px)+0.75rem)] pt-12 sm:items-center sm:px-4 sm:pb-4"
        >
          {/* Frosted Liquid Scrim: Fondo ambiental translúcido con desenfoque extremo */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-black/45 backdrop-blur-3xl dark:bg-black/60"
            aria-hidden="true"
          />

          {/* Halo difuso ambiental pastel / cromático */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse at 50% 30%, rgba(0,240,255,0.15) 0%, rgba(204,255,0,0.12) 40%, rgba(217,70,239,0.1) 70%, transparent 100%)',
            }}
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
            className="relative z-[81] flex max-h-[88dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/75 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-3xl sm:rounded-[28px] dark:border-white/10 dark:bg-[#100d14]/80 dark:shadow-[0_32px_80px_-15px_rgba(0,0,0,0.7)]"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.65), 0 24px 64px -12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Curvas topográficas en modo oscuro (Inspiración Imagen 3) */}
            <TopographicCurves />

            {/* iOS Grabber Handle */}
            <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-black/15 dark:bg-white/20" />
            </div>

            {/* Header: Inspirado en la barra de Imagen 2 y Badges de Imagen 3 */}
            <header className="relative z-10 flex items-center justify-between border-b border-white/40 px-6 py-3.5 dark:border-white/[0.08]">
              {/* Badge interactivo estilo Imagen 3 con tokenización semántica por perfil */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-3 py-1 shadow-sm backdrop-blur-md dark:border-[var(--color-neon-lime,#CCFF00)]/40 dark:bg-[var(--color-neon-lime,#CCFF00)] dark:shadow-[0_0_16px_rgba(204,255,0,0.35)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-pulse dark:bg-black" />
                  <span className="text-[12px] font-bold tracking-tight text-[var(--color-accent-text)] dark:text-black">
                    AI Buddy
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] dark:bg-[var(--color-neon-lime,#CCFF00)]" />
                  <span>
                    {phase === 'listening'
                      ? 'Escuchando'
                      : phase === 'processing'
                        ? 'Procesando'
                        : phase === 'committing'
                          ? 'Guardando'
                          : phase === 'success'
                            ? 'Listo'
                            : phase === 'error'
                              ? 'Atención'
                              : 'Online'}
                  </span>
                </div>
              </div>

              {/* Botón circular de cierre estilo cristal escarchado */}
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cerrar organizador"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/60 text-[var(--color-ink-muted)] shadow-sm backdrop-blur-md transition-all active:scale-90 hover:bg-white hover:text-[var(--color-ink)] dark:border-white/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(var(--safe-bottom,0px)+1.5rem)] pt-5">
              <h2 id="narrative-organizer-title" className="sr-only">
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
              <p id="narrative-organizer-hint" className="sr-only">
                {phase === 'listening'
                  ? 'Habla con naturalidad. Toca el orbe para enviar o toca fuera para cancelar.'
                  : 'Toca fuera para cancelar. Para corregir, toca el orbe y habla.'}
              </p>

              {/* ---------------------------- LISTENING / PROCESSING (Orbe Iridiscente Imagen 3) ---------------------------- */}
              {(phase === 'listening' || phase === 'processing') && (
                <div className="flex flex-col items-center gap-6 py-6">
                  {/* Orbe Líquido Iridiscente con deformación y caústicas */}
                  <div className="touch-manipulation select-none active:scale-[0.96] transition-transform duration-100 ease-out">
                    <LiquidIridescentOrb
                      size={120}
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

                  {/* Tipografía inspirada en la Imagen 1 ("How can I help you today?") */}
                  <div className="text-center" aria-live="polite">
                    <p className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                      {phase === 'listening' ? 'Te escucho…' : 'Ordenando tu relato…'}
                    </p>
                    <p className="mt-1.5 text-[14px] text-[var(--color-ink-muted)]">
                      {phase === 'listening'
                        ? '¿En qué puedo ayudarte hoy? Habla libremente o toca para enviar.'
                        : 'Interpretando tus palabras con precisión…'}
                    </p>
                  </div>

                  {/* Barra Flotante Liquid Glass estilo Imagen 1 ("Ask anything..." + Waveform) */}
                  <div
                    onClick={phase === 'listening' ? onSubmit : undefined}
                    className={`mt-2 flex w-full max-w-[22rem] items-center justify-between rounded-full border border-white/80 bg-white/70 px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-2xl transition-all dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] ${
                      phase === 'listening'
                        ? 'cursor-pointer hover:bg-white/85 dark:hover:bg-white/[0.12] active:scale-[0.98]'
                        : ''
                    }`}
                    style={{
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    <span className="text-[14px] font-medium text-[var(--color-ink-muted)]">
                      {phase === 'listening' ? 'Escuchando tu voz…' : 'Procesando relato…'}
                    </span>
                    <div className="flex items-center gap-3">
                      <AudioWaveformBars
                        audioLevel={audioLevel}
                        active={phase === 'listening'}
                      />
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-sm transition-colors dark:bg-[var(--color-neon-lime,#CCFF00)] dark:text-black">
                        <Mic size={15} />
                      </span>
                    </div>
                  </div>

                  {draft && itemCount > 0 && (
                    <p className="text-center text-[12px] text-[var(--color-ink-muted)]">
                      Borrador anterior conservado ({itemCount} elementos).
                    </p>
                  )}
                </div>
              )}

              {/* ------------------------------ REVIEW (Liquid Glass Chat Experience) ----------------------------- */}
              {(phase === 'review' || phase === 'committing' || (phase === 'error' && draft)) && (
                <div className="space-y-4">
                  {/* Siri Conversational Response Bubble (Liquid Glass) */}
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/75 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
                    style={{
                      boxShadow:
                        'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 4px 16px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div className="flex items-center gap-2 pb-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] dark:bg-[var(--color-neon-lime,#CCFF00)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                        Respuesta de IA
                      </span>
                    </div>
                    <p
                      data-testid="narrative-siri-response"
                      aria-live="polite"
                      className="text-[16px] font-normal leading-[1.48] tracking-[-0.01em] text-[var(--color-ink)]"
                    >
                      {draft?.siriResponse}
                    </p>
                  </div>

                  {phase === 'error' && error && (
                    <p
                      role="alert"
                      className="flex items-start gap-2.5 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-danger)] backdrop-blur-md"
                    >
                      <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}

                  {/* Clean Inset Grouped Items (Liquid Glass cards) */}
                  {plan && showPlan && (
                    <ul data-testid="narrative-plan-list" className="space-y-2.5">
                      {planItems}
                    </ul>
                  )}

                  {/* iOS Native Switch for Rampage en Tarjeta Liquid Glass */}
                  {plan?.rampageToStart && (
                    <div
                      data-testid="narrative-card-rampage"
                      className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]"
                      style={{
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      }}
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

                        {/* Control UISwitch nativo */}
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

                  {/* CTA Integrado dentro del flujo de chat (directamente debajo de las opciones o de la respuesta) */}
                  {(canConfirm || canRetryCommit) && (
                    <div className="pt-2">
                      <button
                        type="button"
                        data-testid="narrative-confirm"
                        data-autofocus="true"
                        onClick={() => onConfirm(saveRampage)}
                        disabled={!canConfirm || phase === 'committing'}
                        aria-busy={phase === 'committing'}
                        className="touch-manipulation select-none inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out active:scale-[0.98] hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                        style={{
                          background: 'var(--color-accent)',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 24px -4px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        {phase === 'committing' ? (
                          <>
                            <Loader2 size={18} aria-hidden className="animate-spin" />
                            Registrando…
                          </>
                        ) : showPlan ? (
                          'Sí, registrar todo'
                        ) : (
                          'Sí, registrar'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Orbe compacto de corrección en vivo */}
                  <div className="flex flex-col items-center gap-2 pt-3">
                    <div className="touch-manipulation select-none active:scale-[0.94] transition-transform duration-100 ease-out">
                      <LiquidIridescentOrb
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
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] shadow-inner">
                    <AlertCircle size={26} aria-hidden />
                  </span>
                  <p role="alert" className="max-w-[28ch] text-center text-[15px] leading-relaxed text-[var(--color-ink)]">
                    {error || 'No se pudo procesar tu relato.'}
                  </p>
                  <div className="touch-manipulation select-none active:scale-[0.94] transition-transform duration-100 ease-out">
                    <LiquidIridescentOrb
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
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 shadow-inner dark:bg-[var(--color-neon-lime,#CCFF00)]/20 dark:text-[var(--color-neon-lime,#CCFF00)]"
                  >
                    <Check size={28} aria-hidden />
                  </motion.span>
                  <p className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                    Listo, quedó registrado.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
