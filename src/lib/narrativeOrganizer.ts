import { z } from 'zod';
import { findPoeticTerm } from './affirmationEngine';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export const NARRATIVE_PROFILE_IDS = ['facu', 'maia', 'shared'] as const;
export type NarrativeProfileId = (typeof NARRATIVE_PROFILE_IDS)[number];

export const NARRATIVE_SCENARIOS = [
  'sabrina_initial',
  'sabrina_add_age',
  'sabrina_homonym',
  'sabrina_unlink',
  'sabrina_rampage',
  'unclear',
] as const;
export type NarrativeScenario = (typeof NARRATIVE_SCENARIOS)[number];

export interface ExistingContextItem {
  id: string;
  title: string;
  personNames: string[];
  summary: string;
}

export type NarrativeLink =
  | { kind: 'existing'; id: string }
  | { kind: 'temp'; id: string }
  | { kind: 'none' };

export type ManifestationStatus = 'semilla' | 'alineacion' | 'evidencia' | 'materializado';

export interface ProposedManifestation {
  tempId: string;
  isNewPersonWithSameName: boolean;
  title: string;
  content: string;
  context: string;
  category?: string;
  status: ManifestationStatus;
}

export interface ProposedProgress {
  tempId: string;
  title: string;
  content: string;
  link: NarrativeLink;
  signType?: string;
}

export interface ProposedSuccess {
  tempId: string;
  title: string;
  content: string;
  link: NarrativeLink;
  manifestedDate: string;
}

export interface ProposedAffirmation {
  tempId: string;
  text: string;
  category?: string;
}

export interface ProposedRampage {
  title: string;
  count: 5 | 11 | 15;
  affirmations: string[];
  ambientSound: 'white_noise' | 'astral_rain' | 'none';
}

export interface NarrativeProposedPlan {
  manifestations: ProposedManifestation[];
  progressLogs: ProposedProgress[];
  successStories: ProposedSuccess[];
  affirmations: ProposedAffirmation[];
  rampageToStart: ProposedRampage | null;
}

export interface NarrativeDraft {
  draftId: string;
  userTranscript: string;
  siriResponse: string;
  proposedPlan: NarrativeProposedPlan;
}

export interface NarrativeCommitResult {
  draftId: string;
  profileId: NarrativeProfileId;
  manifestations: Array<{
    id: string;
    userId: NarrativeProfileId;
    author: string;
    title: string;
    description: string;
    sensoryAnchor: string;
    category: string;
    status: ManifestationStatus;
    createdAt: string;
    updatedAt: string;
    tempId: string;
  }>;
  progressLogs: Array<{
    id: string;
    manifestationId: string | null;
    userId: NarrativeProfileId;
    note: string;
    signType: string | null;
    voiceTranscript: string | null;
    createdAt: string;
    tempId: string;
  }>;
  successStories: Array<{
    id: string;
    manifestationId: string | null;
    userId: NarrativeProfileId;
    author: string;
    title: string;
    story: string;
    gratitudeNote: string;
    manifestedDate: string;
    createdAt: string;
    tempId: string;
  }>;
  affirmations: Array<{
    id: string;
    userId: NarrativeProfileId;
    author: string;
    text: string;
    category?: string;
    repeatCount: number;
    pinned: boolean;
    order: number;
    createdAt: string;
    tempId: string;
  }>;
  skippedAffirmations: string[];
}

/* -------------------------------------------------------------------------- */
/*  Limits                                                                    */
/* -------------------------------------------------------------------------- */

export const NARRATIVE_LIMITS = {
  manifestations: 10,
  progressLogs: 20,
  successStories: 10,
  affirmations: 20,
  existingContext: 50,
  title: 280,
  content: 10000,
  context: 1000,
  affirmation: 1000,
  category: 100,
  transcript: 10000,
  siriResponse: 240,
} as const;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function resolveNarrativeProfileId(value: unknown): NarrativeProfileId {
  if (value === 'maia') return 'maia';
  if (value === 'shared' || value === 'juntos') return 'shared';
  return 'facu';
}

