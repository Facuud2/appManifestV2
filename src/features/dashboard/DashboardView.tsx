'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Feather,
  Footprints,
  Headphones,
  Mic,
  Pause,
  Play,
  Plus,
  Repeat,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { RampageSet } from '@/types';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { RampageAudioWaveform } from '@/components/goals/RampageAudioWaveform';
import { audioEngine } from '@/lib/audioEngine';
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
  onOpenCalibration?: () => void;
  onContinueRampage: (rampage: RampageSet) => void;
  isCreateMenuOpen: boolean;
  onOpenCreateMenu: (trigger: HTMLElement) => void;
  isRampagePlaying?: boolean;
  currentAffirmationText?: string;
  onToggleRampagePlayback?: () => void;
  onRestoreRampage?: () => void;
}

const SKELETON_WAVE_BARS = [12, 22, 30, 16, 26, 14, 24, 18, 28, 14, 20];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenManifestations,
  onOpenNewManifestation,
  onOpenNewProgress,
  onOpenRampage,
  onOpenCalibration,
  onContinueRampage,
  isCreateMenuOpen,
  onOpenCreateMenu,
  isRampagePlaying = false,
  currentAffirmationText = '',
  onToggleRampagePlayback,
  onRestoreRampage,
}) => {
  const {
    activeScope,
    isFacuCalibrated,
    isMaiaCalibrated,
    manifestations: allManifestations,
    affirmations: allAffirmations,
    rampageSets: allRampageSets,
    addAffirmation,
    incrementAffirmationRepeat,
  } = useAppStore();

  const manifestations = allManifestations.filter((item) => item.userId === activeScope);
  const affirmations = allAffirmations.filter((item) => item.userId === activeScope);
  const rampageSets = allRampageSets.filter((item) => item.userId === activeScope);

  const isCurrentProfileCalibrated =
    activeScope === 'maia'
      ? isMaiaCalibrated
      : activeScope === 'facu'
        ? isFacuCalibrated
        : isFacuCalibrated || isMaiaCalibrated;

  const [newAffirmationText, setNewAffirmationText] = useState('');
  const [isAddingAffirmation, setIsAddingAffirmation] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [affirmationError, setAffirmationError] = useState('');

  const featuredAffirmation =
    affirmations.find((affirmation) => affirmation.pinned) ?? affirmations[0];
  const latestRampage = rampageSets[0];

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
      className="w-full min-w-0 space-y-8 pb-32 text-swiss-ink lg:space-y-10 lg:pb-10"
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
            <p className="mt-4 text-xs font-medium text-[color:var(--hero-hint-ink)] sm:hidden">
              Empezá por el orbe: escribí, afirmá o escuchá.
            </p>
          </div>

          <div className="hero-orb-stage mx-auto">
            {/* Ambient Aura & Breathing Atmosphere */}
            <div aria-hidden="true" className="hero-orb-aura">
              <span className="hero-orb-aura-bloom" />
              <span className="hero-orb-aura-pulse" />
              <div className="hero-orb-orbital">
                <span className="hero-orb-stardust hero-orb-stardust-1" />
                <span className="hero-orb-stardust hero-orb-stardust-2" />
              </div>
            </div>

            {/* Interactive 3D Celestial Orb Button */}
            <button
              type="button"
              onClick={(event) => onOpenCreateMenu(event.currentTarget)}
              aria-label={
                isCreateMenuOpen ? 'Cerrar menú de creación' : 'Abrir menú de creación'
              }
              aria-expanded={isCreateMenuOpen}
              className="hero-orb hero-orb-button group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus focus-visible:ring-offset-4 focus-visible:ring-offset-swiss-card"
            >
              {/* Volumetric 3D Sphere */}
              <span className="hero-orb-sphere" aria-hidden="true" />

              {/* Floating Action Pill docked at the bottom */}
              <span
                className="hero-orb-pill"
                data-open={isCreateMenuOpen}
              >
                <span
                  className="inline-flex items-center justify-center transition-transform duration-200"
                  aria-hidden="true"
                >
                  {isCreateMenuOpen ? (
                    <X size={13} strokeWidth={2.4} />
                  ) : (
                    <Plus size={13} strokeWidth={2.4} />
                  )}
                </span>
                <span>{isCreateMenuOpen ? 'Cerrar' : 'Crear'}</span>
              </span>
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
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium text-swiss-ink-muted transition-colors hover:text-swiss-accentText focus-visible:ring-2 focus-visible:ring-swiss-focus"
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accentText">
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accentText">
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-swiss-accentText">
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
        className="w-full min-w-0"
      >
        <motion.article
          variants={STAGGER_ITEM}
          className="swiss-card surface-peri flex w-full min-w-0 flex-col p-4 sm:p-card"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-swiss-ink sm:text-lg">
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
              className="swiss-pill inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center text-swiss-accentText transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus sm:min-h-10 sm:min-w-10"
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
                  {isComposerOpen ? <X aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>

          {isCurrentProfileCalibrated ? (
            <div
              data-testid="continue-listening-player"
              className="glass-panel mt-3.5 flex w-full min-w-0 items-center gap-2.5 rounded-[18px] p-2.5 sm:mt-4 sm:gap-4 sm:rounded-[22px] sm:p-3.5"
            >
              <button
                type="button"
                onClick={() => {
                  void audioEngine?.unlock();
                  if (latestRampage?.affirmations.length) {
                    if (onToggleRampagePlayback) {
                      onToggleRampagePlayback();
                    } else {
                      onContinueRampage(latestRampage);
                    }
                  } else {
                    onOpenRampage();
                  }
                }}
                aria-label={
                  isRampagePlaying
                    ? 'Pausar Rampage'
                    : latestRampage?.affirmations.length
                    ? `Continuar escuchando ${latestRampage.title}`
                    : 'Crear tu primer Rampage'
                }
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-swiss-accent text-swiss-accentFg shadow-sm transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-swiss-focus active:scale-[0.96] sm:h-13 sm:w-13 sm:rounded-[16px]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isRampagePlaying ? (
                    <motion.span
                      key="pause"
                      initial={{ scale: 0.65, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.65, opacity: 0 }}
                      transition={{ duration: 0.14, ease: EMIL_EASE_OUT }}
                      className="flex"
                    >
                      <Pause aria-hidden="true" size={18} fill="currentColor" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="play"
                      initial={{ scale: 0.65, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.65, opacity: 0 }}
                      transition={{ duration: 0.14, ease: EMIL_EASE_OUT }}
                      className="flex"
                    >
                      <Play
                        aria-hidden="true"
                        size={17}
                        fill="currentColor"
                        className="translate-x-[1px]"
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (latestRampage?.affirmations.length && onRestoreRampage) {
                    onRestoreRampage();
                  } else {
                    onOpenRampage();
                  }
                }}
                className="min-w-0 flex-1 overflow-hidden rounded-lg text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swiss-focus"
                aria-label={
                  latestRampage?.affirmations.length
                    ? `Abrir reproductor de ${latestRampage.title}`
                    : 'Crear Rampage'
                }
              >
                {latestRampage?.affirmations.length ? (
                  <>
                    <p className="truncate text-sm font-semibold text-swiss-ink sm:text-[0.9375rem]">
                      {latestRampage.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-normal leading-4 text-swiss-ink-muted sm:text-[0.8125rem]">
                      {isRampagePlaying && currentAffirmationText
                        ? `“${currentAffirmationText}”`
                        : `“${latestRampage.affirmations[0].text}”`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-swiss-ink-muted sm:text-sm">
                    Creá un Rampage y retomalo desde acá cuando quieras.
                  </p>
                )}
              </button>

              <div className="shrink-0 pl-0.5 sm:pl-1">
                <RampageAudioWaveform isPlaying={isRampagePlaying} barCount={8} className="sm:hidden" />
                <RampageAudioWaveform isPlaying={isRampagePlaying} barCount={13} className="hidden sm:flex" />
              </div>
            </div>
          ) : (
            <div
              data-testid="continue-listening-uncalibrated"
              className="glass-panel relative mt-3.5 min-h-[8.5rem] w-full min-w-0 overflow-hidden rounded-[18px] p-3.5 sm:mt-4 sm:min-h-[9rem] sm:rounded-[22px] sm:p-4"
            >
              {/* Skeleton anatómico del reproductor en el fondo */}
              <div
                aria-hidden="true"
                className="pointer-events-none flex h-full w-full select-none flex-col justify-between gap-3 opacity-80"
              >
                <div className="flex w-full items-center gap-3 sm:gap-4">
                  <span className="ss-skel-block-strong block h-12 w-12 shrink-0 rounded-[14px] sm:h-14 sm:w-14 sm:rounded-[16px]" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <span className="ss-skel-block-strong block h-4 w-[min(12rem,58%)] rounded-full" />
                    <span className="ss-skel-block block h-3 w-[min(18rem,84%)] rounded-full" />
                  </div>
                  <div className="flex shrink-0 items-end gap-1 pr-1">
                    {SKELETON_WAVE_BARS.map((height, index) => (
                      <span
                        key={index}
                        className={`ss-skel-block-strong block w-1 rounded-full ${
                          index > 5 ? 'hidden sm:block' : ''
                        }`}
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="ss-skel-block block h-2 w-full rounded-full" />
                  <span className="ss-skel-block block h-2.5 w-12 shrink-0 rounded-full" />
                </div>
              </div>

              {/* Indicación por encima y botón de Calibrar Voz en el centro */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[color:var(--glass-bg)] px-4 py-3 text-center backdrop-blur-[3px]">
                <p className="max-w-md text-xs font-semibold leading-snug text-swiss-ink sm:text-sm">
                  Calibrá tu voz para crear y escuchar un Rampage
                </p>
                <p className="mt-0.5 max-w-sm text-[11px] leading-4 text-swiss-ink-muted sm:text-xs">
                  Registrá tu timbre vocal para que tus afirmaciones suenen con tu propia voz.
                </p>
                <button
                  type="button"
                  onClick={() => (onOpenCalibration ? onOpenCalibration() : onOpenRampage())}
                  data-testid="continue-listening-calibrate-btn"
                  className="swiss-btn-primary mt-2.5 inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[0.8125rem] shadow-card focus-visible:ring-2 focus-visible:ring-swiss-focus"
                >
                  <Mic aria-hidden="true" size={16} />
                  Calibrar voz
                </button>
              </div>
            </div>
          )}

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
                  <div className="relative min-w-0 flex-1">
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
                    className="swiss-btn-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 px-5 text-sm disabled:opacity-50"
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
      </motion.section>
    </motion.div>
  );
};
