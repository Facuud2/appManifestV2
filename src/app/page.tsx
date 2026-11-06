'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation, NavTab } from '@/components/layout/BottomNavigation';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { CreateAction, CreateActionMenu } from '@/components/layout/CreateActionMenu';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ManifestationsView } from '@/features/journal/ManifestationsView';
import { ProgressView } from '@/features/tracking/ProgressView';
import { SuccessStoriesView } from '@/features/stories/SuccessStoriesView';
import { VoiceCalibrationModal } from '@/components/voice/VoiceCalibrationModal';
import { RampagePlayerModal } from '@/components/goals/RampagePlayerModal';
import { ManifestationEditorModal } from '@/components/journal/ManifestationEditorModal';
import { AffirmationEditorModal } from '@/components/journal/AffirmationEditorModal';
import { ProgressLogModal } from '@/components/goals/ProgressLogModal';
import { SuccessStoryModal } from '@/components/goals/SuccessStoryModal';
import { audioEngine } from '@/lib/audioEngine';
import { RampageSet } from '@/types';

export default function HomePage() {
  const { fetchRemoteData, refreshVoiceCalibrationStatus, rampageSets } = useAppStore();
  const prefersReducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Modals state
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isRampageOpen, setIsRampageOpen] = useState(false);
  const [rampageOpenMode, setRampageOpenMode] = useState<'new' | 'restore'>('new');
  const [rampageToResume, setRampageToResume] = useState<RampageSet | null>(null);
  const [resumeRequestId, setResumeRequestId] = useState(0);
  const [isRampagePlaying, setIsRampagePlaying] = useState(false);
  const [currentRampageAffirmation, setCurrentRampageAffirmation] = useState('');
  const toggleRampagePlaybackRef = useRef<(() => void) | null>(null);
  const [isNewManifestationOpen, setIsNewManifestationOpen] = useState(false);
  const [isNewAffirmationOpen, setIsNewAffirmationOpen] = useState(false);
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

  const handleOpenProgress = (manifId?: string) => {
    setSelectedProgressManifId(manifId);
    setIsProgressOpen(true);
  };

  const handleOpenCrownSuccess = (title: string, manifId?: string) => {
    setSuccessStoryTarget({ title, id: manifId });
    setIsSuccessOpen(true);
  };

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

  const handleCloseCreateMenu = useCallback(() => {
    setIsCreateMenuOpen(false);
  }, []);

  const handleOpenNewRampage = useCallback(() => {
    setRampageToResume(null);
    setRampageOpenMode('new');
    setIsRampageOpen(true);
  }, []);

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
        onChangeTab={setActiveTab}
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
          <motion.div
            key={activeTab}
            className="w-full min-w-0"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
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
                onContinueRampage={handleContinueRampage}
                isCreateMenuOpen={isCreateMenuOpen}
                onOpenCreateMenu={handleOpenCreateMenu}
                isRampagePlaying={isRampagePlaying}
                currentAffirmationText={currentRampageAffirmation}
                onToggleRampagePlayback={handleToggleRampagePlayback}
                onRestoreRampage={handleRestoreRampage}
              />
            )}

            {activeTab === 'manifestations' && (
              <ManifestationsView
                onOpenNewManifestation={() => setIsNewManifestationOpen(true)}
                onOpenNewProgress={handleOpenProgress}
                onOpenCrownSuccess={handleOpenCrownSuccess}
              />
            )}

            {activeTab === 'progress' && (
              <ProgressView onOpenNewProgress={() => handleOpenProgress()} />
            )}

            {activeTab === 'stories' && (
              <SuccessStoriesView onOpenNewStory={() => handleOpenCrownSuccess('')} />
            )}
          </motion.div>
        </main>

        {/* Mobile Floating Bottom Bar */}
        <BottomNavigation
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onOpenRampage={handleOpenNewRampage}
          onOpenCreateMenu={handleOpenCreateMenu}
          isCreateMenuOpen={isCreateMenuOpen}
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
        onPlaybackChange={handlePlaybackChange}
        registerTogglePlayback={handleRegisterTogglePlayback}
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
