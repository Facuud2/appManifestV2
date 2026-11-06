'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Feather, Footprints, LayoutGrid, Plus, Sparkles, Trophy, X } from 'lucide-react';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

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
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      <div className="swiss-tabbar mx-auto grid max-w-xl grid-cols-5 items-center gap-0.5 rounded-[26px] px-1.5 py-1.5">
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
              className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                tab.isCreate
                  ? 'text-swiss-ink'
                  : isActive
                    ? 'text-swiss-accent'
                    : 'text-swiss-ink-light hover:text-swiss-ink'
              }`}
            >
              {tab.isCreate ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-swiss-accent text-swiss-accentFg shadow-card transition-transform active:scale-95">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isCreateMenuOpen ? 'close' : 'create'}
                      initial={{
                        opacity: 0,
                        rotate: isCreateMenuOpen ? -45 : 45,
                        scale: 0.8,
                      }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        rotate: isCreateMenuOpen ? 45 : -45,
                        scale: 0.8,
                      }}
                      transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                      className="flex"
                    >
                      {isCreateMenuOpen ? (
                        <X aria-hidden="true" size={19} strokeWidth={2.2} />
                      ) : (
                        <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
              ) : (
                <motion.span
                  animate={{ scale: isActive ? 1.04 : 1 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="flex"
                >
                  <Icon aria-hidden="true" size={21} strokeWidth={isActive ? 2.1 : 1.7} />
                </motion.span>
              )}
              <span
                className={`max-w-full truncate text-[11px] leading-none ${
                  isActive ? 'font-semibold' : 'font-medium'
                } ${tab.isCreate ? 'mt-0.5' : ''}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
