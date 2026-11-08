'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation, NavTab } from '@/components/layout/BottomNavigation';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { CreateAction, CreateActionMenu } from '@/components/layout/CreateActionMenu';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton';
import { ManifestationsView } from '@/features/journal/ManifestationsView';
import { AffirmationsView } from '@/features/journal/AffirmationsView';
import { ProgressView } from '@/features/tracking/ProgressView';
import { VoiceCalibrationModal } from '@/components/voice/VoiceCalibrationModal';
import { RampagePlayerModal, DirectRampagePayload } from '@/components/goals/RampagePlayerModal';
import { ManifestationEditorModal } from '@/components/journal/ManifestationEditorModal';
import { AffirmationEditorModal } from '@/components/journal/AffirmationEditorModal';
import { ProgressLogModal } from '@/components/goals/ProgressLogModal';
import { SuccessStoryModal } from '@/components/goals/SuccessStoryModal';
import { audioEngine } from '@/lib/audioEngine';
import { AmbientSoundType, RampageSet } from '@/types';

const SCOPE_REGENERATION_MIN_MS = 320;
const SCOPE_REGENERATION_MAX_MS = 6000;
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function HomePage() {
  const {
    fetchRemoteData,
    refreshVoiceCalibrationStatus,
    rampageSets,
    activeScope,
    isLoading,
    isScopeRegenerating,
    setScopeRegenerating,
  } = useAppStore();
  const prefersReducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [minimumHoldElapsed, setMinimumHoldElapsed] = useState(true);
  const minimumHoldElapsedRef = useRef(true);
  const previousScopeRef = useRef(activeScope);
  const regenerationTimerRef = useRef<number | null>(null);

  // Modals state
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isRampageOpen, setIsRampageOpen] = useState(false);
  const [rampageOpenMode, setRampageOpenMode] = useState<'new' | 'restore' | 'pinned'>('new');
  const [rampageToResume, setRampageToResume] = useState<RampageSet | null>(null);
  const [directRampagePayload, setDirectRampagePayload] = useState<DirectRampagePayload | null>(null);
  const [resumeRequestId, setResumeRequestId] = useState(0);
  const [isRampagePlaying, setIsRampagePlaying] = useState(false);
  const [currentRampageAffirmation, setCurrentRampageAffirmation] = useState('');
  const toggleRampagePlaybackRef = useRef<(() => void) | null>(null);
  const [isNewManifestationOpen, setIsNewManifestationOpen] = useState(false);
  const [isNewAffirmationOpen, setIsNewAffirmationOpen] = useState(false);
  const [quickAddSection, setQuickAddSection] = useState<
    'affirmations' | 'manifestations' | null
  >(null);
  const quickAddTriggerRef = useRef<HTMLElement | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [createMenuAnchor, setCreateMenuAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const createMenuTriggerRef = useRef<HTMLElement | null>(null);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [selectedProgressManifId, setSelectedProgressManifId] = useState<string | undefined>();
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successStoryTarget, setSuccessStoryTarget] = useState<{ title: string; id?: string }>({
    title: '',
  });

  useEffect(() => {
    fetchRemoteData();
    refreshVoiceCalibrationStatus();
  }, [fetchRemoteData, refreshVoiceCalibrationStatus]);

  // A profile switch always lands on Inicio with a short, perceptible skeleton.
  useIsomorphicLayoutEffect(() => {
    if (previousScopeRef.current === activeScope) return;
    previousScopeRef.current = activeScope;

    setActiveTab('dashboard');
    setIsCreateMenuOpen(false);
    setQuickAddSection(null);
    quickAddTriggerRef.current = null;
    setIsRampageOpen(false);
    setRampageToResume(null);
    setIsRampagePlaying(false);
    setCurrentRampageAffirmation('');
    minimumHoldElapsedRef.current = false;
    setMinimumHoldElapsed(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    if (regenerationTimerRef.current !== null) {
      window.clearTimeout(regenerationTimerRef.current);
    }
    regenerationTimerRef.current = window.setTimeout(() => {
      regenerationTimerRef.current = null;
      minimumHoldElapsedRef.current = true;
      setMinimumHoldElapsed(true);
    }, SCOPE_REGENERATION_MIN_MS);

    return () => {
      if (regenerationTimerRef.current !== null) {
        window.clearTimeout(regenerationTimerRef.current);
        regenerationTimerRef.current = null;
      }
    };
  }, [activeScope]);

  // Reveal when the latest scope has data and the skeleton has been visible long
  // enough to read. The frame delay lets the exit/enter crossfade start together.
  useEffect(() => {
    if (!isScopeRegenerating || !minimumHoldElapsedRef.current || isLoading) return;
    const frame = window.requestAnimationFrame(() => setScopeRegenerating(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isScopeRegenerating, minimumHoldElapsed, isLoading, setScopeRegenerating]);

  // Never trap the interface behind a failed or hanging sync.
  useEffect(() => {
    if (!isScopeRegenerating) return;
    const timeout = window.setTimeout(
      () => setScopeRegenerating(false),
      SCOPE_REGENERATION_MAX_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [isScopeRegenerating, setScopeRegenerating]);

  const handleOpenProgress = (manifId?: string) => {
    setSelectedProgressManifId(manifId);
    setIsProgressOpen(true);
  };

  const handleOpenCrownSuccess = (title: string, manifId?: string) => {
    setSuccessStoryTarget({ title, id: manifId });
    setIsSuccessOpen(true);
  };

  const handleChangeTab = useCallback((tab: NavTab) => {
    setIsCreateMenuOpen(false);
    setQuickAddSection(null);
    quickAddTriggerRef.current = null;
    setActiveTab(tab);
  }, []);

  const openQuickAdd = useCallback(
    (section: 'affirmations' | 'manifestations', trigger: HTMLElement) => {
      quickAddTriggerRef.current = trigger;
      // The full editor opened from the composer should return focus here too.
      createMenuTriggerRef.current = trigger;
      setIsCreateMenuOpen(false);
      setIsNewAffirmationOpen(false);
      setIsNewManifestationOpen(false);
      setQuickAddSection(section);
    },
    [],
  );

  const closeQuickAdd = useCallback((restoreFocus = true) => {
    const trigger = quickAddTriggerRef.current;
    quickAddTriggerRef.current = null;
    setQuickAddSection(null);

    if (!restoreFocus) return;

    window.requestAnimationFrame(() => {
      if (trigger && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      } else {
        // The opener may have unmounted (empty state → first item saved).
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }
    });
  }, []);

  const handleOpenCreateMenu = useCallback((trigger: HTMLElement) => {
    setIsCreateMenuOpen((currentlyOpen) => {
      if (currentlyOpen) return false;
      const rect = trigger.getBoundingClientRect();
      createMenuTriggerRef.current = trigger;
      setCreateMenuAnchor({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
      return true;
    });
  }, []);

  const handleMobileCreate = useCallback(
    (trigger: HTMLElement) => {
      createMenuTriggerRef.current = trigger;

      if (activeTab === 'affirmations' || activeTab === 'manifestations') {
        if (quickAddSection === activeTab) {
          closeQuickAdd();
        } else {
          openQuickAdd(activeTab, trigger);
        }
        return;
      }

      if (activeTab === 'progress') {
        setIsCreateMenuOpen(false);
        setSelectedProgressManifId(undefined);
        setIsProgressOpen((open) => !open);
        return;
      }

      handleOpenCreateMenu(trigger);
    },
    [
      activeTab,
      closeQuickAdd,
      handleOpenCreateMenu,
      openQuickAdd,
      quickAddSection,
    ],
  );

  const isMobileCreateActive =
    activeTab === 'progress'
      ? isProgressOpen
      : activeTab === 'affirmations' || activeTab === 'manifestations'
        ? quickAddSection === activeTab
        : isCreateMenuOpen;

  const handleCloseCreateMenu = useCallback(() => {
    setIsCreateMenuOpen(false);
  }, []);

  const handleOpenNewRampage = useCallback(() => {
    setRampageToResume(null);
    setDirectRampagePayload(null);
    setRampageOpenMode('new');
    setIsRampageOpen(true);
  }, []);

  const handleStartPinnedRampage = useCallback(
    (affirmations: string[], ambientSound: AmbientSoundType = 'astral_rain') => {
      void audioEngine?.unlock();
      setRampageToResume(null);
      setDirectRampagePayload({
        title: 'Decretos fijados',
        affirmations,
        ambientSound,
        requestId: Date.now(),
      });
      setRampageOpenMode('pinned');
      setIsRampageOpen(true);
    },
    []
  );

  const handleContinueRampage = useCallback((rampage: RampageSet) => {
    void audioEngine?.unlock();
    setRampageToResume(rampage);
    setResumeRequestId((requestId) => requestId + 1);
  }, []);

  const handleRegisterTogglePlayback = useCallback((fn: () => void) => {
    toggleRampagePlaybackRef.current = fn;
  }, []);

  const handlePlaybackChange = useCallback((isPlaying: boolean, currentAffirmation?: string) => {
    setIsRampagePlaying(isPlaying);
    if (currentAffirmation !== undefined) {
      setCurrentRampageAffirmation(currentAffirmation);
    }
  }, []);

  const handleRestoreRampage = useCallback(() => {
    setRampageOpenMode('restore');
    setIsRampageOpen(true);
  }, []);

  const handleToggleRampagePlayback = useCallback(() => {
    void audioEngine?.unlock();
    if (toggleRampagePlaybackRef.current) {
      toggleRampagePlaybackRef.current();
    } else if (rampageSets[0]) {
      handleContinueRampage(rampageSets[0]);
    } else {
      handleOpenNewRampage();
    }
  }, [handleContinueRampage, handleOpenNewRampage, rampageSets]);

  const handleSelectCreateAction = useCallback((action: CreateAction) => {
    setIsCreateMenuOpen(false);
    if (action === 'manifestation') {
      setIsNewManifestationOpen(true);
    } else if (action === 'affirmation') {
      setIsNewAffirmationOpen(true);
    } else {
      setRampageToResume(null);
      setDirectRampagePayload(null);
      setRampageOpenMode('new');
      setIsRampageOpen(true);
    }
  }, []);

  const handleCloseAffirmation = useCallback(() => {
    setIsNewAffirmationOpen(false);
    window.requestAnimationFrame(() => createMenuTriggerRef.current?.focus());
  }, []);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-xl bg-swiss-accent px-4 py-3 font-semibold text-swiss-accentFg focus:not-sr-only focus-visible:ring-2 focus-visible:ring-swiss-focus"
      >
        Saltar al contenido
      </a>

      <DesktopSidebar
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenRampage={handleOpenNewRampage}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          onOpenCalibration={() => setIsCalibrationOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1160px] min-w-0 flex-1 px-page py-section"
        >
          <div className="relative w-full min-w-0">
            {isScopeRegenerating && (
              <p role="status" className="sr-only">
                Actualizando el contenido del perfil…
              </p>
            )}

            <AnimatePresence initial={false}>
              {isScopeRegenerating && (
                <motion.div
                  key="scope-regeneration-skeleton"
                  data-testid="scope-regeneration-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    filter: prefersReducedMotion ? 'blur(0px)' : 'blur(2px)',
                  }}
                  transition={{
                    duration: prefersReducedMotion ? 0.12 : 0.28,
                    ease: EMIL_EASE_OUT,
                  }}
                  className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-swiss-base"
                  aria-hidden="true"
                >
                  <DashboardSkeleton />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className="relative w-full min-w-0"
              data-testid="scope-content"
              initial={false}
              animate={
                isScopeRegenerating
                  ? {
                      opacity: 0,
                      filter: prefersReducedMotion ? 'blur(0px)' : 'blur(2px)',
                    }
                  : { opacity: 1, filter: 'none' }
              }
              transition={{
                duration: prefersReducedMotion
                  ? 0.12
                  : isScopeRegenerating
                    ? 0.18
                    : 0.3,
                ease: EMIL_EASE_OUT,
              }}
              aria-hidden={isScopeRegenerating}
              inert={isScopeRegenerating}
              style={{
                pointerEvents: isScopeRegenerating ? 'none' : undefined,
                willChange: isScopeRegenerating ? 'opacity, filter' : undefined,
              }}
            >
              <motion.div
                key={activeTab}
                className="w-full min-w-0"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.24, ease: EMIL_EASE_OUT }
                }
              >
                {activeTab === 'dashboard' && (
                  <DashboardView
                    onOpenManifestations={() => setActiveTab('manifestations')}
                    onOpenNewManifestation={() => setIsNewManifestationOpen(true)}
                    onOpenNewProgress={() => handleOpenProgress()}
                    onOpenRampage={handleOpenNewRampage}
                    onOpenCalibration={() => setIsCalibrationOpen(true)}
                    onContinueRampage={handleContinueRampage}
                    isCreateMenuOpen={isCreateMenuOpen}
                    onOpenCreateMenu={handleOpenCreateMenu}
                    isRampagePlaying={isRampagePlaying}
                    currentAffirmationText={currentRampageAffirmation}
                    onToggleRampagePlayback={handleToggleRampagePlayback}
                    onRestoreRampage={handleRestoreRampage}
                  />
                )}

                {activeTab === 'affirmations' && (
                  <AffirmationsView
                    onOpenNewAffirmation={() => setIsNewAffirmationOpen(true)}
                    onOpenRampage={handleOpenNewRampage}
                    onStartPinnedRampage={handleStartPinnedRampage}
                    isQuickAddOpen={quickAddSection === 'affirmations'}
                    onQuickAddOpen={(trigger) => openQuickAdd('affirmations', trigger)}
                    onQuickAddClose={closeQuickAdd}
                  />
                )}

                {activeTab === 'manifestations' && (
                  <ManifestationsView
                    onOpenNewManifestation={() => setIsNewManifestationOpen(true)}
                    onOpenNewProgress={handleOpenProgress}
                    onOpenCrownSuccess={handleOpenCrownSuccess}
                    isQuickAddOpen={quickAddSection === 'manifestations'}
                    onQuickAddOpen={(trigger) => openQuickAdd('manifestations', trigger)}
                    onQuickAddClose={closeQuickAdd}
                  />
                )}

                {(activeTab === 'progress' || activeTab === 'stories') && (
                  <ProgressView
                    initialSection={activeTab === 'stories' ? 'stories' : 'progress'}
                    onOpenNewProgress={handleOpenProgress}
                    onSelectManifestation={(_id) => setActiveTab('manifestations')}
                  />
                )}
              </motion.div>
            </motion.div>
          </div>
        </main>

        {/* Mobile Floating Bottom Bar */}
        <BottomNavigation
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          onOpenRampage={handleOpenNewRampage}
          onOpenCreateMenu={handleMobileCreate}
          isCreateMenuOpen={isMobileCreateActive}
        />
      </div>

      <CreateActionMenu
        isOpen={isCreateMenuOpen}
        anchor={createMenuAnchor}
        onClose={handleCloseCreateMenu}
        onSelect={handleSelectCreateAction}
      />

      {/* Modals */}
      <VoiceCalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
      />

      <RampagePlayerModal
        isOpen={isRampageOpen}
        onClose={() => setIsRampageOpen(false)}
        onRestore={handleRestoreRampage}
        openMode={rampageOpenMode}
        resumeRampage={rampageToResume}
        resumeRequestId={resumeRequestId}
        directRampage={directRampagePayload}
        onPlaybackChange={handlePlaybackChange}
        registerTogglePlayback={handleRegisterTogglePlayback}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
      />

      <ManifestationEditorModal
        isOpen={isNewManifestationOpen}
        onClose={() => setIsNewManifestationOpen(false)}
      />

      <AffirmationEditorModal
        isOpen={isNewAffirmationOpen}
        onClose={handleCloseAffirmation}
      />

      <ProgressLogModal
        isOpen={isProgressOpen}
        onClose={() => setIsProgressOpen(false)}
        manifestationId={selectedProgressManifId}
      />

      <SuccessStoryModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        manifestationTitle={successStoryTarget.title}
        manifestationId={successStoryTarget.id}
      />
    </div>
  );
}
