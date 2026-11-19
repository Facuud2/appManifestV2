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
const NARRATIVE_VIDEO_TIMEOUT_MS = 90_000;
const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.8-flash';
const TERTIARY_MODEL = 'gemini-3.5-flash-lite';
const INLINE_VIDEO_MAX_BYTES = 4 * 1024 * 1024;

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

function cleanMediaMimeType(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!base) return 'video/mp4';
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

export interface NarrativeUploadedMediaInput {
  name: string;
  uri: string;
  mimeType: string;
}

async function waitForGeminiFileActive(
  ai: GoogleGenAI,
  fileName: string,
  fallbackUri: string,
  fallbackMime: string,
): Promise<{ name: string; uri: string; mimeType: string }> {
  const normalizedName = fileName.startsWith('files/') ? fileName : `files/${fileName}`;
  const deadline = Date.now() + 45_000;
  let currentUri = fallbackUri;
  let currentMime = cleanMediaMimeType(fallbackMime);

  while (Date.now() < deadline) {
    const info = await ai.files.get({ name: normalizedName });
    if (info.uri) currentUri = info.uri;
    if (info.mimeType) currentMime = cleanMediaMimeType(info.mimeType);

    const state = String(info.state || '').toUpperCase();
    if (!state || state === 'ACTIVE') {
      return { name: normalizedName, uri: currentUri, mimeType: currentMime };
    }
    if (state === 'FAILED') {
      throw new Error('GEMINI_FILE_PROCESSING_FAILED');
    }
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  }

  return { name: normalizedName, uri: currentUri, mimeType: currentMime };
}

