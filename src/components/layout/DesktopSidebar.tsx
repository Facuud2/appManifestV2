'use client';

import React from 'react';
import { NavTab } from './BottomNavigation';
import { Feather, Footprints, LayoutGrid, Mic, Sparkles, Trophy } from 'lucide-react';
import { useAppStore } from '@/store';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenCalibration: () => void;
  onOpenRampage: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  onOpenCalibration,
  onOpenRampage,
}) => {
  const { manifestations, successStories, activeScope, isFacuCalibrated, isMaiaCalibrated } =
    useAppStore();

  const isCurrentCalibrated =
    activeScope === 'maia'
      ? isMaiaCalibrated
      : activeScope === 'facu'
        ? isFacuCalibrated
        : isFacuCalibrated || isMaiaCalibrated;

  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'Inicio', icon: LayoutGrid },
    {
      id: 'manifestations' as NavTab,
      label: 'Escritos',
      icon: Feather,
      badge: manifestations.length,
    },
    { id: 'progress' as NavTab, label: 'Avances', icon: Footprints },
    {
      id: 'stories' as NavTab,
      label: 'Historias de éxito',
      icon: Trophy,
      badge: successStories.length,
    },
  ];

  return (
    <aside className="swiss-sidebar sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center px-2 py-4 lg:flex">
      <div
        aria-label="Manifest Sanctuary"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-swiss-accent text-swiss-accentFg shadow-card"
      >
        <Sparkles aria-hidden="true" size={17} />
      </div>

      <nav aria-label="Navegación principal" className="mt-7 flex flex-col items-center gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                isActive
                  ? 'bg-swiss-accent text-swiss-accentFg shadow-card'
                  : 'text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink'
              }`}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  aria-label={`${item.badge} elementos`}
                  className={`absolute right-0 top-0 flex h-4 min-w-4 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full px-1 text-[9px] font-semibold ${
                    isActive
                      ? 'bg-swiss-surface text-swiss-accent'
                      : 'bg-swiss-actionLavender text-swiss-accent'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onOpenRampage}
          aria-label="Abrir Rampage"
          title="Rampage"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-swiss-actionLavender text-swiss-accent transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
        >
          <Sparkles aria-hidden="true" size={20} />
        </button>
        <button
          type="button"
          onClick={onOpenCalibration}
          aria-label={isCurrentCalibrated ? 'Voz calibrada. Abrir ajustes' : 'Calibrar voz'}
          title={isCurrentCalibrated ? 'Voz calibrada' : 'Calibrar voz'}
          className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus ${
            isCurrentCalibrated ? 'text-swiss-ink-muted' : 'text-swiss-accent'
          }`}
        >
          <Mic aria-hidden="true" size={19} />
          <span
            aria-hidden="true"
            className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
              isCurrentCalibrated ? 'bg-swiss-success' : 'bg-swiss-accent'
            }`}
          />
        </button>
      </div>
    </aside>
  );
};
