'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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

export default function HomePage() {
  const { fetchRemoteData, refreshVoiceCalibrationStatus } = useAppStore();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Modals state
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isRampageOpen, setIsRampageOpen] = useState(false);
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
    const rect = trigger.getBoundingClientRect();
    createMenuTriggerRef.current = trigger;
    setCreateMenuAnchor({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    setIsCreateMenuOpen(true);
  }, []);

  const handleCloseCreateMenu = useCallback(() => {
    setIsCreateMenuOpen(false);
  }, []);

  const handleSelectCreateAction = useCallback((action: CreateAction) => {
    setIsCreateMenuOpen(false);
    if (action === 'manifestation') {
      setIsNewManifestationOpen(true);
    } else if (action === 'affirmation') {
      setIsNewAffirmationOpen(true);
    } else {
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
        onOpenRampage={() => setIsRampageOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          onOpenCalibration={() => setIsCalibrationOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1160px] flex-1 px-page py-section"
        >
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView
                onOpenManifestations={() => setActiveTab('manifestations')}
                onOpenNewManifestation={() => setIsNewManifestationOpen(true)}
                onOpenNewProgress={() => handleOpenProgress()}
                onOpenRampage={() => setIsRampageOpen(true)}
                isCreateMenuOpen={isCreateMenuOpen}
                onOpenCreateMenu={handleOpenCreateMenu}
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
          onOpenRampage={() => setIsRampageOpen(true)}
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
