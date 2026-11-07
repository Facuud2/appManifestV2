'use client';

import React from 'react';
import { ProgressHeroBanner } from './components/ProgressHeroBanner';
import { ProgressStatMetrics } from './components/ProgressStatMetrics';
import { ProgressTimeline } from './components/ProgressTimeline';
import { FeaturedIntentionCard } from './components/FeaturedIntentionCard';

interface ProgressViewProps {
  onOpenNewProgress: () => void;
  onSelectManifestation?: (id: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  onOpenNewProgress,
  onSelectManifestation,
}) => {
  return (
    <div className="space-y-6 pb-28 sm:space-y-7 sm:pb-12">
      {/* 1. Hero Banner: Tu Camino & Call to Action */}
      <ProgressHeroBanner onOpenNewProgress={onOpenNewProgress} />

      {/* 2. Top Bento Stat Metrics: 3 Key indicators */}
      <ProgressStatMetrics />

      {/* 3. Main Content Grid: Responsive 2-column on desktop, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
        {/* Left Column (65% width on desktop): Registro Personal & Timeline */}
        <div className="lg:col-span-7 xl:col-span-8">
          <ProgressTimeline onOpenNewProgress={onOpenNewProgress} />
        </div>

        {/* Right Column (35% width on desktop): Intención Destacada with 3D Celestial Orb */}
        <div className="lg:col-span-5 xl:col-span-4">
          <FeaturedIntentionCard onSelectManifestation={onSelectManifestation} />
        </div>
      </div>
    </div>
  );
};