export function isNarrativeProfileId(value: unknown): value is NarrativeProfileId {
  return typeof value === 'string' && (NARRATIVE_PROFILE_IDS as readonly string[]).includes(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function clipText(value: unknown, max: number): string {
  const text = readString(value);
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd();
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeIdFragment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'item';
}

export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function normalizeDate(value: unknown): string {
  const raw = readString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return todayIsoDate();
}

const SIGN_TYPES = new Set(['coincidence', 'angel_number', 'dream', 'intuitive', 'encounter', 'symbol']);
const MANIFESTATION_STATUSES = new Set<ManifestationStatus>([
  'semilla',
  'alineacion',
  'evidencia',
  'materializado',
]);

function normalizeStatus(value: unknown): ManifestationStatus {
  return typeof value === 'string' && MANIFESTATION_STATUSES.has(value as ManifestationStatus)
    ? (value as ManifestationStatus)
    : 'semilla';
}

/* -------------------------------------------------------------------------- */
/*  Person name hints                                                         */
/* -------------------------------------------------------------------------- */

const PERSON_NAME_STOPWORDS = new Set([
  'Dios',
  'Universo',
  'Tinder',
  'Instagram',
  'Whatsapp',
  'Hoy',
  'Ayer',
  'Mañana',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
  'Buenos',
  'Aires',
]);

/**
 * Heuristic only: names that follow a connector and start with a capital.
 * The model makes the final call; this just gives it a hint.
 */
export function extractPersonNames(text: string): string[] {
  if (!text) return [];
  const names = new Set<string>();
  const regex = /\b(?:con|de|para|a|por|sobre|conocer a|hablar con)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1];
    if (PERSON_NAME_STOPWORDS.has(candidate)) continue;
    names.add(candidate);
    if (names.size >= 8) break;
  }
  return [...names];
}

/* -------------------------------------------------------------------------- */
/*  Zod (tolerant: the model is never trusted)                                */
/* -------------------------------------------------------------------------- */

const RawEntitySchema = z.object({}).passthrough();

const RawDraftSchema = z
  .object({
    userTranscript: z.string().optional(),
    siriResponse: z.string().optional(),
    proposedPlan: z.object({}).passthrough().optional(),
    manifestations: z.array(z.unknown()).optional(),
    progressLogs: z.array(z.unknown()).optional(),
    successStories: z.array(z.unknown()).optional(),
    affirmations: z.array(z.unknown()).optional(),
    rampageToStart: z.unknown().optional(),
  })
  .passthrough();

