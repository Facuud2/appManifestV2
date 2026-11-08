'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Feather, Footprints, LayoutGrid, Plus, Quote, X } from 'lucide-react';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT } from '@/lib/iosSprings';

export type NavTab =
  | 'dashboard'
  | 'affirmations'
  | 'manifestations'
  | 'rampage'
  | 'progress'
  | 'stories'
  | 'create';

interface BottomNavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenRampage?: () => void;
  onOpenCreateMenu: (trigger: HTMLElement) => void;
  isCreateMenuOpen: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  onOpenCreateMenu,
  isCreateMenuOpen,
}) => {
  const tabs: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    isCreate?: boolean;
  }> = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutGrid },
    { id: 'affirmations', label: 'Afirmaciones', icon: Quote },
    { id: 'create', label: 'Crear', icon: Plus, isCreate: true },
    { id: 'manifestations', label: 'Manifestaciones', icon: Feather },
    { id: 'progress', label: 'Avances', icon: Footprints },
  ];

  const createActionLabel =
    activeTab === 'affirmations'
      ? 'Crear afirmación'
      : activeTab === 'manifestations'
        ? 'Crear manifestación'
        : activeTab === 'progress'
          ? 'Registrar avance'
          : 'Crear';

  const createCloseLabel =
    activeTab === 'affirmations'
      ? 'Cerrar composer de afirmación'
      : activeTab === 'manifestations'
        ? 'Cerrar composer de manifestación'
        : activeTab === 'progress'
          ? 'Cerrar registro de avance'
          : 'Cerrar opciones de creación';

  return (
    <nav
      aria-label="Navegación móvil"
      data-app-nav="mobile"
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-24 bg-[color:var(--bg-primary)] opacity-85 blur-xl"
      />
      <div className="swiss-tabbar pointer-events-auto mx-auto grid max-w-xl grid-cols-5 items-center gap-0.5 rounded-[26px] px-1.5 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && !tab.isCreate;

          return (
            <button
              key={tab.id}
              type="button"
              data-quick-add-trigger={tab.isCreate ? 'true' : undefined}
              onClick={(event) =>
                tab.isCreate
                  ? onOpenCreateMenu(event.currentTarget)
                  : onChangeTab(tab.id)
              }
              aria-label={
                tab.isCreate
                  ? isCreateMenuOpen
                    ? createCloseLabel
                    : createActionLabel
                  : tab.label
              }
              aria-expanded={tab.isCreate ? isCreateMenuOpen : undefined}
              aria-current={isActive ? 'page' : undefined}
              title={tab.isCreate ? (isCreateMenuOpen ? createCloseLabel : createActionLabel) : tab.label}
              className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus touch-manipulation select-none active:scale-[0.96] ${
                tab.isCreate
                  ? 'text-swiss-ink'
                  : isActive
                    ? 'text-swiss-accentText'
                    : 'text-swiss-ink-light hover:text-swiss-ink'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="bottomDockCapsule"
                  transition={APPLE_ELASTIC_SPRING}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0.5 -z-10 rounded-[18px] bg-swiss-control"
                />
              )}
              {tab.isCreate ? (
                <span className="swiss-create-bead flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-swiss-accentFg transition-transform active:scale-95">
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
                        <X aria-hidden="true" size={18} strokeWidth={2.4} />
                      ) : (
                        <Icon aria-hidden="true" size={19} strokeWidth={2.4} />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
              ) : (
                <motion.span
                  animate={{ scale: isActive ? 1.04 : 1 }}
                  transition={APPLE_ELASTIC_SPRING}
                  className="flex"
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={isActive ? 2.1 : 1.7} className="sm:h-5 sm:w-5" />
                </motion.span>
              )}
              <span
                className={`max-w-full truncate px-0.5 text-[10px] sm:text-[11px] leading-none ${
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
