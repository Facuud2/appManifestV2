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
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import {
  EMIL_CARD_TAP,
  EMIL_EASE_OUT,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
} from '@/lib/iosSprings';

interface DashboardViewProps {
  onOpenManifestations: () => void;
  onOpenNewManifestation: () => void;
  onOpenNewProgress: () => void;
  onOpenRampage: () => void;
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
  isCreateMenuOpen,
  onOpenCreateMenu,
}) => {
  const {
    manifestations,
    progressLogs,
    affirmations,
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
      className="space-y-5 pb-32 text-swiss-ink lg:pb-10"
    >
      <motion.section
        variants={STAGGER_ITEM}
        aria-labelledby="dashboard-title"
        className="swiss-card relative isolate overflow-hidden p-card lg:min-h-[270px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-14 h-64 w-64 rounded-full bg-swiss-accent opacity-[0.08] blur-3xl sm:-right-4 sm:top-1/2 sm:h-80 sm:w-80 sm:-translate-y-1/2"
        />
        <div className="relative z-10 max-w-xl lg:pr-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-swiss-border bg-swiss-control px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-accent">
            <Sparkles aria-hidden="true" size={13} />
          </div>
          <h1
            id="dashboard-title"
            className="max-w-[24ch] text-2xl font-semibold leading-[1.08] tracking-tight text-swiss-ink sm:max-w-[18ch] sm:text-[2.25rem]"
          >
            Todo lo que deseo ya está en camino.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-swiss-ink-muted sm:text-base">
            Un momento para volver a vos y conectar con lo que estás creando.
          </p>
          
        </div>

        <div className="relative mx-auto mt-7 flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48 lg:absolute lg:right-10 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">
          <div aria-hidden="true" className="dashboard-orb-breathe absolute inset-1 rounded-full border border-swiss-border opacity-60" />
          <div aria-hidden="true" className="absolute inset-5 rounded-full border border-swiss-border opacity-70" />
          <div aria-hidden="true" className="absolute inset-0 rounded-full bg-swiss-accent opacity-[0.12] blur-2xl" />
          <button
            type="button"
            onClick={(event) => onOpenCreateMenu(event.currentTarget)}
            aria-label={isCreateMenuOpen ? 'Cerrar menú de creación' : 'Abrir menú de creación'}
            aria-expanded={isCreateMenuOpen}
            className="dashboard-orb relative h-28 w-28 rounded-full transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-swiss-focus focus-visible:ring-offset-4 focus-visible:ring-offset-swiss-surface active:scale-[0.98] sm:h-32 sm:w-32"
          >
            <span aria-hidden="true" className="absolute left-[18%] top-[18%] h-3 w-3 rounded-full bg-[color:var(--orb-glint)] blur-[1px]" />
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[18%] right-[23%] flex h-7 w-7 items-center justify-center rounded-lg border border-swiss-border bg-swiss-surface text-swiss-accent shadow-card"
          >
            {isCreateMenuOpen ? <X size={14} /> : <Plus size={14} />}
          </span>
        </div>
      </motion.section>

      <motion.section variants={STAGGER_ITEM} aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-ink-light">
              Un paso a la vez
            </p>
            <h2 id="quick-actions-title" className="mt-1 text-lg font-semibold text-swiss-ink sm:text-xl">
              ¿Qué necesitas hoy?
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenManifestations}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-accent focus-visible:ring-2 focus-visible:ring-swiss-focus"
            aria-label={`Ver todas tus intenciones. ${manifestations.length} guardadas`}
          >
            Ver todo
            <ChevronRight aria-hidden="true" size={15} />
          </button>
        </div>
        <motion.div variants={STAGGER_CONTAINER} className="grid gap-3 md:grid-cols-3">
          <motion.button
            type="button"
            onClick={onOpenRampage}
            variants={STAGGER_ITEM}
            whileHover={{ y: -2 }}
            whileTap={EMIL_CARD_TAP}
            transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
            className="swiss-card-interactive flex min-h-[76px] items-center gap-3 rounded-2xl p-3.5 text-left sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swiss-actionLavender text-swiss-accent">
              <Headphones aria-hidden="true" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-swiss-ink">Nuevo rampage</span>
              <span className="mt-0.5 block text-xs text-swiss-ink-muted">Alinea tu energía</span>
            </span>
            <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-swiss-ink-light" />
          </motion.button>

          <motion.button
            type="button"
            onClick={onOpenNewManifestation}
            variants={STAGGER_ITEM}
            whileHover={{ y: -2 }}
            whileTap={EMIL_CARD_TAP}
            transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
            className="swiss-card-interactive flex min-h-[76px] items-center gap-3 rounded-2xl p-3.5 text-left sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swiss-actionBlue text-swiss-accent">
              <Feather aria-hidden="true" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-swiss-ink">Escribir manifestación</span>
              <span className="mt-0.5 block text-xs text-swiss-ink-muted">Dale forma a tu intención</span>
            </span>
            <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-swiss-ink-light" />
          </motion.button>

          <motion.button
            type="button"
            onClick={onOpenNewProgress}
            variants={STAGGER_ITEM}
            whileHover={{ y: -2 }}
            whileTap={EMIL_CARD_TAP}
            transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
            className="swiss-card-interactive flex min-h-[76px] items-center gap-3 rounded-2xl p-3.5 text-left sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swiss-actionPeach text-swiss-accent">
              <Footprints aria-hidden="true" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-swiss-ink">Registrar un avance</span>
              <span className="mt-0.5 block text-xs text-swiss-ink-muted">Cada paso cuenta</span>
            </span>
            <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-swiss-ink-light" />
          </motion.button>
        </motion.div>
      </motion.section>

      <motion.section
        variants={STAGGER_CONTAINER}
        className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]"
      >
        <motion.article variants={STAGGER_ITEM} className="swiss-card flex min-h-52 flex-col p-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-ink-light">
                Continuar escuchando
              </p>
              <h2 className="mt-1.5 truncate text-lg font-semibold text-swiss-ink">
                {featuredAffirmation?.category || (featuredAffirmation ? 'Tu afirmación' : 'Tu próxima escucha')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsComposerOpen((open) => !open);
                setAffirmationError('');
              }}
              aria-expanded={isComposerOpen}
              aria-label={isComposerOpen ? 'Cerrar afirmación nueva' : 'Crear una afirmación nueva'}
              className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full text-swiss-accent transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
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

          <div className="mt-4 flex flex-1 flex-col justify-between gap-4 rounded-2xl border border-swiss-border bg-swiss-control p-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0">
              {featuredAffirmation ? (
                <p className="text-sm font-medium leading-5 text-swiss-ink">
                  “{featuredAffirmation.text}”
                </p>
              ) : (
                <p className="text-sm leading-5 text-swiss-ink-muted">
                  Guarda una afirmación para tenerla cerca cuando quieras volver a tu centro.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                onClick={onOpenRampage}
                aria-label={featuredAffirmation ? 'Escuchar esta afirmación en Rampage' : 'Abrir Rampage'}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-swiss-accent text-swiss-accentFg transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-swiss-focus active:scale-[0.98]"
              >
                <Play aria-hidden="true" size={15} fill="currentColor" />
              </button>
              <div
                aria-hidden="true"
                className="flex h-8 items-center gap-1 text-swiss-accent opacity-70"
              >
                {[8, 14, 20, 12, 24, 16, 10, 19, 13, 22, 9, 16, 11].map((height, index) => (
                  <span
                    key={index}
                    className="w-0.5 rounded-full bg-current"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>
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
                    placeholder="Escribe algo que quieras recordar..."
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
              className="mt-1 inline-flex min-h-9 items-center gap-2 self-start rounded-xl px-2 text-xs text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-ink"
            >
              <Repeat aria-hidden="true" size={15} />
              Repetida {featuredAffirmation.repeatCount} veces
            </button>
          )}
        </motion.article>

        <motion.article variants={STAGGER_ITEM} className="swiss-card min-h-52 p-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-swiss-ink-light">
                Tu ritmo
              </p>
              <h2 className="mt-1.5 text-lg font-semibold text-swiss-ink">Esta semana</h2>
            </div>
            <span className="rounded-full bg-swiss-actionLavender px-2.5 py-1 text-xs font-semibold text-swiss-accent">
              {week.loggedDays}/7 días
            </span>
          </div>

          <div className="mt-5 flex justify-between gap-1">
            {week.days.map((day) => (
              <div key={day.key} className="flex flex-col items-center gap-2">
                <span
                  role="img"
                  aria-label={`${day.date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                  })}${day.isToday ? ', hoy' : ''}${
                    day.hasLog ? ', con avance registrado' : ', sin avances registrados'
                  }`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    day.hasLog
                      ? 'bg-swiss-accent text-swiss-accentFg'
                      : day.isToday
                        ? 'border border-swiss-focus bg-swiss-surface text-swiss-accent'
                        : 'bg-swiss-control text-swiss-ink-light'
                  }`}
                >
                  {day.hasLog ? <Check aria-hidden="true" size={14} /> : day.label}
                </span>
                <span className="text-[10px] text-swiss-ink-light">
                  {day.date.toLocaleDateString('es-ES', { day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-swiss-border pt-3">
            <p className="text-xs text-swiss-ink-muted">
              <span className="font-semibold text-swiss-ink">{week.loggedDays} días</span>
              {' con avances registrados'}
            </p>
            <button
              type="button"
              onClick={onOpenNewProgress}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-swiss-accent transition-colors hover:bg-swiss-control"
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