export function parseJsonLoose(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/* -------------------------------------------------------------------------- */
/*  Link resolution                                                           */
/* -------------------------------------------------------------------------- */

function stringSet(values: Array<string | undefined>): Set<string> {
  return new Set(values.filter((value): value is string => Boolean(value)));
}

function resolveLink(
  rawLink: unknown,
  legacyId: unknown,
  legacyIsTemp: unknown,
  existingIds: Set<string>,
  tempIds: Set<string>
): NarrativeLink {
  const candidateId = readString(legacyId);

  if (isRecord(rawLink)) {
    const kind = readString(rawLink.kind);
    const id = readString(rawLink.id);
    if (id) {
      if (kind === 'existing' && existingIds.has(id)) return { kind: 'existing', id };
      if (kind === 'temp' && tempIds.has(id)) return { kind: 'temp', id };
      // Kind omitted or stale: infer from the known sets.
      if (existingIds.has(id)) return { kind: 'existing', id };
      if (tempIds.has(id)) return { kind: 'temp', id };
    }
  }

  if (candidateId) {
    if (legacyIsTemp === true) {
      if (tempIds.has(candidateId)) return { kind: 'temp', id: candidateId };
    } else if (existingIds.has(candidateId)) {
      return { kind: 'existing', id: candidateId };
    } else if (tempIds.has(candidateId)) {
      return { kind: 'temp', id: candidateId };
    }
  }

  return { kind: 'none' };
}

/* -------------------------------------------------------------------------- */
/*  Normalizer                                                                */
/* -------------------------------------------------------------------------- */

interface NormalizeOptions {
  draftId: string;
  existingContext?: ExistingContextItem[];
  existingManifestationIds?: string[];
  /** When true, legacy `linkedToId` is accepted and migrated to `link`. */
  allowLegacy?: boolean;
}

export interface NormalizeResult {
  draft: NarrativeDraft;
  warnings: string[];
}

export function normalizeNarrativeDraft(raw: unknown, options: NormalizeOptions): NormalizeResult {
  const warnings: string[] = [];
  const parsed = typeof raw === 'string' ? parseJsonLoose(raw) : raw;
  const root = RawDraftSchema.safeParse(parsed);

  if (!root.success) {
    warnings.push('La respuesta de la IA no tenía la forma esperada.');
    return {
      draft: emptyNarrativeDraft(options.draftId),
      warnings,
    };
  }

  const data = root.data;
  const planSource = isRecord(data.proposedPlan) ? data.proposedPlan : (data as Record<string, unknown>);

  const existingIds = stringSet([
    ...(options.existingContext || []).map((item) => item.id),
    ...(options.existingManifestationIds || []),
  ]);

  /* ------------------------------- manifestations ------------------------ */
  const rawManifestations = asArray(planSource.manifestations).slice(0, NARRATIVE_LIMITS.manifestations);
  const usedTempIds = new Set<string>();
  const manifestations: ProposedManifestation[] = [];

  rawManifestations.forEach((item, index) => {
    if (!isRecord(item)) return;
    const entity = RawEntitySchema.safeParse(item);
    if (!entity.success) return;
    const record = entity.data;

    let tempId = sanitizeIdFragment(readString(record.tempId) || `m_${index + 1}`);
    let suffix = 1;
    while (usedTempIds.has(tempId)) {
      tempId = `${sanitizeIdFragment(readString(record.tempId) || `m_${index + 1}`)}_${suffix++}`;
    }
    usedTempIds.add(tempId);

    const content = clipText(record.content, NARRATIVE_LIMITS.content);
    const derivedTitle =
      content.split(/[.!?\n]/)[0]?.trim().slice(0, NARRATIVE_LIMITS.title) || `Manifestación ${index + 1}`;

    manifestations.push({
      tempId,
      isNewPersonWithSameName: Boolean(record.isNewPersonWithSameName),
      title: clipText(record.title, NARRATIVE_LIMITS.title) || derivedTitle,
      content: content || clipText(record.title, NARRATIVE_LIMITS.content),
      context: clipText(record.context ?? record.metadata, NARRATIVE_LIMITS.context),
      category: clipText(record.category, NARRATIVE_LIMITS.category) || undefined,
      status: normalizeStatus(record.status),
    });
  });

  if (rawManifestations.length > NARRATIVE_LIMITS.manifestations) {
    warnings.push('Se recortaron manifestaciones al máximo permitido.');
  }

  const tempManifestationIds = new Set(manifestations.map((item) => item.tempId));

  /* ------------------------------- progress ------------------------------ */
  const progressLogs: ProposedProgress[] = asArray(planSource.progressLogs)
    .slice(0, NARRATIVE_LIMITS.progressLogs)
    .flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const link = resolveLink(
        item.link,
        item.linkedToId,
        item.isLinkedToTemp,
        existingIds,
        tempManifestationIds
      );
      const content = clipText(item.content ?? item.note, NARRATIVE_LIMITS.content);
      const title =
        clipText(item.title, NARRATIVE_LIMITS.title) ||
        content.split(/[.!?\n]/)[0]?.trim().slice(0, NARRATIVE_LIMITS.title) ||
        `Avance ${index + 1}`;
      const signType = readString(item.signType);
      return [
        {
          tempId: sanitizeIdFragment(readString(item.tempId) || `p_${index + 1}`),
          title,
          content,
          link,
          signType: SIGN_TYPES.has(signType) ? signType : undefined,
        },
      ];
    });

  /* ------------------------------- success ------------------------------- */
  const successStories: ProposedSuccess[] = asArray(planSource.successStories)
    .slice(0, NARRATIVE_LIMITS.successStories)
    .flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const link = resolveLink(
        item.link,
        item.linkedToId,
        item.isLinkedToTemp,
        existingIds,
        tempManifestationIds
      );
      const content = clipText(item.content ?? item.story, NARRATIVE_LIMITS.content);
      const title =
        clipText(item.title, NARRATIVE_LIMITS.title) ||
        content.split(/[.!?\n]/)[0]?.trim().slice(0, NARRATIVE_LIMITS.title) ||
        `Historia de éxito ${index + 1}`;
      return [
        {
          tempId: sanitizeIdFragment(readString(item.tempId) || `s_${index + 1}`),
          title,
          content,
          link,
          manifestedDate: normalizeDate(item.manifestedDate),
        },
      ];
    });

  /* ------------------------------- affirmations -------------------------- */
  const seenAffirmations = new Set<string>();
  const skippedAffirmations: string[] = [];
  const affirmations: ProposedAffirmation[] = [];

  asArray(planSource.affirmations)
    .slice(0, NARRATIVE_LIMITS.affirmations)
    .forEach((item, index) => {
      const record = isRecord(item) ? item : { text: item };
      const text = clipText(record.text, NARRATIVE_LIMITS.affirmation);
      if (!text) return;

      const poetic = findPoeticTerm(text);
      if (poetic) {
        skippedAffirmations.push(text);
        warnings.push(`Se descartó una afirmación con lenguaje poético ("${poetic}").`);
        return;
      }

      const key = normalizeForCompare(text);
      if (seenAffirmations.has(key)) return;
      seenAffirmations.add(key);

      affirmations.push({
        tempId: sanitizeIdFragment(readString(record.tempId) || `a_${index + 1}`),
        text,
        category: clipText(record.category, NARRATIVE_LIMITS.category) || undefined,
      });
    });

  /* ------------------------------- rampage ------------------------------- */
  let rampageToStart: ProposedRampage | null = null;
  const rawRampage = planSource.rampageToStart;
  if (isRecord(rawRampage)) {
    const rawCount = Number(rawRampage.count);
    const count: 5 | 11 | 15 = rawCount === 5 || rawCount === 15 ? rawCount : 11;
    const rawAffirmations = asArray(rawRampage.affirmations)
      .map((entry) => (isRecord(entry) ? readString(entry.text) : readString(entry)))
      .filter(Boolean);
    const unique = [...new Set(rawAffirmations.map((text) => text.trim()))].filter(
      (text) => !findPoeticTerm(text)
    );

    const ambientRaw = readString(rawRampage.ambientSound);
    const ambientSound =
      ambientRaw === 'none' || ambientRaw === 'white_noise' || ambientRaw === 'astral_rain'
        ? ambientRaw
        : 'astral_rain';

    if (unique.length >= count) {
      rampageToStart = {
        title: clipText(rawRampage.title, 200) || 'Rampage organizado por voz',
        count,
        affirmations: unique.slice(0, count).map((text) => clipText(text, NARRATIVE_LIMITS.affirmation)),
        ambientSound,
      };
    } else if (unique.length > 0) {
      warnings.push('El Rampage propuesto no tenía suficientes afirmaciones válidas.');
    }
  }

  const proposedPlan: NarrativeProposedPlan = {
    manifestations,
    progressLogs,
    successStories,
    affirmations,
    rampageToStart,
  };

  const hasItems = countProposedItems(proposedPlan) > 0;
  const rawResponse = clipText(data.siriResponse, NARRATIVE_LIMITS.siriResponse);
  const siriResponse =
    rawResponse ||
    (hasItems
      ? 'Entendido. Revisá lo que voy a registrar y confirmá cuando estés listo.'
      : 'No te entendí del todo. Tocá el orbe y contámelo de nuevo.');

  return {
    draft: {
      draftId: options.draftId,
      userTranscript: clipText(data.userTranscript, NARRATIVE_LIMITS.transcript),
      siriResponse,
      proposedPlan,
    },
    warnings,
  };
}

