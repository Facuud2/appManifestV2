'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Heart, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

type FilterTab = 'todos' | 'senales' | 'interior';

interface ProgressTimelineProps {
  onOpenNewProgress: () => void;
}

interface TimelineDisplayItem {
  id: string;
  dateLabel: string;
  timeLabel: string;
  category: 'SEÑAL' | 'CAMBIO INTERNO' | 'ACCIÓN ALINEADA';
  title: string;
  description: string;
  manifestationTag?: string;
  showProgressTicks?: boolean;
  activeTickIndex?: number;
  nodeType: 'signal' | 'internal' | 'action';
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({
  onOpenNewProgress,
}) => {
  const { progressLogs, manifestations, deleteProgressLog } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('todos');

  // Format date helper
  const formatDateTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      const time = date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      if (isToday) return { date: 'HOY', time };
      if (isYesterday) return { date: 'AYER', time };

      const dayMonth = date
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        .toUpperCase()
        .replace('.', '');
      return { date: dayMonth, time };
    } catch {
      return { date: 'HOY', time: '12:00' };
    }
  };

  // Build items from store
  const timelineItems = useMemo<TimelineDisplayItem[]>(() => {
    return progressLogs.map((log) => {
      const { date, time } = formatDateTime(log.createdAt);
      const manif = manifestations.find((m) => m.id === log.manifestationId);

      let category: TimelineDisplayItem['category'] = 'SEÑAL';
      let nodeType: TimelineDisplayItem['nodeType'] = 'signal';
      let showProgressTicks = false;

      if (log.signType === 'intuitive') {
        category = 'CAMBIO INTERNO';
        nodeType = 'internal';
        showProgressTicks = true;
      } else if (log.signType === 'action') {
        category = 'ACCIÓN ALINEADA';
        nodeType = 'action';
      }

      // Title and description deduction
      const lines = log.note.split('\n').filter(Boolean);
      const title = lines.length > 1 ? lines[0] : log.note.slice(0, 52) + (log.note.length > 52 ? '...' : '');
      const description = lines.length > 1 ? lines.slice(1).join(' ') : log.note;

      return {
        id: log.id,
        dateLabel: date,
        timeLabel: time,
        category,
        title: title || 'Sincronía registrada',
        description: description || log.note,
        manifestationTag: manif?.title,
        showProgressTicks,
        activeTickIndex: 2,
        nodeType,
      };
    });
  }, [progressLogs, manifestations]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'senales') {
      return timelineItems.filter((i) => i.category === 'SEÑAL');
    }
    if (activeFilter === 'interior') {
      return timelineItems.filter((i) => i.category === 'CAMBIO INTERNO');
    }
    return timelineItems;
  }, [timelineItems, activeFilter]);

  const getNodeStyles = (nodeType: TimelineDisplayItem['nodeType']) => {
    switch (nodeType) {
      case 'signal':
        return {
          container: 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]',
          labelColor: 'text-[color:var(--pastel-peri-ink)]',
          icon: Sparkles,
        };
      case 'internal':
        return {
          container: 'bg-[color:var(--pastel-rose)] text-[color:var(--pastel-rose-ink)]',
          labelColor: 'text-[color:var(--pastel-rose-ink)]',
          icon: Heart,
        };
      case 'action':
        return {
          container: 'bg-[color:var(--pastel-sage)] text-[color:var(--pastel-sage-ink)]',
          labelColor: 'text-[color:var(--pastel-sage-ink)]',
          icon: Check,
        };
    }
  };

  const hasLogs = progressLogs.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EMIL_EASE_OUT }}
      className="relative rounded-[26px] border border-white/80 bg-white/75 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60 sm:p-7"
    >
      {/* Header & Filter Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-swiss-ink-muted/80">
            REGISTRO PERSONAL
          </p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-swiss-ink sm:text-2xl">
            Tu recorrido reciente
          </h2>
        </div>

        {/* Filter Segmented Control */}
        <div className="inline-flex self-start rounded-xl bg-slate-100/90 p-1 dark:bg-zinc-800/80 sm:self-auto">
          {(['todos', 'senales', 'interior'] as FilterTab[]).map((tab) => {
            const isActive = activeFilter === tab;
            const labels: Record<FilterTab, string> = {
              todos: 'Todos',
              senales: 'Señales',
              interior: 'Interior',
            };

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                disabled={!hasLogs}
                className={`relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  !hasLogs ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  isActive
                    ? 'text-swiss-ink shadow-xs'
                    : 'text-swiss-ink-muted hover:text-swiss-ink'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeFilterTab"
                    transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-700"
                  />
                )}
                <span className="relative z-10">{labels[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Case 1: When user has logs registered */}
      {hasLogs ? (
        <div className="relative mt-8">
          {/* Continuous Vertical Connecting Line */}
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-[4.85rem] top-4 w-px bg-slate-200 dark:bg-zinc-700 sm:left-[5.25rem]"
          />

          <div className="space-y-6 sm:space-y-8">
            <AnimatePresence initial={false}>
              {filteredItems.map((item) => {
                const styles = getNodeStyles(item.nodeType);
                const Icon = styles.icon;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
                    className="group relative flex items-start gap-4 sm:gap-6"
                  >
                    {/* Left Date / Time Label */}
                    <div className="w-16 shrink-0 pt-0.5 text-right sm:w-18">
                      <p className="text-xs font-bold uppercase tracking-tight text-swiss-ink">
                        {item.dateLabel}
                      </p>
                      <p className="text-[11px] font-medium text-swiss-ink-muted">
                        {item.timeLabel}
                      </p>
                    </div>

                    {/* Node Circle on the Line */}
                    <div className="relative z-10 shrink-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full shadow-xs transition-transform duration-200 group-hover:scale-105 ${styles.container}`}
                      >
                        <Icon size={16} strokeWidth={2.4} />
                      </div>
                    </div>

                    {/* Right Content */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[10px] font-bold tracking-widest uppercase ${styles.labelColor}`}
                        >
                          {item.category}
                        </p>

                        <button
                          type="button"
                          onClick={() => deleteProgressLog(item.id)}
                          className="opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          title="Eliminar avance"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <h3 className="mt-1 text-sm font-semibold leading-snug text-swiss-ink sm:text-[15px]">
                        {item.title}
                      </h3>

                      <p className="mt-1.5 text-xs leading-relaxed text-swiss-ink-muted sm:text-sm">
                        {item.description}
                      </p>

                      {/* Associated Manifestation Tag */}
                      {item.manifestationTag && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1 text-xs text-swiss-ink-muted shadow-2xs dark:border-white/10 dark:bg-zinc-800/60">
                          <BookOpen size={13} className="text-purple-500" />
                          <span className="font-medium text-swiss-ink">
                            {item.manifestationTag}
                          </span>
                        </div>
                      )}

                      {/* Progress Segmented Indicator for Cambio Interno */}
                      {item.showProgressTicks && (
                        <div className="mt-3.5 flex items-center gap-1.5" aria-label="Nivel de alineación interna">
                          {[0, 1, 2, 3, 4].map((tickIdx) => {
                            const isHighlighted = tickIdx === (item.activeTickIndex ?? 2);
                            return (
                              <span
                                key={tickIdx}
                                className={`h-1.5 rounded-full transition-all ${
                                  isHighlighted
                                    ? 'w-6 bg-[#9d75e0]'
                                    : 'w-4 bg-slate-200 dark:bg-zinc-700'
                                }`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* Case 2: Skeleton Timeline with aesthetic overlay when there are no logs yet */
        <div className="relative mt-8 min-h-[420px] overflow-hidden">
          {/* Background Skeleton Timeline Layout (blurred & pulsing) */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none opacity-40 blur-[1px] transition-all"
          >
            {/* Connecting Vertical Track Line */}
            <div className="absolute bottom-4 left-[4.85rem] top-4 w-px bg-slate-300 dark:bg-zinc-700 sm:left-[5.25rem]" />

            <div className="space-y-8">
              {/* Skeleton Node 1 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 pt-1 text-right sm:w-18 space-y-1.5">
                  <div className="ml-auto h-3 w-10 rounded-full bg-slate-300/80 animate-pulse dark:bg-zinc-700/80" />
                  <div className="ml-auto h-2.5 w-7 rounded-full bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100/90 text-purple-400 animate-pulse dark:bg-purple-950/60" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-16 rounded-full bg-purple-200/80 animate-pulse dark:bg-purple-900/60" />
                  <div className="h-4 w-4/5 rounded-lg bg-slate-300/70 animate-pulse dark:bg-zinc-700/70" />
                  <div className="h-3 w-full rounded-md bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                  <div className="h-3 w-2/3 rounded-md bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                  <div className="mt-2 h-5 w-28 rounded-lg bg-slate-200/70 animate-pulse dark:bg-zinc-800/70" />
                </div>
              </div>

              {/* Skeleton Node 2 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 pt-1 text-right sm:w-18 space-y-1.5">
                  <div className="ml-auto h-3 w-10 rounded-full bg-slate-300/80 animate-pulse dark:bg-zinc-700/80" />
                  <div className="ml-auto h-2.5 w-7 rounded-full bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100/90 text-pink-400 animate-pulse dark:bg-pink-950/60" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-20 rounded-full bg-pink-200/80 animate-pulse dark:bg-pink-900/60" />
                  <div className="h-4 w-3/4 rounded-lg bg-slate-300/70 animate-pulse dark:bg-zinc-700/70" />
                  <div className="h-3 w-full rounded-md bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                  <div className="flex gap-1 pt-1">
                    <div className="h-1.5 w-4 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    <div className="h-1.5 w-4 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    <div className="h-1.5 w-6 rounded-full bg-purple-300 dark:bg-purple-700" />
                    <div className="h-1.5 w-4 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    <div className="h-1.5 w-4 rounded-full bg-slate-300 dark:bg-zinc-700" />
                  </div>
                </div>
              </div>

              {/* Skeleton Node 3 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 pt-1 text-right sm:w-18 space-y-1.5">
                  <div className="ml-auto h-3 w-12 rounded-full bg-slate-300/80 animate-pulse dark:bg-zinc-700/80" />
                  <div className="ml-auto h-2.5 w-7 rounded-full bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/90 text-emerald-400 animate-pulse dark:bg-emerald-950/60" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-24 rounded-full bg-emerald-200/80 animate-pulse dark:bg-emerald-900/60" />
                  <div className="h-4 w-4/6 rounded-lg bg-slate-300/70 animate-pulse dark:bg-zinc-700/70" />
                  <div className="h-3 w-5/6 rounded-md bg-slate-200/80 animate-pulse dark:bg-zinc-800/80" />
                </div>
              </div>
            </div>
          </div>

          {/* Centered Glassmorphism Overlay Card */}
          <div className="absolute inset-0 z-20 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EMIL_EASE_OUT }}
              className="w-full max-w-sm rounded-[24px] border border-white/90 bg-white/85 p-6 text-center shadow-[0_16px_40px_-8px_rgba(157,117,224,0.22)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/85 sm:p-7"
            >
              {/* Luminous Center Icon */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)] shadow-inner">
                <Sparkles size={26} strokeWidth={2.2} />
              </div>

              {/* Tagline Badge */}
              <div className="mt-4">
                <span className="inline-flex rounded-full bg-purple-100/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  Tu historia comienza acá
                </span>
              </div>

              {/* Title & Message */}
              <h3 className="mt-2 text-lg font-bold tracking-tight text-swiss-ink sm:text-xl">
                Registrá tu primer avance
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-swiss-ink-muted sm:text-sm">
                Cada coincidencia, número repetido o cambio de mentalidad cuenta. Anotalo y mirá cómo tu camino toma forma.
              </p>

              {/* Call to action button */}
              <div className="mt-5">
                <motion.button
                  type="button"
                  onClick={onOpenNewProgress}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9d75e0] to-[#865fd4] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_-3px_rgba(157,117,224,0.45)] transition-all hover:from-[#8f64d8] hover:to-[#7950ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.98] sm:text-sm"
                >
                  <Plus size={16} strokeWidth={2.6} />
                  <span>Registrar primer avance</span>
                </motion.button>
              </div>

              {/* Helpful tip */}
              <p className="mt-3 text-[11px] text-swiss-ink-muted/75">
                💡 Tip: Podés usar tu voz para dictar tu experiencia sin escribir.
              </p>
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
