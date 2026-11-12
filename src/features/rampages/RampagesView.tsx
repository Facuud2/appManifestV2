'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  Play,
  Pause,
  Plus,
  Sparkles,
  CloudRain,
  Radio,
  VolumeX,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Volume2,
  Search,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { RampageSet, AmbientSoundType } from '@/types';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT, STAGGER_CONTAINER, STAGGER_ITEM } from '@/lib/iosSprings';
import { RampageAudioWaveform } from '@/components/goals/RampageAudioWaveform';
import { DeleteRampageModal } from '@/components/goals/DeleteRampageModal';

interface RampagesViewProps {
  onOpenNewRampage: () => void;
  onPlayRampage: (rampage: RampageSet) => void;
  isRampagePlaying?: boolean;
  currentPlayingId?: string;
}

const AMBIENT_OPTIONS: {
  id: AmbientSoundType;
  label: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    id: 'astral_rain',
    label: 'Lluvia astral',
    subtitle: 'Gotas binaurales y relajación profunda',
    badge: 'Calma',
    icon: CloudRain,
  },
  {
    id: 'white_noise',
    label: 'Ruido blanco',
    subtitle: 'Aislamiento acústico y enfoque total',
    badge: 'Enfoque',
    icon: Radio,
  },
  {
    id: 'none',
    label: 'Sin sonido ambiente',
    subtitle: 'Silencio puro, solo tu propia huella de voz',
    badge: 'Voz pura',
    icon: VolumeX,
  },
];

const QUICK_INSPIRATION_TITLES = [
  '⚡ Autoconcepto Invencible',
  '💎 Abundancia y Flujo',
  '🌙 Paz y Descanso Puro',
  '🔥 Magnetismo Personal',
];

