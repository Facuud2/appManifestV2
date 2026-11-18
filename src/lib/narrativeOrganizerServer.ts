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
  type ExistingAffirmationItem,
  type ExistingRampageItem,
  type ExistingSuccessStoryItem,
  type NarrativeDraft,
  type NarrativeProfileId,
} from './narrativeOrganizer';
import { searchMusicTracks, resolveSpotifyTrackUrl } from './musicProviders';
import { URL_REGEX } from '@/utils/urlParser';
import type { SongAttachment } from '@/types';

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

export interface NarrativeMediaInput {
  buffer: Buffer;
  mimeType: string;
  name?: string;
}

function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  return Array.from(new Set(matches));
}

async function generateJson(options: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  parts: Array<Record<string, unknown>>;
  enableUrlContext?: boolean;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const config: Record<string, unknown> = {
    systemInstruction: options.systemInstruction,
    temperature: 0.2,
    maxOutputTokens: 8192,
  };

  if (options.enableUrlContext) {
    config.tools = [{ urlContext: {} }];
  } else {
    config.responseMimeType = 'application/json';
  }

  const response = await withTimeout(
    ai.models.generateContent({
      model: options.model,
      contents: [
        {
          role: 'user',
          parts: [...options.parts, { text: options.prompt }],
        },
      ],
      config,
    }),
    NARRATIVE_TIMEOUT_MS
  );
  return response.text || '';
}

export async function enrichDraftWithMusic(draft: NarrativeDraft): Promise<NarrativeDraft> {
  const plan = draft.proposedPlan;
  const itemsWithQuery: Array<{ songQuery: string; attach: (song: SongAttachment) => void }> = [];

  for (const item of plan.manifestations) {
    if (item.songQuery && !item.songAttachment) {
      itemsWithQuery.push({
        songQuery: item.songQuery,
        attach: (song) => { item.songAttachment = song; },
      });
    }
  }

  for (const item of plan.progressLogs) {
    if (item.songQuery && !item.songAttachment) {
      itemsWithQuery.push({
        songQuery: item.songQuery,
        attach: (song) => { item.songAttachment = song; },
      });
    }
  }

  for (const item of plan.affirmations) {
    if (item.songQuery && !item.songAttachment) {
      itemsWithQuery.push({
        songQuery: item.songQuery,
        attach: (song) => { item.songAttachment = song; },
      });
    }
  }

  if (itemsWithQuery.length === 0) return draft;

  await Promise.all(
    itemsWithQuery.map(async ({ songQuery, attach }) => {
      try {
        if (songQuery.includes('open.spotify.com') || songQuery.startsWith('spotify:track:')) {
          const res = await resolveSpotifyTrackUrl(songQuery);
          if (res?.tracks[0]) {
            const t = res.tracks[0];
            attach({
              id: t.id,
              title: t.title,
              artist: t.artist,
              albumCoverUrl: t.albumCoverUrl,
              spotifyUrl: t.spotifyUrl,
              previewAudioUrl: t.previewAudioUrl,
              provider: t.provider,
              providerTrackId: t.providerTrackId,
            });
            return;
          }
        }

        const res = await searchMusicTracks(songQuery);
        if (res?.tracks && res.tracks.length > 0) {
          const t = res.tracks[0];
          attach({
            id: t.id,
            title: t.title,
            artist: t.artist,
            albumCoverUrl: t.albumCoverUrl,
            spotifyUrl: t.spotifyUrl,
            previewAudioUrl: t.previewAudioUrl,
            provider: t.provider,
            providerTrackId: t.providerTrackId,
          });
        }
      } catch (err) {
        console.error('[enrichDraftWithMusic] Error resolving song query:', songQuery, err);
      }
    })
  );

  return draft;
}

export async function analyzeNarrativeWithGemini(options: {
  audioBuffer?: Buffer;
  mimeType?: string;
  userText?: string;
  mediaFiles?: NarrativeMediaInput[];
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  profileId: NarrativeProfileId;
  draftId: string;
  currentDraft: NarrativeDraft | null;
  existingContext: ExistingContextItem[];
  existingAffirmations?: ExistingAffirmationItem[];
  existingRampages?: ExistingRampageItem[];
  existingSuccessStories?: ExistingSuccessStoryItem[];
}): Promise<NarrativeAnalysisResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const systemInstruction = buildNarrativeOrganizerSystemPrompt({
    existingContext: options.existingContext,
    existingAffirmations: options.existingAffirmations,
    existingRampages: options.existingRampages,
    existingSuccessStories: options.existingSuccessStories,
    currentDraft: options.currentDraft,
    conversationHistory: options.conversationHistory,
  });

  const cleanText = (options.userText || '').trim();
  const urls = extractUrls(cleanText);
  const hasAudio = Boolean(options.audioBuffer && options.audioBuffer.length >= 200);
  const mediaFiles = options.mediaFiles || [];

  const promptParts: string[] = [`Perfil activo: ${options.profileId}.`];
  if (hasAudio) {
    promptParts.push('Escuchá el audio adjunto y devolvé el JSON del organizador narrativo.');
  }
  if (cleanText) {
    promptParts.push(`Mensaje escrito del usuario:\n${cleanText}`);
  }
  if (mediaFiles.length > 0) {
    promptParts.push(
      `El usuario adjuntó ${mediaFiles.length} archivo(s) multimedia (imagen o video). Analizá su contenido visual y/o sonoro.`
    );
  }
  if (urls.length > 0) {
    promptParts.push(
      `El mensaje incluye link(s): ${urls.join(', ')}. Accedé al contenido con urlContext; si no podés acceder o está restringido, pedile al usuario una imagen o video de ese link en siriResponse sin inventar contenido.`
    );
  }
  if (options.currentDraft) {
    promptParts.push('Este mensaje es una respuesta, corrección o ampliación sobre el borrador actual.');
  }
  if (!hasAudio) {
    promptParts.push('Devolvé ÚNICAMENTE el JSON del organizador narrativo.');
  }

  const parts: Array<Record<string, unknown>> = [];
  if (hasAudio && options.audioBuffer) {
    parts.push({
      inlineData: {
        mimeType: cleanMimeType(options.mimeType || 'audio/webm'),
        data: options.audioBuffer.toString('base64'),
      },
    });
  }
  for (const media of mediaFiles) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType,
        data: media.buffer.toString('base64'),
      },
    });
  }

  const prompt = promptParts.join('\n');

  const run = async (model: string) =>
    generateJson({
      apiKey,
      model,
      systemInstruction,
      prompt,
      parts,
      enableUrlContext: urls.length > 0,
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
      existingAffirmations: options.existingAffirmations,
      existingRampages: options.existingRampages,
      existingSuccessStories: options.existingSuccessStories,
      allowLegacy: true,
    });
    if (
      !draft.proposedPlan.rampageToStart &&
      /\b(modifiqu[eé]|actualic[eé]|agregu[eé]|sum[eé]|cambi[eé]|reemplac[eé]|prepar[eé])\b.*\brampage\b/i.test(
        draft.siriResponse
      )
    ) {
      warnings.push(
        'La IA mencionó una modificación de rampage pero no devolvió proposedPlan.rampageToStart.'
      );
      draft.siriResponse =
        'No pude generar la actualización del rampage en este borrador. Probá pedirmelo de nuevo indicando el nombre exacto del rampage y qué cambios querés hacer.';
    }
    await enrichDraftWithMusic(draft);
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