async function uploadBufferToGeminiFiles(
  apiKey: string,
  ai: GoogleGenAI,
  media: NarrativeMediaInput,
): Promise<{ name: string; uri: string; mimeType: string }> {
  const cleanMime = cleanMediaMimeType(media.mimeType);
  const startRes = await fetch(
    'https://generativelanguage.googleapis.com/upload/v1beta/files',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(media.buffer.length),
        'X-Goog-Upload-Header-Content-Type': cleanMime,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: media.name || 'narrative_video.mp4' },
      }),
    },
  );

  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!startRes.ok || !uploadUrl) {
    throw new Error('GEMINI_FILE_UPLOAD_START_FAILED');
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(media.buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: new Uint8Array(media.buffer),
  });

  if (!uploadRes.ok) {
    throw new Error('GEMINI_FILE_UPLOAD_FINALIZE_FAILED');
  }

  const json = (await uploadRes.json()) as {
    file?: { name?: string; uri?: string; mimeType?: string; state?: string };
  };
  const fileObj = json?.file;
  if (!fileObj?.name || !fileObj?.uri) {
    throw new Error('GEMINI_FILE_UPLOAD_INVALID_RESPONSE');
  }

  return waitForGeminiFileActive(ai, fileObj.name, fileObj.uri, fileObj.mimeType || cleanMime);
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
  timeoutMs?: number;
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
    options.timeoutMs ?? NARRATIVE_TIMEOUT_MS
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
  uploadedMedia?: NarrativeUploadedMediaInput[];
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

  const ai = new GoogleGenAI({ apiKey });

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
  const uploadedMedia = options.uploadedMedia || [];
  const totalMediaCount = mediaFiles.length + uploadedMedia.length;
  const hasVideo =
    mediaFiles.some((m) => m.mimeType.startsWith('video/')) ||
    uploadedMedia.some((m) => m.mimeType.startsWith('video/'));

  const promptParts: string[] = [`Perfil activo: ${options.profileId}.`];
  if (hasAudio) {
    promptParts.push('Escuchá el audio adjunto y devolvé el JSON del organizador narrativo.');
  }
  if (cleanText) {
    promptParts.push(`Mensaje escrito del usuario:\n${cleanText}`);
  }
  if (totalMediaCount > 0) {
    promptParts.push(
      `El usuario adjuntó ${totalMediaCount} archivo(s) multimedia (imagen o video). Analizá con detalle su contenido visual y/o sonoro para comprender el contexto y organizar lo solicitado.`
    );
  }
  if (urls.length > 0 && totalMediaCount === 0) {
    promptParts.push(
      `El mensaje incluye link(s): ${urls.join(', ')}. Accedé al contenido con urlContext; si no podés acceder o está restringido, pedile al usuario una imagen o video de ese link en siriResponse sin inventar contenido.`
    );
  } else if (urls.length > 0 && totalMediaCount > 0) {
    promptParts.push(
      `El mensaje incluye link(s) (${urls.join(', ')}), pero el usuario YA adjuntó la imagen o video correspondiente. Usá directamente el contenido de los archivos multimedia adjuntos para crear o actualizar lo solicitado.`
    );
  }
  if (options.currentDraft) {
    promptParts.push('Este mensaje es una respuesta, corrección o ampliación sobre el borrador actual.');
  }
  if (!hasAudio) {
    promptParts.push('Devolvé ÚNICAMENTE el JSON del organizador narrativo.');
  }

  const parts: Array<Record<string, unknown>> = [];
  const temporaryGeminiFileNames: string[] = [];

  if (hasAudio && options.audioBuffer) {
    parts.push({
      inlineData: {
        mimeType: cleanMimeType(options.mimeType || 'audio/webm'),
        data: options.audioBuffer.toString('base64'),
      },
    });
  }

  for (const uploaded of uploadedMedia) {
    const active = await waitForGeminiFileActive(
      ai,
      uploaded.name,
      uploaded.uri,
      uploaded.mimeType,
    );
    temporaryGeminiFileNames.push(active.name);
    parts.push({
      fileData: {
        fileUri: active.uri,
        mimeType: active.mimeType,
      },
    });
  }

  for (const media of mediaFiles) {
    const cleanMime = cleanMediaMimeType(media.mimeType);
    if (cleanMime.startsWith('video/') && media.buffer.length > INLINE_VIDEO_MAX_BYTES) {
      try {
        const uploaded = await uploadBufferToGeminiFiles(apiKey, ai, {
          ...media,
          mimeType: cleanMime,
        });
        temporaryGeminiFileNames.push(uploaded.name);
        parts.push({
          fileData: {
            fileUri: uploaded.uri,
            mimeType: uploaded.mimeType,
          },
        });
        continue;
      } catch (uploadError) {
        console.warn('[NarrativeOrganizer] Server Files API upload failed, falling back to inlineData:', uploadError);
      }
    }
    parts.push({
      inlineData: {
        mimeType: cleanMime,
        data: media.buffer.toString('base64'),
      },
    });
  }

  const prompt = promptParts.join('\n');
  const timeoutMs = hasVideo ? NARRATIVE_VIDEO_TIMEOUT_MS : NARRATIVE_TIMEOUT_MS;
  const enableUrlContext = urls.length > 0 && totalMediaCount === 0;

  const run = async (model: string) =>
    generateJson({
      apiKey,
      model,
      systemInstruction,
      prompt,
      parts,
      enableUrlContext,
      timeoutMs,
    });

  let rawText = '';
  let lastError: unknown = null;

  try {
    try {
      rawText = await run(PRIMARY_MODEL);
    } catch (primaryError) {
      lastError = primaryError;
      console.warn('[NarrativeOrganizer] Primary model failed, trying fallback:', primaryError);
      try {
        rawText = await run(FALLBACK_MODEL);
      } catch (fallbackError) {
        lastError = fallbackError;
        console.warn('[NarrativeOrganizer] Fallback model failed, trying tertiary:', fallbackError);
        rawText = await run(TERTIARY_MODEL);
      }
    }
  } finally {
    if (temporaryGeminiFileNames.length > 0) {
      for (const name of temporaryGeminiFileNames) {
        void ai.files.delete({ name }).catch(() => {
          // Best-effort cleanup of temporary Gemini Files API entry
        });
      }
    }
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