export function emptyNarrativeDraft(draftId: string): NarrativeDraft {
  return {
    draftId,
    userTranscript: '',
    siriResponse: 'No te entendí del todo. Tocá el orbe y contámelo de nuevo.',
    proposedPlan: {
      manifestations: [],
      progressLogs: [],
      successStories: [],
      affirmations: [],
      rampageToStart: null,
    },
  };
}

export function countProposedItems(plan: NarrativeProposedPlan): number {
  return (
    plan.manifestations.length +
    plan.progressLogs.length +
    plan.successStories.length +
    plan.affirmations.length +
    (plan.rampageToStart ? 1 : 0)
  );
}

export function hasProposedItems(plan: NarrativeProposedPlan | null | undefined): boolean {
  return Boolean(plan && countProposedItems(plan) > 0);
}

/* -------------------------------------------------------------------------- */
/*  Sandbox fixtures (deterministic E2E)                                      */
/* -------------------------------------------------------------------------- */

interface SandboxOptions {
  scenario?: NarrativeScenario | string;
  spokenText?: string;
  currentDraft?: NarrativeDraft | null;
  existingContext?: ExistingContextItem[];
  draftId: string;
}

const SABRINA_CONTEXT =
  'La conocí en Tinder. Es una chica tierna, cálida y siempre está para mí. Volvimos a hablar y me pasó su número.';
