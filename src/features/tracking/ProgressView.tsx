'use client';

import React from 'react';
import { ProgressHeroBanner } from './components/ProgressHeroBanner';
import { ProgressTimeline } from './components/ProgressTimeline';
import { FeaturedIntentionCard } from './components/FeaturedIntentionCard';

interface ProgressViewProps {
  onOpenNewProgress: (manifId?: string) => void;
  onSelectManifestation?: (id: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  onOpenNewProgress,
  onSelectManifestation,
}) => {
  return (
    <div className="space-y-6 pb-28 sm:space-y-7 sm:pb-12">
      {/* 1. Editorial Page Header */}
      <ProgressHeroBanner onOpenNewProgress={onOpenNewProgress} />

      {/* 2. Main Content Grid: Responsive 2-column on desktop, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
        {/* Left Column: Registro Personal & Timeline */}
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <ProgressTimeline onOpenNewProgress={onOpenNewProgress} />
        </div>

        {/* Right Column: Intención en foco */}
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <FeaturedIntentionCard
            onSelectManifestation={onSelectManifestation}
            onOpenNewProgress={onOpenNewProgress}
          />
        </div>
      </div>
    </div>
  );
};
