'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Feather, Plus, Trophy, Footprints, Trash2, Calendar, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { STAGGER_CONTAINER, STAGGER_ITEM, EMIL_CARD_TAP } from '@/lib/iosSprings';

interface ManifestationsViewProps {
  onOpenNewManifestation: () => void;
  onOpenNewProgress: (manifId?: string) => void;
  onOpenCrownSuccess: (title: string, manifId?: string) => void;
}

export const ManifestationsView: React.FC<ManifestationsViewProps> = ({
  onOpenNewManifestation,
  onOpenNewProgress,
  onOpenCrownSuccess,
}) => {
  const { manifestations, deleteManifestation, activeScope } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = manifestations.filter(
    (m) => selectedCategory === 'all' || m.category === selectedCategory
  );
  const shouldStaggerCards = filtered.length <= 6;

  const categories = [
    { id: 'all', label: 'Todas' },
    { id: 'abundancia', label: 'Abundancia 🪙' },
    { id: 'relaciones', label: 'Amor 🌸' },
    { id: 'bienestar', label: 'Salud 🕊️' },
    { id: 'carrera', label: 'Éxito ⚡' },
    { id: 'creatividad', label: 'Creatividad ✨' },
  ];

  return (
    <div className="space-y-6 pb-24 sm:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Escritos de Manifestación
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Detalles sensoriales, situaciones específicas y registro continuo
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewManifestation}
          className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={15} />
          Nuevo Escrito
        </button>
      </div>

      {/* Categories Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Manifestation Cards */}
      {filtered.length === 0 ? (
        <div className="swiss-empty p-12 text-center rounded-lg border border-dashed">
          <Feather size={32} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No hay manifestaciones en esta categoría
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
            Comienza escribiendo o dictando tus deseos sensorialmente en presente.
          </p>
          <button
            type="button"
            onClick={onOpenNewManifestation}
            className="swiss-btn-primary px-3.5 py-2 rounded-md text-xs font-medium"
          >
            Crear Escrito
          </button>
        </div>
      ) : (
        <motion.div
          variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
          initial={shouldStaggerCards ? 'hidden' : false}
          animate={shouldStaggerCards ? 'show' : undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
              whileTap={EMIL_CARD_TAP}
              className="swiss-card p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                      {new Date(item.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteManifestation(item.id)}
                      className="text-zinc-400 hover:text-swiss-red dark:text-zinc-500 dark:hover:text-swiss-red p-1 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-snug">
                  {item.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-2 leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>

                {item.sensoryAnchor && (
                  <div className="mt-3.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border-l-2 border-swiss-accent text-xs text-zinc-700 dark:text-zinc-300">
                    <span className="font-mono block text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                      Anclaje Sensorial
                    </span>
                    "{item.sensoryAnchor}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between pt-4 mt-5 border-t border-zinc-100 dark:border-zinc-800/80 gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-500" />
                  {item.status}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenNewProgress(item.id)}
                    className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Footprints size={13} />
                    Avance
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCrownSuccess(item.title, item.id)}
                    className="px-2.5 py-1.5 rounded-md bg-swiss-accent text-swiss-accentFg hover:opacity-90 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Trophy size={13} />
                    ¡Se cumplió!
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
