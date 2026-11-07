'use client';

import React from 'react';
import { NavTab } from './BottomNavigation';
import { Feather, Footprints, LayoutGrid, Mic, Quote, Sparkles, Trophy } from 'lucide-react';
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
  const {
    manifestations,
    affirmations,
    successStories,
    activeScope,
    isFacuCalibrated,
    isMaiaCalibrated,
    aiRequestsToday,
    aiDailyLimit,
  } = useAppStore();

  const isCurrentCalibrated =
    activeScope === 'maia'
      ? isMaiaCalibrated
      : activeScope === 'facu'
        ? isFacuCalibrated
        : isFacuCalibrated || isMaiaCalibrated;

  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'Inicio', icon: LayoutGrid },
    {
      id: 'affirmations' as NavTab,
      label: 'Afirmaciones',
      icon: Quote,
      badge: affirmations.length,
    },
    {
      id: 'manifestations' as NavTab,
      label: 'Manifestaciones',
      icon: Feather,
      badge: manifestations.length,
    },
    { id: 'progress' as NavTab, label: 'Avances', icon: Footprints },
    {
      id: 'stories' as NavTab,
      label: 'Historias',
      icon: Trophy,
      badge: successStories.length,
    },
  ];

  return (
    <aside
      aria-label="Navegación lateral"
      className="sticky top-0 z-40 hidden h-dvh w-[5.5rem] shrink-0 lg:block"
    >
      <div className="swiss-sidebar swiss-sidebar-rail absolute inset-y-2 left-2 z-40 flex flex-col overflow-x-hidden overflow-y-auto rounded-[20px] border border-[color:var(--glass-border)] px-3 pb-4 pt-5">
        <div className="swiss-sidebar-row flex min-h-9 items-center px-2">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[color:var(--glass-border)] bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]"
          >
            <Sparkles size={17} />
          </div>
          <div className="swiss-sidebar-reveal min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em] text-swiss-ink">
              Manifest
            </p>
            <p className="truncate text-xs text-swiss-ink-light">Santuario de voz</p>
          </div>
        </div>

        <div className="relative mt-7 flex h-5 items-center px-2">
          <span
            aria-hidden="true"
            className="swiss-sidebar-divider absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[color:var(--border-subtle)]"
          />
          <p className="section-label swiss-sidebar-reveal">Tu espacio</p>
        </div>
        <nav aria-label="Navegación principal" className="mt-2 flex flex-col gap-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasBadge = item.badge !== undefined && item.badge > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={hasBadge ? `${item.label}, ${item.badge} elementos` : item.label}
                title={item.label}
                className={`swiss-sidebar-row flex min-h-11 items-center rounded-[10px] px-2.5 text-left text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                  isActive
                    ? 'bg-swiss-control font-medium text-swiss-ink'
                    : 'text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink'
                }`}
              >
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon aria-hidden="true" size={19} strokeWidth={isActive ? 2.1 : 1.8} />
                  {hasBadge && (
                    <span
                      aria-hidden="true"
                      className="swiss-sidebar-badge-dot absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-swiss-accent"
                    />
                  )}
                </span>
                <span className="swiss-sidebar-reveal min-w-0 flex-1 truncate">{item.label}</span>
                {hasBadge && (
                  <span className="swiss-sidebar-badge-count flex shrink-0 items-center">
                    <span
                      aria-label={`${item.badge} elementos`}
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                        isActive
                          ? 'bg-swiss-accent text-swiss-accentFg'
                          : 'bg-swiss-control text-swiss-ink-light'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="relative mt-6 flex h-5 items-center px-2">
          <span
            aria-hidden="true"
            className="swiss-sidebar-divider absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[color:var(--border-subtle)]"
          />
          <p className="section-label swiss-sidebar-reveal">Acciones</p>
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onOpenRampage}
            aria-label="Abrir Rampage"
            title="Rampage"
            className="swiss-sidebar-row flex min-h-11 items-center rounded-[10px] px-2.5 text-left text-[0.9375rem] text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-swiss-accentText">
              <Sparkles aria-hidden="true" size={18} />
            </span>
            <span className="swiss-sidebar-reveal min-w-0 flex-1 truncate">Rampage</span>
          </button>
          <button
            type="button"
            onClick={onOpenCalibration}
            aria-label={isCurrentCalibrated ? 'Voz calibrada. Abrir ajustes de voz' : 'Calibrar voz'}
            title={isCurrentCalibrated ? 'Voz calibrada' : 'Calibrar voz'}
            className="swiss-sidebar-row flex min-h-11 items-center rounded-[10px] px-2.5 text-left text-[0.9375rem] text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <Mic aria-hidden="true" size={18} />
              <span
                aria-hidden="true"
                className={`swiss-sidebar-badge-dot absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ${
                  isCurrentCalibrated ? 'bg-swiss-success' : 'bg-swiss-accent'
                }`}
              />
            </span>
            <span className="swiss-sidebar-reveal min-w-0 flex-1 truncate">Voz</span>
            <span className="swiss-sidebar-badge-count flex shrink-0 items-center">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isCurrentCalibrated ? 'bg-swiss-success' : 'bg-swiss-accent'
                }`}
              />
            </span>
          </button>
        </div>

        <div className="surface-butter swiss-sidebar-row mt-auto flex items-center gap-2.5 rounded-[16px] border px-3 py-3">
          <span
            aria-hidden="true"
            className="shrink-0 text-[color:var(--pastel-butter-ink)]"
          >
            <Sparkles size={17} strokeWidth={1.7} />
          </span>
          <div className="swiss-sidebar-reveal-block min-w-0">
            <p className="text-xs font-semibold text-swiss-ink">
              {isCurrentCalibrated ? 'Voz lista' : 'Tu voz te espera'}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-swiss-ink-muted">
              Solicitudes IA hoy: {aiRequestsToday} / {aiDailyLimit}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