export const RampagesView: React.FC<RampagesViewProps> = ({
  onOpenNewRampage,
  onPlayRampage,
  isRampagePlaying = false,
  currentPlayingId,
}) => {
  const {
    activeScope,
    rampageSets: allRampageSets,
    affirmations: allAffirmations,
    saveRampageSet,
    updateRampageSet,
    deleteRampageSet,
  } = useAppStore();

  const userAffirmations = useMemo(
    () => allAffirmations.filter((item) => item.userId === activeScope),
    [allAffirmations, activeScope]
  );

  const rampageSets = useMemo(() => {
    const scoped = allRampageSets.filter((item) => item.userId === activeScope);
    const seenIds = new Set<string>();
    const deduplicated: RampageSet[] = [];

    for (const set of scoped) {
      if (seenIds.has(set.id)) continue;
      seenIds.add(set.id);
      deduplicated.push(set);
    }
    return deduplicated;
  }, [allRampageSets, activeScope]);

  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  // Estados para modal de confirmación de eliminación
  const [setToDelete, setSetToDelete] = useState<RampageSet | null>(null);
  const [isDeletingSet, setIsDeletingSet] = useState(false);

  // Estados para modal de crear / editar Set
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<RampageSet | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorAmbient, setEditorAmbient] = useState<AmbientSoundType>('astral_rain');
  const [editorPhrases, setEditorPhrases] = useState<string[]>([]);
  const [newPhraseInput, setNewPhraseInput] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('');
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const editorDialogRef = React.useRef<HTMLDivElement>(null);

  const filteredAffirmations = useMemo(() => {
    if (!libraryFilter.trim()) return userAffirmations;
    const term = libraryFilter.toLowerCase();
    return userAffirmations.filter((a) => a.text.toLowerCase().includes(term));
  }, [userAffirmations, libraryFilter]);

  const estimatedLoopSeconds = useMemo(() => {
    // Estimación táctil: ~6 segundos por decreto más breve pausa
    return editorPhrases.length * 6;
  }, [editorPhrases.length]);

  // Abrir editor para un set nuevo
  const handleOpenNewEditor = () => {
    setEditingSet(null);
    setEditorTitle('');
    setEditorAmbient('astral_rain');
    setEditorPhrases([]);
    setNewPhraseInput('');
    setLibraryFilter('');
    setIsLibraryExpanded(false);
    setEditorError('');
    setIsEditorOpen(true);
    requestAnimationFrame(() => {
      editorDialogRef.current?.focus();
    });
  };

  // Abrir editor para modificar un set existente
  const handleOpenEditSet = (set: RampageSet) => {
    setEditingSet(set);
    setEditorTitle(set.title);
    setEditorAmbient(set.ambientSound || 'astral_rain');
    setEditorPhrases(set.affirmations.map((a) => a.text));
    setNewPhraseInput('');
    setLibraryFilter('');
    setIsLibraryExpanded(false);
    setEditorError('');
    setIsEditorOpen(true);
    requestAnimationFrame(() => {
      editorDialogRef.current?.focus();
    });
  };

  const handleAddPhrase = () => {
    const text = newPhraseInput.trim();
    if (!text) return;
    setEditorPhrases((prev) => [...prev, text]);
    setNewPhraseInput('');
  };

  const handleRemovePhrase = (index: number) => {
    setEditorPhrases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePhraseUp = (index: number) => {
    if (index <= 0) return;
    setEditorPhrases((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMovePhraseDown = (index: number) => {
    setEditorPhrases((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleAddFromLibrary = (text: string) => {
    if (editorPhrases.includes(text)) return;
    setEditorPhrases((prev) => [...prev, text]);
  };

  const handleSaveSet = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = editorTitle.trim();
    if (!title) {
      setEditorError('Ingresa un título para el Set');
      return;
    }
    if (editorPhrases.length === 0) {
      setEditorError('Agrega al menos una afirmación al Set');
      return;
    }

    setIsSaving(true);
    setEditorError('');

    try {
      const affirmations = editorPhrases.map((text, idx) => ({
        id: `${Date.now()}_${idx}`,
        text,
        repeatCount: 0,
      }));

      if (editingSet) {
        await updateRampageSet(editingSet.id, {
          title,
          ambientSound: editorAmbient,
          affirmations,
        });
      } else {
        await saveRampageSet({
          userId: activeScope,
          author: activeScope === 'maia' ? 'Maia' : activeScope === 'facu' ? 'Facu' : 'Juntos',
          title,
          ambientSound: editorAmbient,
          affirmations,
          isFavorite: false,
        });
      }

      setIsEditorOpen(false);
      setEditingSet(null);
    } catch (err: any) {
      setEditorError(err?.message || 'Error al guardar el Set');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteModal = (set: RampageSet) => {
    setSetToDelete(set);
  };

  const handleConfirmDelete = async () => {
    if (!setToDelete) return;
    setIsDeletingSet(true);
    try {
      await deleteRampageSet(setToDelete.id);
      setSetToDelete(null);
    } catch (err) {
      console.error('Error al eliminar set de rampage:', err);
    } finally {
      setIsDeletingSet(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeletingSet) return;
    setSetToDelete(null);
  };

  return (
    <div className="space-y-7 pb-32 sm:pb-12">
      {/* Encabezado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Sets de afirmaciones subliminales</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Rampages</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Colecciones de decretos diseñadas para reconfiguración mental continua. Escúchalas en
            bucle sin pausas con tu propia huella de voz y ambientes de inmersión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenNewEditor}
            className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-xs font-semibold shadow-card focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Crear Set Propio</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewRampage}
            className="swiss-btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>Generar con IA</span>
          </button>
        </div>
      </header>

      {/* Lista de Rampages */}
      {rampageSets.length === 0 ? (
        <div className="surface-butter flex flex-col items-center justify-center rounded-[24px] border p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-swiss-accent/15 text-swiss-accentText mb-3">
            <Headphones size={28} />
          </span>
          <h2 className="text-base font-semibold text-swiss-ink">Aún no tienes Rampages guardados</h2>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-swiss-ink-muted">
            Crea tu primer set personalizado seleccionando de tus decretos o genera uno con IA basado
            en tu momento actual.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleOpenNewEditor}
              className="swiss-btn-primary inline-flex min-h-11 items-center gap-2 px-5 text-xs font-semibold shadow-card"
            >
              <Plus size={15} />
              Crear primer set
            </button>
          </div>
        </div>
      ) : (
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {rampageSets.map((rampage) => {
            const isPlayingThis = isRampagePlaying && currentPlayingId === rampage.id;
            const isExpanded = expandedSetId === rampage.id;

            return (
              <motion.article
                key={rampage.id}
                variants={STAGGER_ITEM}
                className={`glass-panel relative flex flex-col justify-between rounded-[22px] p-5 transition-all ${
                  isPlayingThis ? 'ring-2 ring-swiss-accent/60 shadow-lg' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-swiss-ink-muted">
                          {rampage.ambientSound === 'white_noise' ? (
                            <>
                              <Radio size={12} /> Ruido blanco
                            </>
                          ) : rampage.ambientSound === 'astral_rain' ? (
                            <>
                              <CloudRain size={12} /> Lluvia astral
                            </>
                          ) : (
                            <>
                              <VolumeX size={12} /> Sin sonido ambiente
                            </>
                          )}
                        </span>
                        <span className="text-[11px] text-swiss-ink-light">·</span>
                        <span className="text-[11px] font-medium text-swiss-accentText">
                          {rampage.affirmations.length} decretos
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold leading-snug text-swiss-ink">
                        {rampage.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPlayRampage(rampage)}
                      aria-label={isPlayingThis ? 'Pausar rampage' : `Reproducir ${rampage.title}`}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-swiss-accent text-swiss-accentFg shadow-sm transition-transform hover:opacity-90 active:scale-95"
                    >
                      {isPlayingThis ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="translate-x-[1px]" />
                      )}
                    </button>
                  </div>

                  {/* Onda o extracto de afirmación */}
                  <div className="mt-3.5 flex items-center justify-between rounded-xl bg-swiss-surface px-3 py-2 text-xs text-swiss-ink-muted">
                    <p className="truncate italic">
                      &ldquo;{rampage.affirmations[0]?.text || 'Sin afirmaciones'}&rdquo;
                    </p>
                    {isPlayingThis && (
                      <span className="ml-2 shrink-0">
                        <RampageAudioWaveform isPlaying={true} barCount={6} />
                      </span>
                    )}
                  </div>

                  {/* Frases desplegables */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
                        className="overflow-hidden pt-3"
                      >
                        <div className="space-y-1.5 border-t border-[color:var(--border-subtle)] pt-3">
                          <p className="text-[11px] font-semibold text-swiss-ink-light uppercase tracking-wider">
                            Afirmaciones del Set:
                          </p>
                          <ul className="space-y-1 text-xs text-swiss-ink leading-relaxed max-h-48 overflow-y-auto pr-1">
                            {rampage.affirmations.map((aff, i) => (
                              <li key={aff.id || i} className="flex items-start gap-2">
                                <span className="font-semibold text-swiss-accentText text-[10px] mt-0.5">
                                  {i + 1}.
                                </span>
                                <span>{aff.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Acciones del set */}
                <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedSetId(isExpanded ? null : rampage.id)}
                    className="inline-flex items-center gap-1 text-swiss-ink-muted hover:text-swiss-ink transition-colors"
                  >
                    <span>{isExpanded ? 'Ocultar afirmaciones' : 'Ver afirmaciones'}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSet(rampage)}
                      aria-label={`Editar ${rampage.title}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink transition-colors"
                      title="Editar set"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(rampage)}
                      aria-label={`Eliminar ${rampage.title}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                      title="Eliminar set"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}

      {/* Modal para Crear / Editar Set de Rampage */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
            onClick={() => setIsEditorOpen(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 backdrop-blur-md"
          >
            <motion.div
              ref={editorDialogRef}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={APPLE_ELASTIC_SPRING}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditorOpen(false);
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rampage-editor-title"
              className="swiss-modal relative flex flex-col w-full max-w-xl max-h-[92dvh] sm:max-w-2xl rounded-t-[var(--radius-modal)] sm:rounded-[var(--radius-modal)] border border-[color:var(--glass-border)] bg-[color:var(--color-modal-surface)] p-5 sm:p-7 text-swiss-ink shadow-modal overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-swiss-accent/15 text-swiss-accentText ring-1 ring-swiss-accent/25 shadow-sm">
                    <Headphones size={20} />
                  </span>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-swiss-accentText font-semibold">
                      Estudio de Rampages
                    </span>
                    <h3 id="rampage-editor-title" className="text-lg font-semibold leading-tight text-swiss-ink">
                      {editingSet ? 'Modificar Set de Rampage' : 'Crear Set de Rampage Propio'}
                    </h3>
                    <p className="mt-0.5 text-xs text-swiss-ink-muted">
                      Arma tu colección personalizada de afirmaciones.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  aria-label="Cerrar creador de Rampage"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-swiss-ink-muted transition-colors hover:bg-swiss-control hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Formulario scrollable */}
              <form onSubmit={handleSaveSet} className="mt-5 space-y-6 overflow-y-auto pr-1">
                {editorError && (
                  <div className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-bg)] p-3 text-xs font-medium text-swiss-red flex items-center gap-2">
                    <span>{editorError}</span>
                  </div>
                )}

                {/* 1. Título */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="rampage-title" className="block text-xs font-semibold uppercase tracking-wider text-swiss-ink">
                      1. Título del Rampage
                    </label>
                    <span className="text-[11px] text-swiss-ink-light">
                      {editorTitle.length}/100
                    </span>
                  </div>
                  <input
                    id="rampage-title"
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Ej. Despertar en Abundancia, Autoconcepto Puro…"
                    className="swiss-input w-full px-3.5 py-2.5 text-sm font-medium"
                    maxLength={100}
                    required
                  />

                  {/* Sugerencias rápidas de título */}
                  {!editorTitle.trim() && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-swiss-ink-light">Inspiración:</span>
                      {QUICK_INSPIRATION_TITLES.map((titleSuggestion) => (
                        <button
                          key={titleSuggestion}
                          type="button"
                          onClick={() => setEditorTitle(titleSuggestion)}
                          className="rounded-full border border-[color:var(--border-subtle)] bg-swiss-surface/60 px-2.5 py-0.5 text-[11px] text-swiss-ink hover:border-swiss-accent hover:text-swiss-accentText transition-all"
                        >
                          {titleSuggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Sonido ambiente */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-swiss-ink">
                    2. Ambiente Sonoro de Inmersión
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {AMBIENT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = editorAmbient === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setEditorAmbient(opt.id)}
                          className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                            isSelected
                              ? 'border-swiss-accent bg-swiss-accent/10 shadow-[0_0_24px_-6px_var(--color-accent-subtle)] ring-1 ring-swiss-accent/40'
                              : 'border-[color:var(--border-subtle)] bg-swiss-surface/40 hover:bg-swiss-control/70 hover:border-swiss-border text-swiss-ink'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                                isSelected
                                  ? 'bg-swiss-accent text-swiss-accentFg'
                                  : 'bg-swiss-control text-swiss-ink-muted group-hover:text-swiss-ink'
                              }`}
                            >
                              <Icon size={16} />
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                isSelected
                                  ? 'bg-swiss-accent/20 text-swiss-accentText font-semibold'
                                  : 'bg-swiss-control/60 text-swiss-ink-light'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          </div>
                          <div className="mt-2.5">
                            <span
                              className={`text-xs font-semibold leading-tight block ${
                                isSelected ? 'text-swiss-accentText' : 'text-swiss-ink'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <p className="mt-0.5 text-[11px] leading-snug text-swiss-ink-muted">
                              {opt.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Afirmaciones del Set */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-swiss-ink">
                        3. Afirmaciones del Set ({editorPhrases.length})
                      </label>
                      {editorPhrases.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-swiss-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-swiss-accentText border border-swiss-accent/25">
                          ~{estimatedLoopSeconds}s por ciclo continuo
                        </span>
                      )}
                    </div>
                    {editorPhrases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditorPhrases([])}
                        className="text-[11px] text-swiss-ink-muted hover:text-swiss-red transition-colors"
                      >
                        Limpiar lista
                      </button>
                    )}
                  </div>

                  {/* Input para nueva afirmación */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPhraseInput}
                      onChange={(e) => setNewPhraseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPhrase();
                        }
                      }}
                      placeholder="Escribe una afirmación en primera persona…"
                      className="swiss-input flex-1 px-3.5 py-2.5 text-xs sm:text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhrase}
                      disabled={!newPhraseInput.trim()}
                      className="swiss-btn-secondary shrink-0 px-4 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:border-swiss-accent transition-all"
                    >
                      <Plus size={15} />
                      <span>Agregar</span>
                    </button>
                  </div>

                  {/* Decretos sugeridos desde la biblioteca */}
                  {userAffirmations.length > 0 && (
                    <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-swiss-surface/30 p-3 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
                          className="flex items-center gap-2 text-left group"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-swiss-control text-swiss-ink-muted group-hover:text-swiss-ink">
                            <Sparkles size={12} />
                          </span>
                          <span className="text-xs font-semibold text-swiss-ink group-hover:text-swiss-accentText transition-colors">
                            Decretos de tu biblioteca ({userAffirmations.length})
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-swiss-ink-muted transition-transform duration-200 ${
                              isLibraryExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isLibraryExpanded && userAffirmations.length > 3 && (
                          <div className="relative">
                            <input
                              type="search"
                              value={libraryFilter}
                              onChange={(e) => setLibraryFilter(e.target.value)}
                              placeholder="Filtrar…"
                              className="h-7 w-32 sm:w-44 rounded-lg border border-[color:var(--border-subtle)] bg-swiss-control/60 px-2 text-[11px] text-swiss-ink placeholder:text-swiss-ink-light focus:outline-none focus:border-swiss-accent"
                            />
                          </div>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {isLibraryExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: EMIL_EASE_OUT }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                              {filteredAffirmations.length === 0 ? (
                                <p className="py-2 text-[11px] text-swiss-ink-muted italic">
                                  No se encontraron afirmaciones con ese término.
                                </p>
                              ) : (
                                filteredAffirmations.map((aff) => {
                                  const alreadyAdded = editorPhrases.includes(aff.text);
                                  return (
                                    <button
                                      key={aff.id}
                                      type="button"
                                      onClick={() => {
                                        if (alreadyAdded) {
                                          const idx = editorPhrases.indexOf(aff.text);
                                          if (idx >= 0) handleRemovePhrase(idx);
                                        } else {
                                          handleAddFromLibrary(aff.text);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] leading-snug transition-all text-left ${
                                        alreadyAdded
                                          ? 'border-swiss-accent/40 bg-swiss-accent/15 text-swiss-accentText font-medium'
                                          : 'border-[color:var(--border-subtle)] bg-swiss-surface text-swiss-ink hover:border-swiss-border hover:bg-swiss-control'
                                      }`}
                                      title={aff.text}
                                    >
                                      <span
                                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] ${
                                          alreadyAdded
                                            ? 'bg-swiss-accent text-swiss-accentFg'
                                            : 'bg-swiss-control text-swiss-ink-muted'
                                        }`}
                                      >
                                        {alreadyAdded ? '✓' : '+'}
                                      </span>
                                      <span className="line-clamp-1 max-w-[220px] sm:max-w-[300px]">
                                        {aff.text}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Lista actual de frases de la secuencia */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-swiss-ink-light uppercase tracking-wider">
                      Secuencia en bucle:
                    </p>
                    <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-2xl border border-[color:var(--border-subtle)] bg-swiss-surface/40 p-2.5">
                      {editorPhrases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-7 text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-swiss-control text-swiss-ink-muted mb-2">
                            <Headphones size={20} />
                          </span>
                          <p className="text-xs font-semibold text-swiss-ink">
                            No has agregado afirmaciones aún.
                          </p>
                          <p className="mt-0.5 text-[11px] text-swiss-ink-muted max-w-xs">
                            Escribe tus decretos arriba o selecciónalos de tu biblioteca para armar la pista continua.
                          </p>
                        </div>
                      ) : (
                        editorPhrases.map((phrase, idx) => (
                          <div
                            key={`${phrase}_${idx}`}
                            className="group flex items-center justify-between gap-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--color-surface-card)] px-3 py-2 text-xs text-swiss-ink shadow-sm transition-all hover:border-swiss-border"
                          >
                            <span className="font-mono text-[10px] font-semibold text-swiss-accentText shrink-0 w-5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="flex-1 font-medium leading-relaxed select-text">
                              {phrase}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMovePhraseUp(idx)}
                                aria-label="Mover hacia arriba"
                                className="rounded-lg p-1 text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === editorPhrases.length - 1}
                                onClick={() => handleMovePhraseDown(idx)}
                                aria-label="Mover hacia abajo"
                                className="rounded-lg p-1 text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePhrase(idx)}
                                aria-label="Quitar afirmación"
                                className="rounded-lg p-1 text-swiss-ink-muted hover:bg-[color:var(--color-danger-bg)] hover:text-swiss-red transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de guardar */}
                <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-4 mt-2">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-swiss-ink-muted">
                    <Headphones size={13} className="text-swiss-accentText" />
                    <span>Audio continuo con tu voz calibrada</span>
                  </div>

                  <div className="flex items-center gap-2.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      className="swiss-btn-secondary px-4 py-2 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="swiss-btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold shadow-card disabled:opacity-50"
                    >
                      <Check size={14} />
                      <span>{isSaving ? 'Guardando…' : editingSet ? 'Guardar Cambios' : 'Crear Rampage'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar Set de Rampage */}
      <DeleteRampageModal
        isOpen={Boolean(setToDelete)}
        rampage={setToDelete}
        isDeleting={isDeletingSet}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};
