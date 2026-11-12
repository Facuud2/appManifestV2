import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDailyAiUsage, TIER_1_DAILY_LIMIT } from '@/lib/gemini';
import {
  buildSandboxNarrativeDraft,
  isNarrativeProfileId,
  NARRATIVE_LIMITS,
  normalizeNarrativeDraft,
  readSandboxScenarioFromSearch,
  resolveNarrativeProfileId,
  type ExistingContextItem,
  type ExistingAffirmationItem,
  type ExistingRampageItem,
  type ExistingSuccessStoryItem,
  type NarrativeDraft,
  type NarrativeScenario,
} from '@/lib/narrativeOrganizer';
import { analyzeNarrativeWithGemini, enrichDraftWithMusic } from '@/lib/narrativeOrganizerServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MIN_AUDIO_BYTES = 200;

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null') return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

function sanitizeExistingAffirmations(value: unknown): ExistingAffirmationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 50)
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      if (!id || !text) return [];
      const category = typeof record.category === 'string' ? record.category.slice(0, 100) : undefined;
      const repeatCount = typeof record.repeatCount === 'number' ? record.repeatCount : 0;
      return [{ id, text: text.slice(0, 1000), category, repeatCount }];
    });
}

function sanitizeExistingRampages(value: unknown): ExistingRampageItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!id || !title) return [];
    const category = typeof record.category === 'string' ? record.category.slice(0, 100) : undefined;
    const affirmations = Array.isArray(record.affirmations)
      ? record.affirmations
          .filter((a): a is string => typeof a === 'string')
          .slice(0, 50)
      : [];
    const ambientSound = typeof record.ambientSound === 'string' ? record.ambientSound : undefined;
    return [{ id, title: title.slice(0, 200), category, affirmations, ambientSound }];
  });
}

function sanitizeExistingSuccessStories(value: unknown): ExistingSuccessStoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!id || !title) return [];
    const story = typeof record.story === 'string' ? record.story.slice(0, 1000) : '';
    const manifestedDate = typeof record.manifestedDate === 'string' ? record.manifestedDate : undefined;
    const manifestationId = typeof record.manifestationId === 'string' ? record.manifestationId : null;
    return [{ id, title: title.slice(0, 280), story, manifestedDate, manifestationId }];
  });
}

