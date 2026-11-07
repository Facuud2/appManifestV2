import type { Affirmation, RampageSet, UserScope } from '@/types';
import defaults from './affirmationDefaults.json';

export type RampageLoopCount = 5 | 11 | 15;

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
  return `default_${groupId}_${String(index + 1).padStart(2, '0')}`; // taste-skill-ignore
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

/**
 * Barajado Orgánico (Organic Shuffle):
 * Al completar la primera vuelta en orden, las siguientes vueltas barajan el orden
 * evitando repetir la última frase reproducida al inicio del nuevo ciclo.
 */
export function shuffleOrganically(items: string[], lastPlayed?: string): string[] {
  if (items.length <= 1) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  const normalizedLast = lastPlayed ? normalizeForMatching(lastPlayed) : '';
  if (normalizedLast && normalizeForMatching(copy[0]) === normalizedLast && copy.length > 1) {
    const swapIdx = 1 + Math.floor(Math.random() * (copy.length - 1));
    const first = copy[0];
    copy[0] = copy[swapIdx];
    copy[swapIdx] = first;
  }
  return copy;
}

/**
 * Generador determinista de respaldo y Modo Sandbox IA que respeta 100% el molde
 * literal de la Ley de la Asunción (cero poesía).
 */
export function buildDirectAssumptionAffirmations(options: {
  centralTheme: string;
  nuances?: string;
  scope: UserScope;
  count: number;
}): string[] {
  const targetCount = Math.max(1, Math.min(20, options.count || 11));
  const combined = `${options.centralTheme} ${options.nuances || ''}`.trim();
  const lower = combined.toLowerCase();

  const mentionsMaia = /\bmaia\b/i.test(combined);
  const mentionsSp = /\bsp\b|persona espec[ií]fica|pareja|ex|amor|relaci[oó]n/i.test(combined);

  const customCandidates: string[] = [];

  if (mentionsSp) {
    customCandidates.push(
      'SP me ama',
      'SP me adora',
      'Soy el favorito de SP',
      'SP me necesita',
      'SP me desea',
      'SP está obsesionada conmigo',
      'Soy la persona favorita de SP',
      'SP vive pensando en mí todo el día'
    );
  }

  if (mentionsMaia) {
    customCandidates.push(
      'Maia es mi esposa y nos divertimos juntos',
      'Mantenemos un vínculo sin título ni reglamentos con Maia',
      'Soy el esposo de Maia, y junto a SP mantenemos un triángulo amoroso',
      'Comparto cientos de actividades con Maia',
      'Paso mucho tiempo con Maia'
    );
  }

  if (lower.includes('dinero') || lower.includes('abundancia') || lower.includes('trabajo') || lower.includes('plata')) {
    customCandidates.push(
      'Tengo todo el dinero que quiero',
      'Me pagan muchísimo por lo que hago',
      'La plata llega a mí todos los días de forma fácil',
      'Vivo exactamente como quiero vivir'
    );
  }

  const corePedestal = [
    'Soy Dios',
    'Soy amado',
    'Soy querido',
    'Soy deseado',
    'La gente me ama',
    'Soy muy valioso',
    'Mi atención es única',
    'Soy elegido',
    'Soy siempre la primera opción',
    'Las mujeres me desean, buscan mantenerme y dar todo de sí mismas por mí',
    'Los hombres me adoran, buscan protegerme y regalarme cosas',
    'Soy el favorito del universo',
    'Soy dueño de mi propia realidad',
    'Tengo todo lo que deseo y todo lo que deseo me desea más a mí',
    'SP me ama',
    'Soy la persona favorita de SP',
    'SP vive pensando en mí todo el día',
  ];

  const merged = [...customCandidates, ...corePedestal];
  const { accepted } = sanitizeAffirmations(merged, targetCount);
  return accepted.slice(0, targetCount);
}
