'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserScopeSwitcher } from './UserScopeSwitcher';
import { Ellipsis, FlaskConical, Mic, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';
import { runCircularReveal } from '@/lib/circularReveal';

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
    aiRequestsToday,
    aiDailyLimit,
    isSandboxMode,
    setSandboxMode,
  } = useAppStore();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const preferencesMenuRef = useRef<HTMLDivElement>(null);
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
        : 'Hola, Juntos';
  const isDark = documentThemeIsDark();

  useEffect(() => {
    const saved = localStorage.getItem('manifest_theme_mode') as
      | 'light'
      | 'dark'
      | 'system'
      | null;
    setThemeMode(saved ?? 'system');

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const standaloneMq = window.matchMedia('(display-mode: standalone)');
      setIsStandalone(
        standaloneMq.matches ||
          Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
      );
    }
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

  const toggleTheme = (origin: Element | DOMRect | null, prepare?: () => void) => {
    const currentIsDark = document.documentElement.classList.contains('dark');
    runCircularReveal({
      origin,
      prepare,
      update: () => setThemeMode(currentIsDark ? 'light' : 'dark'),
    });
  };

  return (
    <header className="swiss-toolbar sticky top-0 z-30 w-full px-page">
      <div className="mx-auto flex h-[3.75rem] max-w-[1160px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="truncate text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em] text-swiss-ink">
            {greeting}
          </p>
          {isStandalone && (
            <span className="hidden rounded-full bg-swiss-control px-2 py-0.5 text-[11px] font-semibold text-swiss-ink-muted sm:inline-flex">
              PWA
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <UserScopeSwitcher />
          <div className="hidden items-center gap-1.5 lg:flex">
            <button
              type="button"
              onClick={(event) => toggleTheme(event.currentTarget)}
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
              aria-label={isCurrentCalibrated ? 'Voz calibrada: abrir ajustes de voz' : 'Calibrar voz'}
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
              {isCurrentCalibrated ? 'Voz calibrada' : 'Calibrar voz'}
            </button>
          </div>

          <div ref={preferencesRef} className="relative">
            <button
              ref={preferencesTriggerRef}
              type="button"
              aria-label="Ajustes y cuota IA"
              aria-expanded={isPreferencesOpen}
              aria-haspopup="true"
              aria-controls="preferences-menu"
              title="Ajustes, voz y cuota Tier 1"
              onClick={() => setIsPreferencesOpen((open) => !open)}
              className="swiss-pill inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-2.5 text-swiss-ink-muted transition-colors hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
            >
              {isSandboxMode && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-swiss-success"
                  title="Modo Sandbox IA activo"
                />
              )}
              <Ellipsis aria-hidden="true" size={19} />
            </button>
            <AnimatePresence>
              {isPreferencesOpen && (
                <motion.div
                  ref={preferencesMenuRef}
                  id="preferences-menu"
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -2 }}
                  transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                  style={{ transformOrigin: '100% 0%' }}
                  className="swiss-group absolute right-0 top-full z-50 mt-2 w-64 p-1.5 shadow-dropdown"
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      const origin = event.currentTarget.getBoundingClientRect();
                      setIsPreferencesOpen(false);
                      toggleTheme(origin, () => {
                        if (preferencesMenuRef.current) {
                          preferencesMenuRef.current.style.display = 'none';
                        }
                      });
                    }}
                    className="swiss-row min-h-11 rounded-xl px-3 text-[0.9375rem] lg:hidden"
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
                    onClick={() => {
                      setIsPreferencesOpen(false);
                      onOpenCalibration();
                    }}
                    className="swiss-row min-h-11 rounded-xl px-3 text-[0.9375rem] lg:hidden"
                  >
                    <Mic aria-hidden="true" size={17} />
                    Calibrar voz
                  </button>

                  <div className="my-1 border-t border-[color:var(--border-subtle)] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-swiss-ink">
                        <ShieldCheck size={14} className="text-swiss-accentText" aria-hidden="true" />
                        Cuota Tier 1
                      </span>
                      <span
                        data-testid="ai-quota-counter"
                        className="text-xs font-semibold tabular-nums text-swiss-ink-muted"
                      >
                        Solicitudes IA hoy: {aiRequestsToday} / {aiDailyLimit}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSandboxMode}
                    data-testid="ai-sandbox-toggle"
                    onClick={() => setSandboxMode(!isSandboxMode)}
                    className="swiss-row flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[0.875rem]"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-swiss-ink">
                      <FlaskConical size={16} aria-hidden="true" />
                      Modo Sandbox IA
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isSandboxMode
                          ? 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]'
                          : 'bg-swiss-control text-swiss-ink-muted'
                      }`}
                    >
                      {isSandboxMode ? 'Activo' : 'Off'}
                    </span>
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
