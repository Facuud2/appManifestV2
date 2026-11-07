'use client';

import React, { useMemo } from 'react';
import { useAppStore } from '@/store';

export const ProgressStatMetrics: React.FC = () => {
  const { progressLogs, manifestations } = useAppStore();

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyCount = progressLogs.filter((log) => {
      const date = new Date(log.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    const totalCount = progressLogs.length;
    const activeIntentions = manifestations.filter((m) => m.status !== 'materializado').length;

    return {
      monthlyCount,
      totalCount,
      activeIntentions,
    };
  }, [progressLogs, manifestations]);

  const items = [
    {
      id: 'monthly',
      label: 'Avances este mes',
      value: metrics.monthlyCount,
      suffix: metrics.monthlyCount === 1 ? 'registro' : 'registros',
    },
    {
      id: 'total',
      label: 'Total acumulado',
      value: metrics.totalCount,
      suffix: metrics.totalCount === 1 ? 'señal' : 'señales',
    },
    {
      id: 'intentions',
      label: 'Intenciones en curso',
      value: metrics.activeIntentions,
      suffix: metrics.activeIntentions === 1 ? 'activa' : 'activas',
    },
  ];

  return (
    <section aria-label="Resumen de avances" className="swiss-card overflow-hidden">
      <div className="grid grid-cols-1 divide-y divide-swiss-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div key={item.id} className="px-5 py-4 sm:px-6">
            <p className="text-xs font-medium text-swiss-ink-muted">{item.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-swiss-ink">
                {item.value}
              </span>
              <span className="text-xs text-swiss-ink-light">{item.suffix}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