function sanitizeExistingContext(value: unknown): ExistingContextItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, NARRATIVE_LIMITS.existingContext)
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      if (!id || !title) return [];
      const personNames = Array.isArray(record.personNames)
        ? record.personNames
            .filter((name): name is string => typeof name === 'string')
            .slice(0, 8)
        : [];
      const summary =
        typeof record.summary === 'string'
          ? record.summary.slice(0, 300)
          : '';
      return [{ id, title: title.slice(0, 280), personNames, summary }];
    });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let audioBuffer = Buffer.alloc(0);
    let mimeType = 'audio/webm';
    let profileIdRaw: unknown = 'facu';
    let draftId = '';
    let currentDraftRaw: unknown = null;
    let existingContextRaw: unknown = [];
    let existingAffirmationsRaw: unknown = [];
    let existingRampagesRaw: unknown = [];
    let existingSuccessStoriesRaw: unknown = [];
    let sandbox = false;
    let spokenText = '';
    let scenario: NarrativeScenario | undefined;

    if (contentType.includes('application/json')) {
      const json = await req.json();
      profileIdRaw = json.profileId ?? json.currentProfile;
      draftId = typeof json.draftId === 'string' ? json.draftId : '';
      currentDraftRaw = json.currentDraft ?? null;
      existingContextRaw = json.existingContext ?? [];
      existingAffirmationsRaw = json.existingAffirmations ?? [];
      existingRampagesRaw = json.existingRampages ?? [];
      existingSuccessStoriesRaw = json.existingSuccessStories ?? [];
      sandbox = Boolean(json.sandbox);
      spokenText = typeof json.spokenText === 'string' ? json.spokenText : '';
      scenario = typeof json.scenario === 'string' ? (json.scenario as NarrativeScenario) : undefined;
      mimeType = typeof json.mimeType === 'string' ? json.mimeType : mimeType;
      if (typeof json.audioBase64 === 'string' && json.audioBase64) {
        audioBuffer = Buffer.from(json.audioBase64, 'base64');
      }
    } else {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      if (file) {
        audioBuffer = Buffer.from(await file.arrayBuffer());
        mimeType = file.type || mimeType;
      }
      profileIdRaw = formData.get('profileId') ?? formData.get('currentProfile') ?? 'facu';
      draftId = (formData.get('draftId') as string) || '';
      currentDraftRaw = parseJsonField(formData.get('currentDraft'), null);
      existingContextRaw = parseJsonField(formData.get('existingContext'), []);
      existingAffirmationsRaw = parseJsonField(formData.get('existingAffirmations'), []);
      existingRampagesRaw = parseJsonField(formData.get('existingRampages'), []);
      existingSuccessStoriesRaw = parseJsonField(formData.get('existingSuccessStories'), []);
      sandbox = formData.get('sandbox') === 'true';
      spokenText = (formData.get('spokenText') as string) || '';
      const rawScenario = formData.get('scenario');
      if (typeof rawScenario === 'string' && rawScenario) {
        scenario = rawScenario as NarrativeScenario;
      }
    }

    if (profileIdRaw && !isNarrativeProfileId(profileIdRaw) && profileIdRaw !== 'juntos') {
      return NextResponse.json(
        { success: false, error: 'profileId inválido. Usá facu, maia o shared.' },
        { status: 400 }
      );
    }

    const profileId = resolveNarrativeProfileId(profileIdRaw);
    if (!draftId) draftId = randomUUID();

    const existingContext = sanitizeExistingContext(existingContextRaw);
    const existingAffirmations = sanitizeExistingAffirmations(existingAffirmationsRaw);
    const existingRampages = sanitizeExistingRampages(existingRampagesRaw);
    const existingSuccessStories = sanitizeExistingSuccessStories(existingSuccessStoriesRaw);

    const currentDraftNormalized: NarrativeDraft | null = currentDraftRaw
      ? normalizeNarrativeDraft(currentDraftRaw, {
          draftId,
          existingContext,
          existingAffirmations,
          existingRampages,
          existingSuccessStories,
          allowLegacy: true,
        }).draft
      : null;

    const isSandbox = sandbox || process.env.AI_SANDBOX === 'true';
    const queryScenario = readSandboxScenarioFromSearch(req.nextUrl.search);
    const effectiveScenario = scenario || queryScenario;

    if (isSandbox) {
      const draft = buildSandboxNarrativeDraft({
        scenario: effectiveScenario,
        spokenText,
        currentDraft: currentDraftNormalized,
        existingContext,
        existingAffirmations,
        existingRampages,
        existingSuccessStories,
        draftId,
      });
      await enrichDraftWithMusic(draft);
      return NextResponse.json({
        success: true,
        data: draft,
        quotaUsedToday: await getDailyAiUsage(),
        source: 'SANDBOX_MOCK',
        warnings: [],
      });
    }

    const dailyUsage = await getDailyAiUsage();
    if (dailyUsage >= TIER_1_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Has alcanzado el límite diario de solicitudes IA (${TIER_1_DAILY_LIMIT} RPD). El límite se renueva a la medianoche UTC.`,
          quotaUsedToday: dailyUsage,
        },
        { status: 429 }
      );
    }

    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'La grabación supera el máximo de 10 MB.' },
        { status: 413 }
      );
    }

    if (audioBuffer.length < MIN_AUDIO_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se recibió una grabación de audio válida.',
          code: 'NARRATIVE_EMPTY_AUDIO',
        },
        { status: 400 }
      );
    }

    try {
      const analysis = await analyzeNarrativeWithGemini({
        audioBuffer,
        mimeType,
        profileId,
        draftId,
        currentDraft: currentDraftNormalized,
        existingContext,
        existingAffirmations,
        existingRampages,
        existingSuccessStories,
      });

      return NextResponse.json({
        success: true,
        data: analysis.draft,
        quotaUsedToday: analysis.quotaUsedToday,
        source: analysis.source,
        warnings: analysis.warnings,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('[API /api/ai/narrative-organizer] Gemini error:', message);

      if (message === 'NARRATIVE_TIMEOUT') {
        return NextResponse.json(
          { success: false, error: 'La IA tardó demasiado en responder. Probá de nuevo.' },
          { status: 504 }
        );
      }
      if (message === 'GEMINI_API_KEY_MISSING') {
        return NextResponse.json(
          { success: false, error: 'El servicio de IA no tiene clave configurada.' },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'No se pudo organizar el relato. Probá de nuevo.' },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error processing narrative organizer';
    console.error('[API /api/ai/narrative-organizer] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