const SABRINA_AFFIRMATION =
  'Tengo una chica tierna y cálida que siempre está para mí y me habla con la mejor onda';

function baseSabrinaDraft(draftId: string): NarrativeDraft {
  return {
    draftId,
    userTranscript:
      'Vengo manifestando conocer a una chica tierna y cálida. Conocí a Sabrina en Tinder, volvimos a hablar, me pasó su número y tuvimos un buen encuentro. Próximamente quiero entablar una relación con ella y tener muchas juntadas.',
    siriResponse:
      'Voy a crear una manifestación para Sabrina, registrar el encuentro de Tinder como avance vinculado y sumar la afirmación sobre tener una chica tierna y cálida.',
    proposedPlan: {
      manifestations: [
        {
          tempId: 'm_1',
          isNewPersonWithSameName: false,
          title: 'Relación y juntadas con Sabrina',
          content:
            'Estoy en una relación increíble con Sabrina y compartimos muchísimas juntadas.',
          context: SABRINA_CONTEXT,
          category: 'relaciones',
          status: 'semilla',
        },
      ],
      progressLogs: [
        {
          tempId: 'p_1',
          title: 'Primer encuentro con Sabrina',
          content:
            'Volvimos a hablar por Tinder, me pasó su número y tuvimos un muy buen encuentro.',
          link: { kind: 'temp', id: 'm_1' },
          signType: 'coincidence',
        },
      ],
      successStories: [],
      affirmations: [
        { tempId: 'a_1', text: SABRINA_AFFIRMATION, category: 'Vínculos' },
      ],
      rampageToStart: null,
    },
  };
}

