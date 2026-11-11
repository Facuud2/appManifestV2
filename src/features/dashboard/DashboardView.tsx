'use client';

import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  CloudRain,
  Feather,
  Footprints,
  Headphones,
  Mic,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Sparkles,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppStore, readRecentRampageIds } from '@/store';
import { RampageSet } from '@/types';
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
  onOpenRampage: (options?: { customize?: boolean }) => void;
  onOpenCalibration?: () => void;
  onContinueRampage: (rampage: RampageSet) => void;
  isCreateMenuOpen: boolean;
  onOpenCreateMenu: (trigger: HTMLElement) => void;
  isRampagePlaying?: boolean;
  currentAffirmationText?: string;
  onToggleRampagePlayback?: () => void;
  onRestoreRampage?: () => void;
  currentPlayingId?: string;
  onViewAllRampages?: () => void;
}

const SKELETON_WAVE_BARS = [12, 22, 30, 16, 26, 14, 24, 18, 28, 14, 20];

const getRampageRepeatCount = (rampage: RampageSet): number => {
  if (typeof (rampage as any).playCount === 'number' && (rampage as any).playCount > 0) {
    return (rampage as any).playCount;
  }
  if (typeof (rampage as any).repeatCount === 'number' && (rampage as any).repeatCount > 0) {
    return (rampage as any).repeatCount;
  }
  const maxAffRepeat = rampage.affirmations?.length
    ? Math.max(0, ...rampage.affirmations.map((a) => a.repeatCount || 0))
    : 0;
  if (maxAffRepeat > 0) return maxAffRepeat;
  return rampage.lastPlayedAt ? 1 : 1;
};

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
  currentPlayingId,
  onViewAllRampages,
}) => {
  const {
    activeScope,
    isFacuCalibrated,
    isMaiaCalibrated,
    manifestations: allManifestations,
    affirmations: allAffirmations,
    rampageSets: allRampageSets,
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

  const featuredAffirmation =
    affirmations.find((affirmation) => affirmation.pinned) ?? affirmations[0];
  const currentPlayingRampage = currentPlayingId
    ? rampageSets.find((item) => item.id === currentPlayingId)
    : null;
  const latestRampage = currentPlayingRampage || rampageSets[0];

  const recentRampages = useMemo(() => {
    const activeRampageId = currentPlayingId || latestRampage?.id;
    const activeRampageTitle = latestRampage?.title.trim().toLowerCase();

    const isExcluded = (s: RampageSet) =>
      s.id === activeRampageId || (activeRampageTitle && s.title.trim().toLowerCase() === activeRampageTitle);

    const recentIds = readRecentRampageIds(activeScope);
    const setsMap = new Map(rampageSets.map((s) => [s.id, s]));
    const matched: RampageSet[] = [];

    // 1. Prioridad: orden de IDs en localStorage (excluyendo el que se encuentra en el reproductor)
    for (const id of recentIds) {
      const found = setsMap.get(id);
      if (
        found &&
        !isExcluded(found) &&
        !matched.some(
          (m) =>
            m.id === found.id ||
            m.title.trim().toLowerCase() === found.title.trim().toLowerCase()
        )
      ) {
        matched.push(found);
      }
      if (matched.length >= 2) break;
    }

    // 2. Si faltan, rellenar con sets que tengan lastPlayedAt (excluyendo el activo)
    if (matched.length < 2) {
      const withTimestamp = rampageSets
        .filter(
          (s) =>
            s.lastPlayedAt &&
            !isExcluded(s) &&
            !matched.some(
              (m) =>
                m.id === s.id ||
                m.title.trim().toLowerCase() === s.title.trim().toLowerCase()
            )
        )
        .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime());
      for (const item of withTimestamp) {
        matched.push(item);
        if (matched.length >= 2) break;
      }
    }

    // 3. Si aún faltan y hay múltiples sets creados, alimentar la sección con los sets anteriores
    if (matched.length < 2 && rampageSets.length > 1) {
      const otherSets = rampageSets.filter((s) => !isExcluded(s));
      for (const item of otherSets) {
        if (
          !matched.some(
            (m) =>
              m.id === item.id ||
              m.title.trim().toLowerCase() === item.title.trim().toLowerCase()
          )
        ) {
          matched.push(item);
        }
        if (matched.length >= 2) break;
      }
    }

    return matched;
  }, [activeScope, currentPlayingId, latestRampage, rampageSets]);

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
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenNewManifestation}
                className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Feather aria-hidden="true" size={15} />
                Escribir intención
              </button>
              <button
                type="button"
                onClick={onOpenNewProgress}
                className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Footprints aria-hidden="true" size={15} />
                Registrar avance
              </button>
            </div>
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
                isCreateMenuOpen ? 'Cerrar menú de creación' : 'Crear: abrir menú de creación'
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

      {manifestations.length === 0 && (
        <motion.section
          variants={STAGGER_ITEM}
          aria-label="Bienvenida a tu santuario"
          className="relative overflow-hidden rounded-[24px] border border-[color:var(--pastel-sky)] bg-[color:var(--pastel-sky)]/25 p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pastel-sky)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--pastel-sky-ink)]">
                <Sparkles size={13} aria-hidden="true" />
                Bienvenido a tu santuario
              </span>
              <h2 className="mt-2 text-base font-semibold text-swiss-ink sm:text-lg">
                Comenzá creando tu primera intención
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-swiss-ink-muted leading-relaxed">
                Escribí un deseo en tiempo presente o dictalo con tu voz. Tu santuario irá cobrando vida con tus avances diarios y rampages guiados.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenNewManifestation}
                className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Feather size={15} aria-hidden="true" />
                Crear primera intención
              </button>
              <button
                type="button"
                onClick={() => onOpenRampage()}
                className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Headphones size={15} aria-hidden="true" />
                Probar Rampage
              </button>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section variants={STAGGER_ITEM} aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="quick-actions-title" className="section-heading">
            ¿Qué necesitás hoy?
          </h2>
          <button
            type="button"
            onClick={onOpenManifestations}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium text-swiss-ink-muted transition-colors hover:text-swiss-accentText focus-visible:ring-2 focus-visible:ring-swiss-focus"
            aria-label={`Ver todo: intenciones guardadas (${
              manifestations.length === 1
                ? '1 guardada'
                : `${manifestations.length.toLocaleString('es-ES')} guardadas`
            })`}
          >
            Ver todo
            <ChevronRight aria-hidden="true" size={15} />
          </button>
        </div>

        <motion.div variants={STAGGER_CONTAINER} className="swiss-group">
          <motion.button
            type="button"
            onClick={() => onOpenRampage({ customize: true })}
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
          </div>

          {isCurrentProfileCalibrated ? (
            <>
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
                className="min-w-0 flex-1 min-h-[44px] flex flex-col justify-center overflow-hidden rounded-lg text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swiss-focus"
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

            {/* Sub-bloque: Últimos 2 Rampages Reproducidos */}
            {recentRampages.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold tracking-wider text-swiss-ink-light uppercase">
                    Últimos reproducidos
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {recentRampages.map((rampage) => {
                    const isPlayingThis = isRampagePlaying && currentPlayingId === rampage.id;
                    return (
                      <div
                        key={rampage.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onContinueRampage(rampage)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onContinueRampage(rampage);
                          }
                        }}
                        className={`group flex items-center justify-between gap-3 rounded-[16px] border bg-swiss-surface/80 p-2.5 transition-all cursor-pointer hover:bg-swiss-control ${
                          isPlayingThis
                            ? 'border-swiss-accent/60 ring-1 ring-swiss-accent/40 shadow-sm'
                            : 'border-[color:var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition-transform group-hover:scale-105 ${
                              isPlayingThis
                                ? 'bg-swiss-accent text-swiss-accentFg'
                                : 'bg-swiss-control text-swiss-accentText'
                            }`}
                          >
                            {isPlayingThis ? (
                              <Pause size={15} fill="currentColor" />
                            ) : (
                              <Play size={14} fill="currentColor" className="translate-x-[0.5px]" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-swiss-ink">
                              {rampage.title}
                            </p>
                            <div className="flex items-center gap-1.5 truncate text-[11px] text-swiss-ink-muted">
                              <span>{rampage.affirmations.length} afirmaciones</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 font-medium text-swiss-accentText">
                                <Repeat size={10} aria-hidden="true" />
                                <span>
                                  {getRampageRepeatCount(rampage)}{' '}
                                  {getRampageRepeatCount(rampage) === 1
                                    ? 'reproducción'
                                    : 'reproducciones'}
                                </span>
                              </span>
                              {rampage.ambientSound === 'astral_rain' ? (
                                <>
                                  <span>·</span>
                                  <span>Lluvia astral</span>
                                </>
                              ) : rampage.ambientSound === 'white_noise' ? (
                                <>
                                  <span>·</span>
                                  <span>Ruido blanco</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {isPlayingThis && (
                          <div className="shrink-0 pr-1">
                            <RampageAudioWaveform isPlaying={true} barCount={6} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Botón Ver todos los rampage debajo de los rampages previamente guardados */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={onViewAllRampages}
                    aria-label="Ver todos los rampage"
                    data-testid="view-all-rampages-btn"
                    className="group inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-swiss-accentText transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
                  >
                    <Headphones size={13} aria-hidden="true" className="shrink-0" />
                    <span>Ver todos los rampage</span>
                    <ChevronRight
                      size={13}
                      aria-hidden="true"
                      className="shrink-0 transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-swiss-surface/60 p-2.5 text-xs text-swiss-ink-muted border border-[color:var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Headphones size={15} className="text-swiss-accentText shrink-0" />
                  <span>Aún no tienes rampages reproducidos.</span>
                </div>
                <div className="flex items-center gap-2">
                  {rampageSets.length > 0 && (
                    <button
                      type="button"
                      onClick={onViewAllRampages}
                      aria-label="Ver todos los rampage"
                      data-testid="view-all-rampages-empty-btn"
                      className="group inline-flex items-center gap-1 text-xs font-semibold text-swiss-accentText hover:underline"
                    >
                      <Headphones size={12} aria-hidden="true" className="shrink-0" />
                      <span>Ver todos los rampage</span>
                      <ChevronRight
                        size={12}
                        aria-hidden="true"
                        className="shrink-0 transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenRampage()}
                    className="text-xs font-semibold text-swiss-accentText hover:underline"
                  >
                    Probar primer Rampage
                  </button>
                </div>
              </div>
            )}
          </>
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
