'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserScopeSwitcher } from './UserScopeSwitcher';
import { Ellipsis, Mic, Moon, Sun } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

interface AppHeaderProps {
  onOpenCalibration: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenCalibration }) => {
  const {
    activeScope,
    isFacuCalibrated,
    isMaiaCalibrated,
    themeMode,
    setThemeMode,
  } = useAppStore();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const preferencesTriggerRef = useRef<HTMLButtonElement>(null);

  const isCurrentCalibrated =
    activeScope === 'maia'
      ? isMaiaCalibrated
      : activeScope === 'facu'
        ? isFacuCalibrated
        : isFacuCalibrated || isMaiaCalibrated;
  const greeting =
    activeScope === 'maia'
      ? 'Hola, Maia'
      : activeScope === 'facu'
        ? 'Hola, Facu'
        : 'Hola, equipo';
  const isDark = documentThemeIsDark();

  useEffect(() => {
    const saved = localStorage.getItem('manifest_theme_mode') as
      | 'light'
      | 'dark'
      | 'system'
      | null;
    setThemeMode(saved ?? 'system');
  }, [setThemeMode]);

  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setThemeMode('system');
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, [setThemeMode, themeMode]);

  useEffect(() => {
    if (!isPreferencesOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !preferencesRef.current?.contains(event.target)) {
        setIsPreferencesOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsPreferencesOpen(false);
      preferencesTriggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPreferencesOpen]);

  const toggleTheme = () => {
    const currentIsDark = document.documentElement.classList.contains('dark');
    setThemeMode(currentIsDark ? 'light' : 'dark');
  };

  return (
    <header className="swiss-toolbar sticky top-0 z-30 w-full px-page">
      <div className="mx-auto flex h-[3.75rem] max-w-[1160px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="truncate text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em] text-swiss-ink">
            {greeting}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <UserScopeSwitcher />
          <div className="hidden items-center gap-1.5 lg:flex">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title="Cambiar tema"
              className="swiss-pill inline-flex min-h-10 min-w-10 items-center justify-center text-swiss-ink-muted transition-colors hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <Sun aria-hidden="true" size={17} className="hidden dark:block" />
              <Moon aria-hidden="true" size={17} className="block dark:hidden" />
            </button>
            <button
              type="button"
              onClick={onOpenCalibration}
              aria-label={isCurrentCalibrated ? 'Voz calibrada. Abrir ajustes de voz' : 'Calibrar voz'}
              title={isCurrentCalibrated ? 'Voz calibrada' : 'Calibrar tu voz'}
              className="swiss-pill inline-flex min-h-10 items-center gap-2 px-3 text-[0.8125rem] font-medium text-swiss-ink transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isCurrentCalibrated ? 'bg-swiss-success' : 'bg-swiss-accent'
                }`}
              />
              <Mic aria-hidden="true" size={15} />
              {isCurrentCalibrated ? 'Voz lista' : 'Calibrar voz'}
            </button>
          </div>
          <div ref={preferencesRef} className="relative lg:hidden">
            <button
              ref={preferencesTriggerRef}
              type="button"
              aria-label="Preferencias y voz"
              aria-expanded={isPreferencesOpen}
              aria-haspopup="true"
              aria-controls="mobile-preferences-menu"
              title="Preferencias y voz"
              onClick={() => setIsPreferencesOpen((open) => !open)}
              className="swiss-pill inline-flex min-h-10 min-w-10 items-center justify-center text-swiss-ink-muted transition-colors hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              <Ellipsis aria-hidden="true" size={19} />
            </button>
            <AnimatePresence>
              {isPreferencesOpen && (
                <motion.div
                  id="mobile-preferences-menu"
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -2 }}
                  transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                  style={{ transformOrigin: '100% 0%' }}
                  className="swiss-group absolute right-0 top-full z-50 mt-2 w-56 p-1 shadow-dropdown"
                >
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="swiss-row min-h-11 rounded-xl px-3 text-[0.9375rem]"
                  >
                    {isDark ? (
                      <Sun aria-hidden="true" size={17} />
                    ) : (
                      <Moon aria-hidden="true" size={17} />
                    )}
                    {isDark ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCalibration}
                    className="swiss-row min-h-11 rounded-xl px-3 text-[0.9375rem]"
                  >
                    <Mic aria-hidden="true" size={17} />
                    {isCurrentCalibrated ? 'Ajustes de voz' : 'Calibrar voz'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

const documentThemeIsDark = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
