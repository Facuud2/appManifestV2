'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Feather, Footprints, LayoutGrid, Plus, Sparkles, Trophy, X } from 'lucide-react';

export type NavTab = 'dashboard' | 'manifestations' | 'rampage' | 'progress' | 'stories';

interface BottomNavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenRampage: () => void;
  onOpenCreateMenu: (trigger: HTMLElement) => void;
  isCreateMenuOpen: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  onOpenRampage,
  onOpenCreateMenu,
  isCreateMenuOpen,
}) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Inicio', icon: LayoutGrid },
    { id: 'rampage' as NavTab, label: 'Rampage', icon: Sparkles, action: onOpenRampage },
    { id: 'manifestations' as NavTab, label: 'Crear', icon: Plus, isCreate: true },
    { id: 'progress' as NavTab, label: 'Avances', icon: Footprints },
    { id: 'stories' as NavTab, label: 'Historias', icon: Trophy },
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 px-page pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      <div className="swiss-nav mx-auto grid max-w-xl grid-cols-5 items-center gap-1 rounded-2xl border border-swiss-border px-2 py-2 shadow-dropdown">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && !tab.action && !tab.isCreate;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={(event) =>
                tab.isCreate
                  ? onOpenCreateMenu(event.currentTarget)
                  : tab.action
                    ? tab.action()
                    : onChangeTab(tab.id)
              }
              aria-label={tab.isCreate && isCreateMenuOpen ? 'Cerrar opciones de creación' : tab.label}
              aria-expanded={tab.isCreate ? isCreateMenuOpen : undefined}
              aria-current={isActive ? 'page' : undefined}
              title={tab.label}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                tab.isCreate
                  ? 'text-swiss-ink'
                  : isActive
                    ? 'text-swiss-accent'
                    : 'text-swiss-ink-muted hover:text-swiss-ink'
              }`}
            >
              {tab.isCreate ? (
                <span className="flex h-11 w-11 -mt-5 items-center justify-center rounded-full border-4 border-swiss-nav bg-swiss-accent text-swiss-accentFg shadow-card transition-transform active:scale-95">
                  {isCreateMenuOpen ? (
                    <X aria-hidden="true" size={20} strokeWidth={2.2} />
                  ) : (
                    <Icon aria-hidden="true" size={21} strokeWidth={2.2} />
                  )}
                </span>
              ) : (
                <Icon aria-hidden="true" size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              )}
              <span className={`max-w-full truncate text-[11px] font-medium ${tab.isCreate ? 'mt-0.5' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.span
                  layoutId="bottomNavIndicator"
                  aria-hidden="true"
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-swiss-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
