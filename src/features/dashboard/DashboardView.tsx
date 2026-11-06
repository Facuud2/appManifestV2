'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Feather,
  Footprints,
  Headphones,
  Play,
  Plus,
  Repeat,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { RampageSet } from '@/types';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import {
  EMIL_EASE_OUT,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';

interface DashboardViewProps {
  onOpenManifestations: () => void;
  onOpenNewManifestation: () => void;
  onOpenNewProgress: () => void;
  onOpenRampage: () => void;
  onContinueRampage: (rampage: RampageSet) => void;
  isCreateMenuOpen: boolean;
  onOpenCreateMenu: (trigger: HTMLElement) => void;
}

const weekDayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenManifestations,
  onOpenNewManifestation,
  onOpenNewProgress,
  onOpenRampage,
  onContinueRampage,
  isCreateMenuOpen,
  onOpenCreateMenu,
}) => {
  const {
    manifestations,
    progressLogs,
    affirmations,
    rampageSets,
    addAffirmation,
    incrementAffirmationRepeat,
  } = useAppStore();

  const [newAffirmationText, setNewAffirmationText] = useState('');
  const [isAddingAffirmation, setIsAddingAffirmation] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [affirmationError, setAffirmationError] = useState('');

  const week = useMemo(() => {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    const days = weekDayLabels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { label, date, key: getDateKey(date) };
    });

    const loggedDayKeys = new Set(
      progressLogs.flatMap((log) => {
        const date = new Date(log.createdAt);
        return Number.isNaN(date.getTime()) ? [] : [getDateKey(date)];
      }),
    );

    return {
      days: days.map((day) => ({
        ...day,
        hasLog: loggedDayKeys.has(day.key),
        isToday: day.key === getDateKey(today),
      })),
      loggedDays: days.filter((day) => loggedDayKeys.has(day.key)).length,
    };
  }, [progressLogs]);

  const featuredAffirmation =
    affirmations.find((affirmation) => affirmation.pinned) ?? affirmations[0];
  const latestRampage = rampageSets[0];
  const weekProgress = week.loggedDays / 7;

  const handleAddQuickAffirmation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = newAffirmationText.trim();
    if (!text || isAddingAffirmation) return;

    setIsAddingAffirmation(true);
    setAffirmationError('');
    try {
      await addAffirmation(text);
      setNewAffirmationText('');
      setIsComposerOpen(false);
    } catch (error) {
      console.error('No se pudo guardar la afirmación.', error);
      setAffirmationError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setIsAddingAffirmation(false);
    }
  };

  return (
    <motion.div
      variants={STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-32 text-swiss-ink lg:space-y-10 lg:pb-10"
    >
      <motion.section
        variants={STAGGER_ITEM}
        aria-labelledby="dashboard-title"
        className="hero-sanctuary relative isolate overflow-hidden rounded-[28px] border px-6 py-7 sm:px-8 sm:py-9 lg:min-h-[320px] lg:px-10 lg:py-10"
      >
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
          <div>
            <h1
              id="dashboard-title"
              className="display-title max-w-[24ch] text-swiss-ink"
            >
              Todo lo que deseo ya está en camino.
            </h1>
            <p className="mt-3.5 max-w-md text-[0.9375rem] leading-6 text-swiss-ink-muted sm:text-base">
              Un momento para volver a vos y conectar con lo que estás creando.
            </p>
            <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
              <button
                type="button"
                onClick={onOpenNewManifestation}
                className="swiss-btn-primary inline-flex min-h-10 items-center gap-2 px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Feather aria-hidden="true" size={15} />
                Escribir intención
              </button>
              <button
                type="button"
                onClick={onOpenNewProgress}
                className="swiss-btn-secondary inline-flex min-h-10 items-center gap-2 px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Footprints aria-hidden="true" size={15} />
                Registrar avance
              </button>
            </div>
            <p className="mt-4 text-xs font-medium text-[color:var(--pastel-sage-ink)] sm:hidden">
              Empezá por el orbe: escribí, afirmá o escuchá.
            </p>
          </div>

          <div className="hero-orb-stage mx-auto">
            <div aria-hidden="true" className="hero-orb-bloom">
              <span className="hero-orb-bloom-a" />
              <span className="hero-orb-bloom-b" />
              <span className="hero-orb-bloom-c" />
            </div>
            <button
              type="button"
              onClick={(event) => onOpenCreateMenu(event.currentTarget)}
              aria-label={
                isCreateMenuOpen ? 'Cerrar menú de creación' : 'Abrir menú de creación'
              }
              aria-expanded={isCreateMenuOpen}
              className="hero-orb group focus-visible:ring-2 focus-visible:ring-swiss-focus focus-visible:ring-offset-4 focus-visible:ring-offset-swiss-card"
            >
              <span className="hero-orb-core">
                {isCreateMenuOpen ? (
                  <X aria-hidden="true" size={26} strokeWidth={1.7} />
                ) : (
                  <Plus aria-hidden="true" size={30} strokeWidth={1.6} />
                )}
              </span>
              <span className="text-[0.8125rem] font-semibold text-swiss-ink">
                {isCreateMenuOpen ? 'Cerrar' : 'Crear'}
              </span>
              <span className="text-xs text-swiss-ink-muted">Abrí tu espacio</span>
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section variants={STAGGER_ITEM} aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="quick-actions-title" className="section-heading">
            ¿Qué necesitás hoy?
          </h2>
          <button
            type="button"
            onClick={onOpenManifestations}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium text-swiss-ink-muted transition-colors hover:text-swiss-accent focus-visible:ring-2 focus-visible:ring-swiss-focus"
            aria-label={`Ver todas tus intenciones. ${manifestations.length} guardadas`}
          >
            Ver todo
            <ChevronRight aria-hidden="true" size={15} />
          </button>
        </div>

        <motion.div variants={STAGGER_CONTAINER} className="swiss-group">
          <motion.button
            type="button"
            onClick={onOpenRampage}
            variants={STAGGER_ITEM}
            className="swiss-row action-card min-h-[4.25rem] gap-3.5 px-4 focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accent">
              <Headphones aria-hidden="true" size={20} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-swiss-ink">
                Nuevo rampage
              </span>
              <span className="mt-0.5 block text-xs text-swiss-ink-light">
                Alineá tu energía con tu voz
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={17} className="action-chevron shrink-0 text-swiss-ink-light" />
          </motion.button>

          <motion.button
            type="button"
            onClick={onOpenNewManifestation}
            variants={STAGGER_ITEM}
            className="swiss-row action-card min-h-[4.25rem] gap-3.5 px-4 focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accent">
              <Feather aria-hidden="true" size={20} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-swiss-ink">
                Escribir manifestación
              </span>
              <span className="mt-0.5 block text-xs text-swiss-ink-light">
                Dale forma a tu intención
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={17} className="action-chevron shrink-0 text-swiss-ink-light" />
          </motion.button>

          <motion.button
            type="button"
            onClick={onOpenNewProgress}
            variants={STAGGER_ITEM}
            className="swiss-row action-card min-h-[4.25rem] gap-3.5 px-4 focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accent">
              <Footprints aria-hidden="true" size={20} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-swiss-ink">
                Registrar un avance
              </span>
              <span className="mt-0.5 block text-xs text-swiss-ink-light">
                Cada paso cuenta
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={17} className="action-chevron shrink-0 text-swiss-ink-light" />
          </motion.button>
        </motion.div>
      </motion.section>

      <motion.section
        variants={STAGGER_CONTAINER}
        className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <motion.article variants={STAGGER_ITEM} className="swiss-card surface-peri flex min-h-52 flex-col p-5 sm:p-card">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-swiss-ink">
              Continuar escuchando
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsComposerOpen((open) => !open);
                setAffirmationError('');
              }}
              aria-expanded={isComposerOpen}
              aria-label={isComposerOpen ? 'Cerrar afirmación nueva' : 'Crear una afirmación nueva'}
              className="swiss-pill inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center text-swiss-accent transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isComposerOpen ? 'close' : 'create'}
                  initial={{ opacity: 0, rotate: -35, scale: 0.9 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 35, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: EMIL_EASE_OUT }}
                  className="flex"
                >
                  {isComposerOpen ? <X aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>

          <div className="glass-panel mt-4 flex flex-1 items-center gap-3.5 rounded-[16px] p-3 sm:gap-4 sm:p-3.5">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-end justify-center gap-[3px] rounded-[14px] bg-[color:var(--pastel-peri)] px-2.5 py-3"
            >
              {[10, 18, 26, 16, 22].map((height, index) => (
                <span
                  key={index}
                  className="w-[3px] rounded-full bg-[color:var(--pastel-peri-ink)]"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              {latestRampage?.affirmations.length ? (
                <>
                  <p className="truncate text-[0.8125rem] font-medium text-swiss-ink">
                    {latestRampage.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-5 text-swiss-ink-muted">
                    “{latestRampage.affirmations[0].text}”
                  </p>
                </>
              ) : (
                <p className="text-sm leading-5 text-swiss-ink-muted">
                  Creá un Rampage y retomalo desde acá cuando quieras.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                latestRampage?.affirmations.length
                  ? onContinueRampage(latestRampage)
                  : onOpenRampage()
              }
              aria-label={
                latestRampage?.affirmations.length
                  ? `Continuar escuchando ${latestRampage.title}`
                  : 'Crear tu primer Rampage'
              }
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-swiss-accent text-swiss-accentFg transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-swiss-focus active:scale-[0.96]"
            >
              <Play aria-hidden="true" size={15} fill="currentColor" className="translate-x-[1px]" />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isComposerOpen && (
              <motion.form
                key="quick-affirmation-composer"
                onSubmit={handleAddQuickAffirmation}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
                className="mt-4"
              >
                <label htmlFor="quick-affirmation" className="sr-only">
                  Escribe una afirmación
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      id="quick-affirmation"
                      type="text"
                      value={newAffirmationText}
                      onChange={(event) => setNewAffirmationText(event.target.value)}
                      placeholder="Escribí una afirmación directa…"
                      maxLength={500}
                      className="swiss-input min-h-12 w-full px-4 pr-14 text-sm"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <VoiceDictationButton
                        size="sm"
                        className="min-h-11 min-w-11"
                        onTranscript={(text) =>
                          setNewAffirmationText((previous) =>
                            previous ? `${previous} ${text}` : text,
                          )
                        }
                        previousTextTail={newAffirmationText}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingAffirmation || !newAffirmationText.trim()}
                    className="swiss-btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm disabled:opacity-50"
                  >
                    <Check aria-hidden="true" size={16} />
                    {isAddingAffirmation ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {affirmationError && (
                  <p role="alert" className="mt-2 text-sm text-swiss-red">
                    {affirmationError}
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          {featuredAffirmation && (
            <button
              type="button"
              onClick={() => void incrementAffirmationRepeat(featuredAffirmation.id)}
              className="mt-2 inline-flex min-h-9 items-center gap-2 self-start rounded-full px-2 text-xs text-swiss-ink-muted transition-colors hover:text-swiss-ink"
            >
              <Repeat aria-hidden="true" size={15} />
              Repetida{' '}
              <motion.span
                key={featuredAffirmation.repeatCount}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                className="inline-block tabular-nums"
              >
                {featuredAffirmation.repeatCount}
              </motion.span>{' '}
              veces
            </button>
          )}
        </motion.article>

        <motion.article variants={STAGGER_ITEM} className="swiss-card min-h-52 p-5 sm:p-card">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-swiss-ink">
              Esta semana
            </h2>
            <span className="rounded-full bg-[color:var(--pastel-sage)] px-2.5 py-1 text-xs font-semibold text-[color:var(--pastel-sage-ink)]">
              {week.loggedDays}/7 días
            </span>
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--control-bg)"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={264}
                  initial={{ strokeDashoffset: 264 }}
                  animate={{ strokeDashoffset: 264 - 264 * weekProgress }}
                  transition={{ duration: 0.5, ease: EMIL_EASE_OUT }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold tabular-nums leading-none text-swiss-ink">
                  {week.loggedDays}
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-swiss-ink-light">días</span>
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-1">
                {week.days.map((day) => (
                  <div key={day.key} className="flex flex-col items-center gap-1.5">
                    <span
                      role="img"
                      aria-label={`${day.date.toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                      })}${day.isToday ? ', hoy' : ''}${
                        day.hasLog ? ', con avance registrado' : ', sin avances registrados'
                      }`}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                        day.hasLog
                          ? 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]'
                          : day.isToday
                            ? 'border border-swiss-focus text-swiss-accent'
                            : 'bg-swiss-control text-swiss-ink-light'
                      }`}
                    >
                      {day.hasLog ? (
                        <motion.span
                          initial={{ scale: 0.75, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                          className="flex"
                        >
                          <Check aria-hidden="true" size={13} />
                        </motion.span>
                      ) : (
                        day.label
                      )}
                    </span>
                    <span className="text-[11px] tabular-nums text-swiss-ink-light">
                      {day.date.getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-swiss-border pt-3">
            <p className="text-xs leading-5 text-swiss-ink-muted">
              <span className="font-semibold text-swiss-ink">{week.loggedDays} días</span> con
              avances registrados
            </p>
            <button
              type="button"
              onClick={onOpenNewProgress}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-swiss-accent transition-colors hover:bg-swiss-control"
            >
              Registrar
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </motion.article>
      </motion.section>
    </motion.div>
  );
};
