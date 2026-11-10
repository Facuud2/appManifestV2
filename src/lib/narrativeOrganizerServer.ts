import { GoogleGenAI } from '@google/genai';
import {
  getDailyAiUsage,
  getGeminiApiKey,
  incrementDailyAiUsage,
} from './gemini';
import {
  buildNarrativeOrganizerSystemPrompt,
  normalizeNarrativeDraft,
  type ExistingContextItem,
  type NarrativeDraft,
  type NarrativeProfileId,
} from './narrativeOrganizer';

const NARRATIVE_TIMEOUT_MS = 45_000;
const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';

export interface NarrativeAnalysisResult {
  draft: NarrativeDraft;
  source: 'GEMINI_LIVE' | 'SANDBOX_MOCK';
  quotaUsedToday: number;
  warnings: string[];
}

function cleanMimeType(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!base) return 'audio/webm';
  if (base === 'audio/m4a' || base === 'audio/x-m4a' || base === 'video/mp4') {
    return 'audio/mp4';
  }
  return base;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('NARRATIVE_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function generateJson(options: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  mimeType: string;
  audioBase64: string;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const response = await withTimeout(
    ai.models.generateContent({
      model: options.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: options.mimeType,
                data: options.audioBase64,
              },
            },
            { text: options.prompt },
          ],
        },
      ],
      config: {
        systemInstruction: options.systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    }),
    NARRATIVE_TIMEOUT_MS
  );
  return response.text || '';
}

export async function analyzeNarrativeWithGemini(options: {
  audioBuffer: Buffer;
  mimeType: string;
  profileId: NarrativeProfileId;
  draftId: string;
  currentDraft: NarrativeDraft | null;
  existingContext: ExistingContextItem[];
}): Promise<NarrativeAnalysisResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const systemInstruction = buildNarrativeOrganizerSystemPrompt({
    existingContext: options.existingContext,
    currentDraft: options.currentDraft,
  });

  const prompt = `Perfil activo: ${options.profileId}.
Escuchá el audio adjunto y devolvé el JSON del organizador narrativo.${options.currentDraft ? '\nEl audio es una corrección o ampliación del borrador actual.' : ''}`;

  const mimeType = cleanMimeType(options.mimeType);
  const audioBase64 = options.audioBuffer.toString('base64');

  const run = async (model: string) =>
    generateJson({
      apiKey,
      model,
      systemInstruction,
      prompt,
      mimeType,
      audioBase64,
    });

  let rawText = '';
  let lastError: unknown = null;

  try {
    rawText = await run(PRIMARY_MODEL);
  } catch (primaryError) {
    lastError = primaryError;
    console.warn('[NarrativeOrganizer] Primary model failed, trying fallback:', primaryError);
    rawText = await run(FALLBACK_MODEL);
  }

  // The request was consumed even if the JSON is unusable.
  const quotaUsedToday = await incrementDailyAiUsage(1);

  try {
    const { draft, warnings } = normalizeNarrativeDraft(rawText, {
      draftId: options.draftId,
      existingContext: options.existingContext,
      allowLegacy: true,
    });
    return { draft, source: 'GEMINI_LIVE', quotaUsedToday, warnings };
  } catch (parseError) {
    console.error('[NarrativeOrganizer] Could not parse model JSON:', parseError);
    throw Object.assign(new Error('NARRATIVE_INVALID_JSON'), {
      quotaUsedToday,
      cause: lastError,
    });
  }
}

export async function getNarrativeQuotaState(): Promise<number> {
  return getDailyAiUsage();
}
