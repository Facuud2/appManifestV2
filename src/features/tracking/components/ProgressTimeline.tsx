'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronRight, Footprints, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT, STAGGER_CONTAINER, STAGGER_ITEM } from '@/lib/iosSprings';
import { splitTextAndUrls, generateCleanTitle, type UrlMetadataHints } from '@/utils/urlParser';
import { RichLinkPreview } from '@/components/journal/RichLinkPreview';

type FilterTab = 'todos' | 'sincronias' | 'interior';

interface ProgressTimelineProps {
  onOpenNewProgress: (manifId?: string) => void;
  onSelectManifestation?: (id: string) => void;
}

type SignKind = 'coincidence' | 'angel_number' | 'dream' | 'intuitive';

interface TimelineDisplayItem {
  id: string;
  dateLabel: string;
  timeLabel: string;
  signKind: SignKind;
  categoryLabel: string;
  title: string;
  description: string;
  hasSeparateDescription: boolean;
  manifestationTag?: string;
  manifestationId?: string;
  urls: UrlMetadataHints[];
}

const signToneMap: Record<
  SignKind,
  {
    label: string;
    pillClass: string;
  }
> = {
  coincidence: {
    label: 'Coincidencia',
    pillClass: 'bg-swiss-peri text-swiss-periInk',
  },
  angel_number: {
    label: 'Números repetidos',
    pillClass: 'bg-swiss-sky text-swiss-skyInk',
  },
  dream: {
    label: 'Sueño',
    pillClass: 'bg-swiss-butter text-swiss-butterInk',
  },
  intuitive: {
    label: 'Certeza interior',
    pillClass: 'bg-swiss-rose text-swiss-roseInk',
  },
};

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({
  onOpenNewProgress,
  onSelectManifestation,
}) => {
  const {
    activeScope,
    progressLogs: allProgressLogs,
    manifestations: allManifestations,
    deleteProgressLog,
  } = useAppStore();
  const progressLogs = useMemo(
    () => allProgressLogs.filter((item) => item.userId === activeScope),
    [allProgressLogs, activeScope]
  );
  const manifestations = useMemo(
    () => allManifestations.filter((item) => item.userId === activeScope),
    [allManifestations, activeScope]
  );
  const [activeFilter, setActiveFilter] = useState<FilterTab>('todos');
  const prefersReducedMotion = useReducedMotion();

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

      if (isToday) return { date: 'Hoy', time };
      if (isYesterday) return { date: 'Ayer', time };

      const dayMonth = date
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        .replace('.', '');
      return { date: dayMonth, time };
    } catch {
      return { date: 'Hoy', time: '12:00' };
    }
  };

  const timelineItems = useMemo<TimelineDisplayItem[]>(() => {
    return progressLogs.map((log) => {
      const { date, time } = formatDateTime(log.createdAt);
      const manif = manifestations.find((m) => m.id === log.manifestationId);

      const signKind: SignKind =
        log.signType === 'angel_number' ||
        log.signType === 'dream' ||
        log.signType === 'intuitive'
          ? log.signType
          : 'coincidence';

      const { cleanText, urls } = splitTextAndUrls(log.note);
      const cleanTitle = generateCleanTitle(log.note);
      const lines = cleanText.split('\n').filter(Boolean);
      const hasSeparateDescription = lines.length > 1;
      const title = cleanTitle || (hasSeparateDescription ? lines[0] : cleanText) || 'Sincronía registrada';
      const description = hasSeparateDescription
        ? lines.slice(1).join(' ')
        : cleanTitle && cleanText !== cleanTitle && !cleanText.startsWith(cleanTitle)
          ? cleanText
          : '';

      return {
        id: log.id,
        dateLabel: date,
        timeLabel: time,
        signKind,
        categoryLabel: signToneMap[signKind].label,
        title: title || 'Sincronía registrada',
        description,
        hasSeparateDescription: Boolean(description),
        manifestationTag: manif?.title,
        manifestationId: manif?.id || log.manifestationId,
        urls,
      };
    });
  }, [progressLogs, manifestations]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'sincronias') {
      return timelineItems.filter((item) => item.signKind !== 'intuitive');
    }
    if (activeFilter === 'interior') {
      return timelineItems.filter((item) => item.signKind === 'intuitive');
    }
    return timelineItems;
  }, [timelineItems, activeFilter]);

  const hasLogs = progressLogs.length > 0;
  const shouldStagger = filteredItems.length <= 6;

  return (
    <section
      aria-labelledby="progress-timeline-heading"
      className="swiss-card p-5 sm:p-6"
    >
      {/* Header & Filter Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="progress-timeline-heading" className="section-heading">
            Tu recorrido reciente
          </h2>
          <p className="mt-1 text-xs text-swiss-ink-muted">
            Sincronías y cambios de certeza en orden cronológico
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div
          role="tablist"
          aria-label="Filtrar avances por tipo"
          className="inline-flex self-start rounded-xl bg-swiss-control p-1 sm:self-auto"
        >
          {(['todos', 'sincronias', 'interior'] as FilterTab[]).map((tab) => {
            const isActive = activeFilter === tab;
            const labels: Record<FilterTab, string> = {
              todos: 'Todos',
              sincronias: 'Sincronías',
              interior: 'Certeza',
            };

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(tab)}
                disabled={!hasLogs}
                className={`relative min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                  !hasLogs ? 'cursor-not-allowed opacity-60' : ''
                } ${
                  isActive
                    ? 'text-swiss-ink'
                    : 'text-swiss-ink-muted hover:text-swiss-ink'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeFilterTab"
                    transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
                    className="absolute inset-0 rounded-lg bg-swiss-card shadow-card"
                  />
                )}
                <span className="relative z-10">{labels[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasLogs ? (
        filteredItems.length > 0 ? (
          <div className="relative mt-7">
            {/* Animated Vertical Connector Line */}
            <motion.div
              aria-hidden="true"
              initial={
                prefersReducedMotion
                  ? { opacity: 1, scaleY: 1 }
                  : { opacity: 0, scaleY: 0 }
              }
              animate={{ opacity: 1, scaleY: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.25, ease: EMIL_EASE_OUT }
              }
              style={{ transformOrigin: 'top' }}
              className="absolute bottom-3 left-[4.5rem] top-2 w-px bg-swiss-border sm:left-[5rem]"
            />

            <motion.div
              variants={shouldStagger ? STAGGER_CONTAINER : undefined}
              initial={shouldStagger ? 'hidden' : false}
              animate={shouldStagger ? 'show' : undefined}
              className="space-y-6"
            >
              <AnimatePresence initial={false}>
                {filteredItems.map((item) => {
                  const tone = signToneMap[item.signKind];

                  return (
                    <motion.article
                      key={item.id}
                      layout
                      variants={shouldStagger ? STAGGER_ITEM : undefined}
                      exit={{
                        opacity: 0,
                        y: 4,
                        scale: 0.98,
                        transition: { duration: 0.18, ease: EMIL_EASE_OUT },
                      }}
                      className="group relative flex items-start gap-4 sm:gap-5"
                    >
                      {/* Left Date / Time Column */}
                      <div className="w-14 shrink-0 pt-0.5 text-right tabular-nums sm:w-16">
                        <p className="text-xs font-semibold text-swiss-ink">
                          {item.dateLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-swiss-ink-light">
                          {item.timeLabel}
                        </p>
                      </div>

                      {/* Timeline Marker Dot */}
                      <div className="relative z-10 flex h-6 w-4 shrink-0 items-center justify-center">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full border-2 border-swiss-borderStrong bg-swiss-card"
                        />
                      </div>

                      {/* Right Content */}
                      <div className="min-w-0 flex-1 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone.pillClass}`}
                          >
                            <span className="pastel-dot" aria-hidden="true" />
                            {item.categoryLabel}
                          </span>

                          <button
                            type="button"
                            onClick={() => deleteProgressLog(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red focus-visible:ring-2 focus-visible:ring-swiss-focus"
                            title="Eliminar avance"
                            aria-label={`Eliminar avance: ${item.title}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>

                        <h3 className="mt-2 text-[0.9375rem] font-semibold leading-snug text-swiss-ink break-words">
                          {item.title}
                        </h3>

                        {item.hasSeparateDescription && (
                          <p className="mt-1 text-sm leading-6 text-swiss-ink-muted whitespace-pre-line break-words">
                            {item.description}
                          </p>
                        )}

                        {item.urls.map((u) => (
                          <RichLinkPreview key={u.cleanUrl} url={u.cleanUrl} />
                        ))}

                        {item.manifestationTag && (
                          item.manifestationId && onSelectManifestation ? (
                            <button
                              type="button"
                              onClick={() => onSelectManifestation(item.manifestationId!)}
                              title={`Ir a la manifestación: ${item.manifestationTag}`}
                              aria-label={`Ver manifestación: ${item.manifestationTag}`}
                              className="group/pill mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-swiss-border bg-swiss-control px-2.5 py-1 text-xs text-swiss-ink-muted transition-all duration-150 hover:border-swiss-accentBorder hover:bg-swiss-card hover:text-swiss-ink active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus cursor-pointer text-left"
                            >
                              <BookOpen
                                size={13}
                                className="shrink-0 text-swiss-accentText transition-transform duration-150 group-hover/pill:scale-110"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate font-medium text-swiss-ink group-hover/pill:text-swiss-accentText">
                                {item.manifestationTag}
                              </span>
                              <ChevronRight
                                size={12}
                                className="shrink-0 text-swiss-ink-light transition-transform duration-150 group-hover/pill:translate-x-0.5 group-hover/pill:text-swiss-accentText"
                                aria-hidden="true"
                              />
                            </button>
                          ) : (
                            <div
                              title={item.manifestationTag}
                              className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-swiss-border bg-swiss-control px-2.5 py-1 text-xs text-swiss-ink-muted"
                            >
                              <BookOpen
                                size={13}
                                className="shrink-0 text-swiss-accentText"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate font-medium text-swiss-ink">
                                {item.manifestationTag}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        ) : (
          <div className="mt-6 rounded-[16px] border border-swiss-border bg-swiss-control px-5 py-8 text-center">
            <p className="text-sm font-medium text-swiss-ink">
              No hay registros en este filtro todavía.
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter('todos')}
              className="mt-2 inline-flex min-h-9 items-center px-3 text-xs font-semibold text-swiss-accentText hover:underline"
            >
              Ver todos los avances
            </button>
          </div>
        )
      ) : (
        <div className="relative mt-7 py-4">
          {/* Background Skeleton Timeline Layout */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none opacity-45 blur-[1px] transition-all"
          >
            {/* Connecting Vertical Track Line */}
            <div className="absolute bottom-4 left-[4.85rem] top-4 w-px bg-swiss-borderStrong sm:left-[5.25rem]" />

            <div className="space-y-8">
              {/* Skeleton Node 1 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 space-y-1.5 pt-1 text-right sm:w-18">
                  <div className="ml-auto h-3 w-10 animate-pulse rounded-full bg-swiss-borderStrong" />
                  <div className="ml-auto h-2.5 w-7 animate-pulse rounded-full bg-swiss-border" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-swiss-peri" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-16 animate-pulse rounded-full bg-swiss-peri" />
                  <div className="h-4 w-4/5 animate-pulse rounded-lg bg-swiss-borderStrong" />
                  <div className="h-3 w-full animate-pulse rounded-md bg-swiss-border" />
                  <div className="h-3 w-2/3 animate-pulse rounded-md bg-swiss-border" />
                  <div className="mt-2 h-5 w-28 animate-pulse rounded-lg bg-swiss-control" />
                </div>
              </div>

              {/* Skeleton Node 2 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 space-y-1.5 pt-1 text-right sm:w-18">
                  <div className="ml-auto h-3 w-10 animate-pulse rounded-full bg-swiss-borderStrong" />
                  <div className="ml-auto h-2.5 w-7 animate-pulse rounded-full bg-swiss-border" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-swiss-rose" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-swiss-rose" />
                  <div className="h-4 w-3/4 animate-pulse rounded-lg bg-swiss-borderStrong" />
                  <div className="h-3 w-full animate-pulse rounded-md bg-swiss-border" />
                  <div className="flex gap-1 pt-1">
                    <div className="h-1.5 w-4 rounded-full bg-swiss-borderStrong" />
                    <div className="h-1.5 w-4 rounded-full bg-swiss-borderStrong" />
                    <div className="h-1.5 w-6 rounded-full bg-swiss-peri" />
                    <div className="h-1.5 w-4 rounded-full bg-swiss-borderStrong" />
                    <div className="h-1.5 w-4 rounded-full bg-swiss-borderStrong" />
                  </div>
                </div>
              </div>

              {/* Skeleton Node 3 */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-16 shrink-0 space-y-1.5 pt-1 text-right sm:w-18">
                  <div className="ml-auto h-3 w-12 animate-pulse rounded-full bg-swiss-borderStrong" />
                  <div className="ml-auto h-2.5 w-7 animate-pulse rounded-full bg-swiss-border" />
                </div>
                <div className="relative z-10 shrink-0">
                  <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-swiss-sage" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-24 animate-pulse rounded-full bg-swiss-sage" />
                  <div className="h-4 w-4/6 animate-pulse rounded-lg bg-swiss-borderStrong" />
                  <div className="h-3 w-5/6 animate-pulse rounded-md bg-swiss-border" />
                </div>
              </div>
            </div>
          </div>

          {/* Centered Overlay Empty-State Card */}
          <div className="absolute inset-0 z-20 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EMIL_EASE_OUT }}
              className="flex w-full max-w-sm flex-col items-center rounded-[20px] border border-swiss-border bg-swiss-card px-6 py-7 text-center shadow-elevated"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-swiss-control text-swiss-accentText">
                <Footprints size={22} strokeWidth={1.7} aria-hidden="true" />
              </span>

              <h3 className="mt-3.5 text-base font-semibold tracking-[-0.02em] text-swiss-ink">
                Todavía no registraste avances
              </h3>
              <p className="mt-1.5 max-w-xs text-sm leading-6 text-swiss-ink-muted">
                Cada coincidencia, número repetido o certeza interior cuenta. Podés escribirlo o dictarlo con tu voz.
              </p>

              <button
                type="button"
                onClick={() => onOpenNewProgress()}
                className="swiss-btn-secondary mt-5 inline-flex min-h-10 items-center gap-2 bg-swiss-control px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Registrar primer avance</span>
              </button>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
};
