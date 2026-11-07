'use client';

import React from 'react';

type SkeletonTone = 'default' | 'strong' | 'hero' | 'heroSoft';

interface SkeletonBlockProps {
  className?: string;
  tone?: SkeletonTone;
  style?: React.CSSProperties;
}

const toneClass: Record<SkeletonTone, string> = {
  default: 'ss-skel-block',
  strong: 'ss-skel-block-strong',
  hero: 'ss-skel-hero-block',
  heroSoft: 'ss-skel-hero-block-soft',
};

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  className = '',
  tone = 'default',
  style,
}) => (
  <span
    aria-hidden="true"
    style={style}
    className={`block ${toneClass[tone]} ${className}`}
  />
);

const waveBars = [10, 18, 26, 14, 22, 12, 20];

/**
 * Shape-matched placeholder for DashboardView. It keeps the same section
 * rhythm as the real dashboard so the reveal is layout-free.
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="w-full min-w-0 space-y-8 pb-32 lg:space-y-10 lg:pb-10"
    >
      {/* Hero: same min-height and grid as the real sanctuary. */}
      <section
        className="hero-sanctuary relative isolate animate-pulse overflow-hidden rounded-[28px] border px-6 py-7 motion-reduce:animate-none sm:px-8 sm:py-9 lg:min-h-[320px] lg:px-10 lg:py-10"
        style={{ animationDelay: '0ms' }}
      >
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
          <div>
            <SkeletonBlock
              tone="hero"
              className="h-9 w-[min(20rem,82%)] rounded-[10px] sm:h-11"
            />
            <SkeletonBlock
              tone="heroSoft"
              className="mt-4 h-4 w-[min(24rem,92%)] rounded-full"
            />
            <SkeletonBlock
              tone="heroSoft"
              className="mt-2.5 h-4 w-[min(19rem,72%)] rounded-full"
            />
            <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
              <SkeletonBlock tone="hero" className="h-10 w-36 rounded-full" />
              <SkeletonBlock tone="heroSoft" className="h-10 w-36 rounded-full" />
            </div>
            <SkeletonBlock
              tone="heroSoft"
              className="mt-4 h-3 w-56 rounded-full sm:hidden"
            />
          </div>

          <div className="mx-auto">
            <div className="grid h-[14.5rem] w-[14.5rem] place-items-center rounded-full border border-white/25">
              <SkeletonBlock
                tone="hero"
                className="h-[10.75rem] w-[10.75rem] rounded-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section
        className="animate-pulse motion-reduce:animate-none"
        style={{ animationDelay: '120ms' }}
      >
        <div className="mb-3 flex items-end justify-between gap-4">
          <SkeletonBlock className="h-5 w-44 rounded-full" />
          <SkeletonBlock className="h-4 w-16 rounded-full" />
        </div>

        <div className="swiss-group">
          {[0, 1, 2].map((index) => (
            <div key={index} className="swiss-row min-h-[4.25rem] gap-3.5 px-4">
              <SkeletonBlock
                tone="strong"
                className="h-10 w-10 shrink-0 rounded-[10px]"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-[min(12rem,55%)] rounded-full" />
                <SkeletonBlock className="h-3 w-[min(15rem,70%)] rounded-full" />
              </div>
              <SkeletonBlock className="h-4 w-4 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Continue listening */}
      <section
        className="animate-pulse motion-reduce:animate-none"
        style={{ animationDelay: '240ms' }}
      >
        <div className="swiss-card surface-peri w-full min-w-0 p-4 sm:p-card">
          <div className="flex items-start justify-between gap-3">
            <SkeletonBlock className="h-5 w-44 rounded-full sm:h-[1.375rem]" />
            <SkeletonBlock className="h-9 w-9 rounded-full sm:h-10 sm:w-10" />
          </div>

          <div className="glass-panel mt-3.5 flex w-full min-w-0 items-center gap-2.5 rounded-[18px] p-2.5 sm:mt-4 sm:gap-4 sm:rounded-[22px] sm:p-3.5">
            <SkeletonBlock
              tone="strong"
              className="h-11 w-11 shrink-0 rounded-[14px] sm:h-[3.25rem] sm:w-[3.25rem] sm:rounded-[16px]"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-[min(10rem,50%)] rounded-full" />
              <SkeletonBlock className="h-3 w-[min(16rem,80%)] rounded-full" />
            </div>
            <div className="flex shrink-0 items-end gap-1 pr-1">
              {waveBars.map((height, index) => (
                <SkeletonBlock
                  key={index}
                  className={`w-1 rounded-full ${index > 3 ? 'hidden sm:block' : ''}`}
                  style={{ height }}
                />
              ))}
            </div>
          </div>

          <SkeletonBlock className="mt-3 h-3 w-28 rounded-full" />
        </div>
      </section>
    </div>
  );
};
