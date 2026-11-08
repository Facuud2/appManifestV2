'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Feather, Footprints } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

interface FeaturedIntentionCardProps {
  onSelectManifestation?: (id: string) => void;
  onOpenNewProgress?: (manifId?: string) => void;
}

const statusTone: Record<string, string> = {
  semilla: 'bg-swiss-butter text-swiss-butterInk',
  alineacion: 'bg-swiss-sky text-swiss-skyInk',
  evidencia: 'bg-swiss-sage text-swiss-sageInk',
  materializado: 'bg-swiss-rose text-swiss-roseInk',
};

const statusLabel: Record<string, string> = {
  semilla: 'Semilla',
  alineacion: 'Alineación',
  evidencia: 'Evidencia',
  materializado: 'Materializado',
};

const formatCategoryLabel = (category?: string) => {
  if (!category) return 'Intención personal';
  const normalized = category.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const FeaturedIntentionCard: React.FC<FeaturedIntentionCardProps> = ({
  onSelectManifestation,
  onOpenNewProgress,
}) => {
  const {
    activeScope,
    manifestations: allManifestations,
    progressLogs: allProgressLogs,
  } = useAppStore();
  const manifestations = useMemo(
    () => allManifestations.filter((item) => item.userId === activeScope),
    [allManifestations, activeScope]
  );
  const progressLogs = useMemo(
    () => allProgressLogs.filter((item) => item.userId === activeScope),
    [allProgressLogs, activeScope]
  );

  const featuredData = useMemo(() => {
    const active =
      manifestations.find((m) => m.status === 'alineacion' || m.status === 'evidencia') ||
      manifestations[0];

    if (!active) {
      return null;
    }

    const linkedLogs = progressLogs.filter((log) => log.manifestationId === active.id);
    const createdDate = new Date(active.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      id: active.id,
      category: formatCategoryLabel(active.category),
      title: active.title,
      description: active.description,
      sensoryAnchor: active.sensoryAnchor,
      status: active.status,
      advancesCount: linkedLogs.length,
      daysCount: diffDays,
    };
  }, [manifestations, progressLogs]);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EMIL_EASE_OUT }}
      aria-labelledby="featured-intention-heading"
      className="swiss-card surface-peri flex flex-col justify-between p-5 sm:p-6"
    >
      {featuredData ? (
        <>
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 id="featured-intention-heading" className="section-heading">
                Intención en foco
              </h2>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  statusTone[featuredData.status] ?? 'bg-swiss-control text-swiss-ink-muted'
                }`}
              >
                <span className="pastel-dot" aria-hidden="true" />
                {statusLabel[featuredData.status] ?? featuredData.status}
              </span>
            </div>

            <p className="mt-3 text-xs font-medium text-swiss-ink-muted">
              {featuredData.category}
            </p>

            <h3 className="mt-1 text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-swiss-ink">
              {featuredData.title}
            </h3>

            {featuredData.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-swiss-ink-muted">
                {featuredData.description}
              </p>
            )}

            {featuredData.sensoryAnchor && (
              <div className="mt-3.5 rounded-[12px] bg-swiss-control px-3.5 py-3 text-[0.8125rem] leading-5 text-swiss-ink-muted">
                <span className="mb-1 block text-xs font-semibold text-swiss-ink-light">
                  Anclaje sensorial
                </span>
                “{featuredData.sensoryAnchor}”
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-swiss-border pt-4">
            <div className="grid grid-cols-2 divide-x divide-swiss-border">
              <div className="pr-4">
                <span className="block text-xs font-medium text-swiss-ink-muted">
                  Avances vinculados
                </span>
                <span className="mt-0.5 block text-xl font-semibold tracking-tight tabular-nums text-swiss-ink">
                  {featuredData.advancesCount}
                </span>
              </div>

              <div className="pl-4">
                <span className="block text-xs font-medium text-swiss-ink-muted">
                  Tiempo en camino
                </span>
                <span className="mt-0.5 block text-xl font-semibold tracking-tight tabular-nums text-swiss-ink">
                  {featuredData.daysCount}{' '}
                  <span className="text-xs font-normal text-swiss-ink-light">
                    {featuredData.daysCount === 1 ? 'día' : 'días'}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-swiss-border pt-3.5">
              {onOpenNewProgress && (
                <button
                  type="button"
                  onClick={() => onOpenNewProgress(featuredData.id)}
                  className="swiss-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-swiss-focus"
                >
                  <Footprints size={13} aria-hidden="true" />
                  Sumar avance
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectManifestation?.(featuredData.id)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-swiss-accentText transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
              >
                <span>Ver en Manifestaciones</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-swiss-control text-swiss-accentText">
            <Feather size={18} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 id="featured-intention-heading" className="section-heading mt-3">
            Intención en foco
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-swiss-ink-muted">
            Cuando escribas una intención en Manifestaciones, vas a poder vincularle cada señal y seguir su recorrido desde acá.
          </p>
          <button
            type="button"
            onClick={() => onSelectManifestation?.('')}
            className="mt-4 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-swiss-accentText transition-colors hover:bg-swiss-control focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span>Ir a Manifestaciones</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.aside>
  );
};