export function buildSandboxNarrativeDraft(options: SandboxOptions): NarrativeDraft {
  const scenario = (options.scenario || 'sabrina_initial') as NarrativeScenario;
  const draftId = options.draftId;

  switch (scenario) {
    case 'unclear':
      return {
        draftId,
        userTranscript: options.spokenText || '',
        siriResponse: 'No te entendí del todo. Tocá el orbe y contámelo de nuevo.',
        proposedPlan: {
          manifestations: [],
          progressLogs: [],
          successStories: [],
          affirmations: [],
          rampageToStart: null,
        },
      };

    case 'sabrina_add_age': {
      const draft = options.currentDraft
        ? deepClone(options.currentDraft)
        : baseSabrinaDraft(draftId);
      const target = draft.proposedPlan.manifestations[0];
      if (target) {
        target.context = `${target.context} Tiene 23 años.`.trim();
        target.title = target.title.replace(/\s*\(.*?\)\s*$/, '');
      }
      if (draft.proposedPlan.progressLogs[0]) {
        draft.proposedPlan.progressLogs[0].content =
          `${draft.proposedPlan.progressLogs[0].content} Tiene 23 años.`;
      }
      draft.siriResponse =
        'Listo: agregué que Sabrina tiene 23 años y mantuve el resto del borrador intacto.';
      return draft;
    }

    case 'sabrina_homonym': {
      const draft = baseSabrinaDraft(draftId);
      draft.userTranscript =
        'Me empecé a hablar con una chica que no es la misma Sabrina de antes. La conocí en Tinder y quiero ver qué pasa.';
      draft.siriResponse =
        'Entendido: es otra Sabrina. Voy a crear una manifestación nueva como Sabrina (Tinder), separada de la anterior, y el avance queda vinculado a ella.';
      draft.proposedPlan.manifestations = [
        {
          tempId: 'new_m_1',
          isNewPersonWithSameName: true,
          title: 'Sabrina (Tinder)',
          content:
            'Estoy conociendo a Sabrina, la conocí en Tinder, y quiero ver cómo sigue nuestra conexión.',
          context: 'Es una chica nueva, distinta a la Sabrina de antes. La conocí en Tinder.',
          category: 'relaciones',
          status: 'semilla',
        },
      ];
      draft.proposedPlan.progressLogs = [
        {
          tempId: 'new_p_1',
          title: 'Primer contacto con la nueva Sabrina',
          content: 'Empecé a hablar con ella por Tinder y pegamos re buena onda.',
          link: { kind: 'temp', id: 'new_m_1' },
          signType: 'encounter',
        },
      ];
      return draft;
    }

    case 'sabrina_unlink': {
      const draft = options.currentDraft
        ? deepClone(options.currentDraft)
        : baseSabrinaDraft(draftId);
      const newTempId = 'new_m_1';
      const hasNew = draft.proposedPlan.manifestations.some(
        (item) => item.tempId === newTempId
      );
      if (!hasNew) {
        draft.proposedPlan.manifestations.unshift({
          tempId: newTempId,
          isNewPersonWithSameName: true,
          title: 'Sabrina (Tinder)',
          content:
            'Estoy conociendo a Sabrina, la conocí en Tinder, y quiero ver cómo sigue nuestra conexión.',
          context: 'Es una chica nueva, distinta a la Sabrina que tenía registrada. La conocí en Tinder.',
          category: 'relaciones',
          status: 'semilla',
        });
      }
      draft.proposedPlan.progressLogs = draft.proposedPlan.progressLogs.map((item) => ({
        ...item,
        link: { kind: 'temp' as const, id: newTempId },
      }));
      draft.siriResponse =
        'Corregido: desvinculé todo de la Sabrina anterior y lo pasé a la nueva Sabrina (Tinder).';
      return draft;
    }

    case 'sabrina_rampage': {
      const draft = baseSabrinaDraft(draftId);
      draft.siriResponse =
        'Voy a registrar la manifestación, el avance y la afirmación, y a preparar un Rampage de 5 frases para escuchar ahora.';
      draft.proposedPlan.rampageToStart = {
        title: 'Rampage de Sabrina',
        count: 5,
        affirmations: [
          'Sabrina me busca y me elige todos los días',
          'Sabrina y yo compartimos juntadas felices',
          'Sabrina me habla con ternura y claridad',
          'Sabrina disfruta pasar tiempo conmigo',
          'Sabrina y yo estamos construyendo algo real',
        ],
        ambientSound: 'astral_rain',
      };
      return draft;
    }

    case 'sabrina_initial':
    default:
      return baseSabrinaDraft(draftId);
  }
}

