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
} from 'lucide-react';
import { useAppStore } from '@/store';
import { RampageSet, AmbientSoundType } from '@/types';
import { APPLE_ELASTIC_SPRING, EMIL_EASE_OUT, STAGGER_CONTAINER, STAGGER_ITEM } from '@/lib/iosSprings';
import { RampageAudioWaveform } from '@/components/goals/RampageAudioWaveform';

interface RampagesViewProps {
  onOpenNewRampage: () => void;
  onPlayRampage: (rampage: RampageSet) => void;
  isRampagePlaying?: boolean;
  currentPlayingId?: string;
}

const AMBIENT_OPTIONS: { id: AmbientSoundType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'astral_rain', label: 'Lluvia astral', icon: CloudRain },
  { id: 'white_noise', label: 'Ruido blanco', icon: Radio },
  { id: 'none', label: 'Sin sonido ambiente', icon: VolumeX },
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
    const seenTitles = new Set<string>();
    const deduplicated: RampageSet[] = [];

    for (const set of scoped) {
      if (seenIds.has(set.id)) continue;
      seenIds.add(set.id);

      const normalizedTitle = set.title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) continue;
      seenTitles.add(normalizedTitle);

      deduplicated.push(set);
    }
    return deduplicated;
  }, [allRampageSets, activeScope]);

  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  // Estados para modal de crear / editar Set
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<RampageSet | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorAmbient, setEditorAmbient] = useState<AmbientSoundType>('astral_rain');
  const [editorPhrases, setEditorPhrases] = useState<string[]>([]);
  const [newPhraseInput, setNewPhraseInput] = useState('');
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Abrir editor para un set nuevo
  const handleOpenNewEditor = () => {
    setEditingSet(null);
    setEditorTitle('');
    setEditorAmbient('astral_rain');
    // Pre-cargar con 3 sugerencias vacías o dejar que el usuario agregue
    setEditorPhrases([]);
    setNewPhraseInput('');
    setEditorError('');
    setIsEditorOpen(true);
  };

  // Abrir editor para modificar un set existente
  const handleOpenEditSet = (set: RampageSet) => {
    setEditingSet(set);
    setEditorTitle(set.title);
    setEditorAmbient(set.ambientSound || 'astral_rain');
    setEditorPhrases(set.affirmations.map((a) => a.text));
    setNewPhraseInput('');
    setEditorError('');
    setIsEditorOpen(true);
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

  const handleDeleteSet = async (id: string, title: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar el set "${title}"?`)) {
      await deleteRampageSet(id);
    }
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
                      onClick={() => handleDeleteSet(rampage.id, rampage.title)}
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={APPLE_ELASTIC_SPRING}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rampage-editor-title"
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[26px] border border-[color:var(--glass-border)] bg-[color:var(--bg-card)] p-6 text-swiss-ink shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-swiss-accent/15 text-swiss-accentText">
                    <Headphones size={18} />
                  </span>
                  <div>
                    <h3 id="rampage-editor-title" className="text-base font-semibold leading-tight">
                      {editingSet ? 'Modificar Set de Rampage' : 'Crear Set de Rampage Propio'}
                    </h3>
                    <p className="text-xs text-swiss-ink-muted">
                      Arma tu colección personalizada de afirmaciones.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="rounded-full p-1.5 text-swiss-ink-muted hover:bg-swiss-control hover:text-swiss-ink transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSet} className="mt-5 space-y-5">
                {editorError && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {editorError}
                  </p>
                )}

                {/* Título */}
                <div>
                  <label htmlFor="rampage-title" className="block text-xs font-semibold text-swiss-ink">
                    Título del Rampage
                  </label>
                  <input
                    id="rampage-title"
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Ej. Despertar en Abundancia, Autoconcepto Puro…"
                    className="swiss-input mt-1.5 w-full text-sm"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Sonido ambiente */}
                <div>
                  <label className="block text-xs font-semibold text-swiss-ink mb-1.5">
                    Ambiente Sonoro de Inmersión
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {AMBIENT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = editorAmbient === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEditorAmbient(opt.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs transition-colors ${
                            isSelected
                              ? 'border-swiss-accent bg-swiss-accent/10 font-semibold text-swiss-accentText'
                              : 'border-[color:var(--border-subtle)] text-swiss-ink-muted hover:bg-swiss-control'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="text-[11px] leading-tight text-center">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Agregar frases */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-swiss-ink">
                      Afirmaciones del Set ({editorPhrases.length})
                    </label>
                  </div>

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
                      className="swiss-input flex-1 text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhrase}
                      className="swiss-btn-secondary shrink-0 px-3.5 text-xs font-semibold"
                    >
                      <Plus size={15} />
                      <span>Agregar</span>
                    </button>
                  </div>

                  {/* Decretos sugeridos desde la biblioteca */}
                  {userAffirmations.length > 0 && (
                    <div className="mt-2.5">
                      <p className="text-[11px] text-swiss-ink-light mb-1">
                        O agrega de tus afirmaciones guardadas:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {userAffirmations.slice(0, 8).map((aff) => {
                          const alreadyAdded = editorPhrases.includes(aff.text);
                          return (
                            <button
                              key={aff.id}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleAddFromLibrary(aff.text)}
                              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors truncate max-w-[200px] ${
                                alreadyAdded
                                  ? 'border-transparent bg-swiss-control opacity-50 text-swiss-ink-light'
                                  : 'border-[color:var(--border-subtle)] bg-swiss-surface text-swiss-ink hover:border-swiss-accent'
                              }`}
                              title={aff.text}
                            >
                              + {aff.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lista actual de frases */}
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-[color:var(--border-subtle)] bg-swiss-surface p-2.5">
                    {editorPhrases.length === 0 ? (
                      <p className="py-3 text-center text-xs text-swiss-ink-muted">
                        No has agregado afirmaciones aún.
                      </p>
                    ) : (
                      editorPhrases.map((phrase, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[color:var(--bg-card)] px-3 py-1.5 text-xs text-swiss-ink"
                        >
                          <span className="font-semibold text-swiss-accentText text-[11px] shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate">{phrase}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePhrase(idx)}
                            className="text-red-500 hover:text-red-600 transition-colors p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Botones de guardar */}
                <div className="flex items-center justify-end gap-2.5 border-t border-[color:var(--border-subtle)] pt-4">
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
                    className="swiss-btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold shadow-card"
                  >
                    <Check size={14} />
                    <span>{isSaving ? 'Guardando…' : editingSet ? 'Guardar Cambios' : 'Crear Rampage'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
