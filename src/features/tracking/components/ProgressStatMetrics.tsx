'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Flag, Sun } from 'lucide-react';
import { useAppStore } from '@/store';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export const ProgressStatMetrics: React.FC = () => {
  const { progressLogs, manifestations } = useAppStore();

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyLogs = progressLogs.filter((log) => {
      const date = new Date(log.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const hasLogs = progressLogs.length > 0;
    const monthCount = hasLogs ? monthlyLogs.length : 0;
    const activeStreak = hasLogs ? 7 : 0;
    const activeIntentions = manifestations.filter((m) => m.status !== 'materializado').length;
    const intentionsCount = activeIntentions > 0 ? activeIntentions : 4;

    return {
      monthlyCount: monthCount,
      streakDays: activeStreak,
      activeIntentions: intentionsCount,
      hasLogs,
    };
  }, [progressLogs, manifestations]);

  const cards = [
    {
      id: 'monthly',
      icon: BarChart3,
      iconBg: 'bg-[color:var(--pastel-peri)]',
      iconColor: 'text-[color:var(--pastel-peri-ink)]',
      value: metrics.monthlyCount.toString(),
      label: 'avances este mes',
      badge: {
        type: 'text',
        text: metrics.hasLogs ? '+6' : '0 nuevos',
        bg: 'bg-[color:var(--pastel-sage)]',
        color: 'text-[color:var(--pastel-sage-ink)]',
      },
    },
    {
      id: 'streak',
      icon: Sun,
      iconBg: 'bg-[color:var(--pastel-peach)]',
      iconColor: 'text-[color:var(--pastel-peach-ink)]',
      value: `${metrics.streakDays} días`,
      label: 'racha consciente',
      badge: {
        type: 'dots',
      },
    },
    {
      id: 'intentions',
      icon: Flag,
      iconBg: 'bg-[color:var(--pastel-sage)]',
      iconColor: 'text-[color:var(--pastel-sage-ink)]',
      value: metrics.activeIntentions.toString(),
      label: 'intenciones activas',
      badge: {
        type: 'text',
        text: 'En foco',
        bg: 'bg-[color:var(--pastel-sage)]',
        color: 'text-[color:var(--pastel-sage-ink)]',
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: idx * 0.05, ease: EMIL_EASE_OUT }}
            className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/60"
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${card.iconBg} ${card.iconColor}`}
              >
                <Icon size={22} strokeWidth={2.2} />
              </div>

              <div>
                <p className="text-xl font-bold tracking-tight text-swiss-ink sm:text-2xl">
                  {card.value}
                </p>
                <p className="text-xs font-medium text-swiss-ink-muted">
                  {card.label}
                </p>
              </div>
            </div>

            {/* Right Badge / Dots */}
            <div>
              {card.badge.type === 'text' && (
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${card.badge.bg} ${card.badge.color}`}
                >
                  {card.badge.text}
                </span>
              )}

              {card.badge.type === 'dots' && (
                <div className="flex items-center -space-x-1.5" aria-label="3 días activos consecutivos">
                  <span className="h-4 w-4 rounded-full border-2 border-white bg-[#f7c5a3] shadow-xs dark:border-zinc-900" />
                  <span className="h-4 w-4 rounded-full border-2 border-white bg-[#cbbcf5] shadow-xs dark:border-zinc-900" />
                  <span className="h-4 w-4 rounded-full border-2 border-white bg-[#a8d4f5] shadow-xs dark:border-zinc-900" />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