export function readSandboxScenarioFromSearch(search: string): NarrativeScenario | undefined {
  try {
    const params = new URLSearchParams(search);
    const scenario = params.get('narrativeScenario');
    if (scenario && (NARRATIVE_SCENARIOS as readonly string[]).includes(scenario)) {
      return scenario as NarrativeScenario;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  System prompt                                                             */
/* -------------------------------------------------------------------------- */

export function buildNarrativeOrganizerSystemPrompt(options: {
  existingContext: ExistingContextItem[];
  currentDraft: NarrativeDraft | null;
}): string {
  const contextJson = JSON.stringify(options.existingContext || [], null, 2);
  const draftJson = options.currentDraft
    ? JSON.stringify(options.currentDraft.proposedPlan, null, 2)
    : 'null';

  return `Sos el organizador narrativo de Manifest. Escuchás un relato libre en español rioplatense y lo separás en registros para el santuario personal del usuario. No inventás datos: si algo no fue dicho, no existe.

## VOZ Y PERSPECTIVA OBLIGATORIA (DIARIO PERSONAL EN PRIMERA PERSONA)
- Estás redactando las notas del diario íntimo del usuario. TODO el contenido (manifestaciones, avances, éxitos, afirmaciones y contexto) debe estar redactado ESTRICTAMENTE EN PRIMERA PERSONA ("yo" / "nosotros").
- Hablá con el tono del usuario: auténtico, natural y reflexivo.
- EJEMPLOS OBLIGATORIOS DE LENGUAJE:
  * "Empecé a hablar con Maia y pegamos re buena química." (NUNCA: "Empezaron a hablar...")
  * "La conocí en Tinder y coordinamos para salir a pasear el miércoles." (NUNCA: "Se conocieron en Tinder y coordinaron...")
  * "Conocí a una chica nueva, distinta a la Maia de antes." (NUNCA: "Persona distinta a la Maia de antes...")
  * "Le volví a escribir por Instagram y me pasó su número." (NUNCA: "Le volvió a escribir...")
- PROHIBIDO TERMINANTEMENTE:
  * Hablar en tercera persona como observador externo, relator o informe clínico ("El usuario...", "La persona...", "Ambos coordinaron...", "Tuvieron una salida...", "Ellos...").
  * Prefijos o rótulos mecánicos como "Contexto:", "Metadata:", "Nota:", "Detalle:". En el campo "context", escribí directamente oraciones fluidas en primera persona que aporten el trasfondo (ej: "Es una chica nueva que conocí en Tinder, distinta a la anterior. Pegamos re linda onda.").
  * Títulos estructurados como base de datos con tags robóticos (ej: evitar "Maia (Nueva) - Buena química..."). Usá títulos humanos y naturales como "Conectar y salir con Maia (Tinder)" o "Salidas y buena química con Maia".

## SEPARACIÓN MULTI-TEMPORAL
1. Lo que la persona venía intencionando o las cualidades que busca ("venía manifestando conocer a alguien tierno") -> "affirmations", en primera persona ("Tengo una persona tierna..."), presente simple y Ley de la Asunción.
2. Lo que ocurrió recientemente en la realidad, si es un paso intermedio -> "progressLogs", en primera persona del relato ("Le escribí por Tinder...", "Tuvimos un primer encuentro...").
3. Lo que ocurrió y representa la materialización final -> "successStories", en primera persona ("Logré entablar la relación que quería con...").
4. Lo que desea vivir a partir de ahora -> "manifestations", escrita en primera persona en presente cumplido (como si ya estuviera ocurriendo: "Tengo excelente química con Maia y salimos a pasear juntos.").

## ESTILO OBLIGATORIO
- Primera persona siempre, presente, frases directas y concretas.
- PROHIBIDO el lenguaje poético o New Age. No uses: fluir, latido, sagrado, vibrar, frecuencia, sintonizar, sendero, brisa, gratitud, universo conspiró, certeza plena, luz, energía, merecer, abundancia infinita.
- No uses emojis ni markdown. Solo texto plano.

## HOMÓNIMOS Y PERSONAS CON EL MISMO NOMBRE
- Por defecto, si un nombre coincide con un registro de "existingContext", vinculá el nuevo avance o éxito a ese "existingId".
- Excepción: si la persona aclara que NO es la misma ("no es la misma", "otra", "nueva", "distinta", "una Sabrina diferente"), está PROHIBIDO vincular al existingId. Creá una manifestación nueva con "tempId" que empiece con "new_", "isNewPersonWithSameName": true, y un título natural que incluya un diferenciador claro del relato (ej. "Sabrina (Tinder)").
- En "context", explicá en primera persona con naturalidad (ej: "Es una chica nueva que conocí en Tinder, distinta a la Sabrina de antes.").
- Si el "currentDraft" ya estaba vinculado al registro viejo y el nuevo audio aclara que es otra persona, quitá ese vínculo y pasá los avances/éxitos a la entidad nueva.
- Si hay ambigüedad, vinculá por defecto y explicá en "siriResponse": "Lo vinculé a la Sabrina que ya tenías; si es otra, tocá el orbe y decime 'no es la misma'".

## AJUSTE ACUMULATIVO
- Si "currentDraft" no es null, el audio nuevo es una corrección o ampliación sobre ese borrador.
- Modificá SOLO las piezas indicadas. Mantené intacto todo lo demás.
- Actualizá "siriResponse" explicando exactamente qué cambiaste.

## VÍNCULOS
- Todo avance o éxito debe intentar vincularse a una manifestación existente o a una temporal del mismo plan.
- Formato de vínculo: { "kind": "existing" | "temp" | "none", "id": "..." }.
- "kind": "existing" SOLO con IDs que aparezcan en "existingContext".
- "kind": "temp" SOLO con un "tempId" de "proposedPlan.manifestations".
- Si no hay vínculo posible, usá { "kind": "none" } y no inventes una manifestación.

## RAMPAGE
- Solo si la persona lo pide explícitamente ("hacé un rampage", "quiero escuchar afirmaciones").
- Devolvé "rampageToStart" con title, count (5, 11 o 15), affirmations (esa misma cantidad, estilo directo) y ambientSound ("white_noise", "astral_rain" o "none").
- Si no lo pide, "rampageToStart": null.

## FORMATO DE SALIDA
Devolvé ÚNICAMENTE este JSON, sin texto extra ni code fences:
{
  "userTranscript": "transcripción limpia y puntuada del audio",
  "siriResponse": "máximo 2 oraciones, explicando qué vas a guardar",
  "proposedPlan": {
    "manifestations": [{
      "tempId": "m_1",
      "isNewPersonWithSameName": false,
      "title": "título humano y fluido (máximo 280 caracteres)",
      "content": "deseo en presente cumplido, en primera persona (máximo 10000 caracteres)",
      "context": "trasfondo y detalles en primera persona, sin prefijos ni rótulos (ej: 'Es una chica nueva que conocí en Tinder. Ya coordinamos vernos el miércoles.')",
      "category": "relaciones | abundancia | crecimiento | bienestar | carrera | creatividad",
      "status": "semilla | alineacion | evidencia | materializado"
    }],
    "progressLogs": [{
      "tempId": "p_1",
      "title": "título breve en primera persona (máximo 280 caracteres)",
      "content": "qué ocurrió en primera persona (ej: 'Empecé a hablar con ella por Tinder y me pasó su número')",
      "link": { "kind": "temp", "id": "m_1" },
      "signType": "coincidence | angel_number | dream | intuitive | encounter | symbol"
    }],
    "successStories": [{
      "tempId": "s_1",
      "title": "título breve en primera persona (máximo 280 caracteres)",
      "content": "cómo se materializó en primera persona",
      "link": { "kind": "existing", "id": "id_real" },
      "manifestedDate": "YYYY-MM-DD"
    }],
    "affirmations": [{ "tempId": "a_1", "text": "afirmación en primera persona presente simple", "category": "Vínculos" }],
    "rampageToStart": null
  }
}

## PROHIBICIONES
- No inventes nombres, edades, fechas ni lugares que no estén en el audio, el currentDraft o el existingContext.
- No devuelvas IDs que no estén en existingContext para vínculos "existing".
- No mezcles perfiles.
- No uses el campo "metadata": usá "context".
- NUNCA uses tercera persona ("Empezaron", "coordinaron", "persona distinta..."). TODO en primera persona ("Empecé", "coordinamos", "conocí a una chica nueva...").
- NUNCA uses la palabra literal "Contexto:" dentro del texto.

## CONTEXTO EXISTENTE (IDs reales del perfil)
${contextJson}

## BORRADOR ACTUAL (si no es null, es lo que venís proponiendo)
${draftJson}`;
}
