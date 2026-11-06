import type { Affirmation, RampageSet, UserScope } from '@/types';
import defaults from './affirmationDefaults.json';

/**
 * Palabras y expresiones que rompen el estilo directo de la Ley de la Asunción.
 * Se comparan sin acentos y con límites de palabra para no descartar frases válidas.
 */
export const POETIC_BLACKLIST = [
  'fluir',
  'fluye',
  'fluyendo',
  'fluyo',
  'fluya',
  'fluidez',
  'pecho',
  'pechos',
  'latido',
  'latidos',
  'sagrado',
  'sagrada',
  'sagrados',
  'sagradas',
  'vibrar',
  'vibra',
  'vibro',
  'vibrando',
  'vibración',
  'vibracion',
  'vibraciones',
  'frecuencia',
  'frecuencias',
  'sintonizar',
  'sintonizo',
  'sintoniza',
  'sintonía',
  'sintonia',
  'sendero',
  'senderos',
  'brisa',
  'brisas',
  'respiro',
  'respiros',
  'respirar',
  'abro mis brazos',
  'certeza plena',
  'orquestó',
  'orquesto',
  'orquesta',
  'orquestan',
  'gratitud',
  'gratitud profunda',
  'reclamo mi poder',
  'universo conspira',
  'conspira',
  'conspiran',
  'luz',
  'energía',
  'energia',
  'energías',
  'energias',
  'merecer',
  'merezco',
  'merezca',
  'merecemos',
  'merecen',
  'merecimiento',
  'merecedor',
  'late',
  'laten',
  'palpita',
  'palpitar',
  'palpitación',
] as const;

export interface AffirmationGroup {
  id: string;
  title: string;
  category: string;
  userId: UserScope;
  author: string;
  affirmations: string[];
}

export interface RampageManifestationContext {
  title: string;
  description?: string;
  status?: string;
  category?: string;
}

export interface RampageHistoryContext {
  title: string;
  affirmations: string[];
}

export interface RejectedAffirmation {
  text: string;
  reason: string;
}

export interface SanitizedAffirmations {
  accepted: string[];
  rejected: RejectedAffirmation[];
}

export const DEFAULT_AFFIRMATION_GROUPS = (defaults.groups as AffirmationGroup[]).filter(
  (group) => group.affirmations.length > 0
);

const DEFAULT_BASE_TIMESTAMP = Date.parse('2026-01-01T00:00:00.000Z');

function getGroupCreatedAt(index: number): string {
  // Mantiene un orden estable y deja Autoconcepto como el set más reciente.
  const offsetMinutes = DEFAULT_AFFIRMATION_GROUPS.length - index;
  return new Date(DEFAULT_BASE_TIMESTAMP + offsetMinutes * 60_000).toISOString();
}

function getAffirmationId(groupId: string, index: number): string {
  return `default_${groupId}_${String(index + 1).padStart(2, '0')}`;
}

export const DEFAULT_AFFIRMATIONS: Affirmation[] = DEFAULT_AFFIRMATION_GROUPS.flatMap(
  (group, groupIndex) =>
    group.affirmations.map((text, index) => ({
      id: getAffirmationId(group.id, index),
      userId: group.userId,
      author: group.author,
      text,
      category: group.category,
      repeatCount: 0,
      pinned: false,
      createdAt: getGroupCreatedAt(groupIndex),
    }))
);

export const DEFAULT_RAMPAGE_SETS: RampageSet[] = DEFAULT_AFFIRMATION_GROUPS.map(
  (group, groupIndex) => ({
    id: `default_set_${group.id}`,
    userId: group.userId,
    author: group.author,
    title: group.title,
    category: group.category,
    affirmations: group.affirmations.map((text, index) => ({
      id: getAffirmationId(group.id, index),
      text,
      repeatCount: 0,
    })),
    ambientSound: 'astral_rain',
    isFavorite: false,
    createdAt: getGroupCreatedAt(groupIndex),
    updatedAt: getGroupCreatedAt(groupIndex),
  })
);

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const POETIC_PATTERNS = POETIC_BLACKLIST.map((term) => ({
  term,
  pattern: new RegExp(`\\b${escapeRegExp(normalizeForMatching(term))}\\b`, 'i'),
}));

/**
 * Devuelve la primera expresión poética/New Age encontrada, o null si la frase es válida.
 */
export function findPoeticTerm(text: string): string | null {
  const normalized = normalizeForMatching(text);
  for (const { term, pattern } of POETIC_PATTERNS) {
    if (pattern.test(normalized)) return term;
  }
  return null;
}

export function cleanAffirmationText(value: string): string {
  let cleaned = value.trim();
  cleaned = cleaned.replace(/^[-–—•*\d.)\s]+/, '');
  cleaned = cleaned.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Filtro post-generación: descarta vacías, duplicadas y cualquier frase con lenguaje poético.
 */
export function sanitizeAffirmations(items: unknown[], limit: number): SanitizedAffirmations {
  const accepted: string[] = [];
  const rejected: RejectedAffirmation[] = [];
  const seen = new Set<string>();

  if (limit <= 0) return { accepted, rejected };

  for (const item of items) {
    if (typeof item !== 'string') continue;

    const text = cleanAffirmationText(item);
    if (!text) continue;

    const key = normalizeForMatching(text);
    if (seen.has(key)) {
      rejected.push({ text, reason: 'duplicada' });
      continue;
    }

    const poeticTerm = findPoeticTerm(text);
    if (poeticTerm) {
      rejected.push({ text, reason: `lenguaje poético: "${poeticTerm}"` });
      continue;
    }

    seen.add(key);
    accepted.push(text);
    if (accepted.length >= limit) break;
  }

  return { accepted, rejected };
}

/**
 * Set de respaldo con el estilo exacto del usuario, para no romper el flujo si el modelo
 * devuelve frases que el validador tiene que descartar.
 */
export function getFallbackAffirmations(
  scope: UserScope,
  count: number,
  exclude: string[] = []
): string[] {
  const excluded = new Set(exclude.map(normalizeForMatching));
  const pool = DEFAULT_AFFIRMATION_GROUPS.filter(
    (group) => group.userId === 'shared' || scope === 'shared' || group.userId === scope
  )
    .flatMap((group) => group.affirmations)
    .filter((text) => !excluded.has(normalizeForMatching(text)) && !findPoeticTerm(text));

  return pool.slice(0, Math.max(0, count));
}

/**
 * Si la base todavía no tiene los defaults (o está vacía), los agrega al estado remoto.
 * No revive defaults que el usuario ya borró si al menos uno de ellos sigue presente.
 */
export function mergeDefaultAffirmations(remote: Affirmation[]): Affirmation[] {
  const hasAnyDefault = remote.some((item) => item.id.startsWith('default_'));
  if (remote.length > 0 && hasAnyDefault) return remote;

  const remoteIds = new Set(remote.map((item) => item.id));
  return [...remote, ...DEFAULT_AFFIRMATIONS.filter((item) => !remoteIds.has(item.id))];
}

export function mergeDefaultRampageSets(remote: RampageSet[]): RampageSet[] {
  const hasAnyDefault = remote.some((item) => item.id.startsWith('default_set_'));
  if (remote.length > 0 && hasAnyDefault) return remote;

  const remoteIds = new Set(remote.map((item) => item.id));
  return [...remote, ...DEFAULT_RAMPAGE_SETS.filter((item) => !remoteIds.has(item.id))];
}
