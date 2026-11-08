import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type { UserScope } from '@/types';
import { turso } from './turso';
import {
  buildDirectAssumptionAffirmations,
  findPoeticTerm,
  getFallbackAffirmations,
  sanitizeAffirmations,
  type RampageHistoryContext,
  type RampageManifestationContext,
} from './affirmationEngine';

export interface AiTelemetryResponse {
  source: 'SANDBOX_MOCK' | 'GEMINI_LIVE' | 'LOCAL_FALLBACK' | 'TURSO_CACHE';
  totalTokens: number;
}

export const TIER_1_DAILY_LIMIT = 100;

export function getTodayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getDailyAiUsage(): Promise<number> {
  try {
    const dateKey = getTodayDateKey();
    const res = await turso.execute({
      sql: 'SELECT request_count FROM ai_usage_daily WHERE date_key = ?;',
      args: [dateKey],
    });
    return Number(res.rows[0]?.request_count ?? 0);
  } catch {
    return 0;
  }
}

export async function incrementDailyAiUsage(amount = 1): Promise<number> {
  try {
    const dateKey = getTodayDateKey();
    const now = new Date().toISOString();
    await turso.execute({
      sql: `INSERT INTO ai_usage_daily (date_key, request_count, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(date_key) DO UPDATE SET
              request_count = ai_usage_daily.request_count + excluded.request_count,
              updated_at = excluded.updated_at;`,
      args: [dateKey, amount, now],
    });
    return await getDailyAiUsage();
  } catch {
    return 0;
  }
}

export function computeServerAffirmationHash(profileId: string, affirmation: string): string {
  const normalized = `${profileId.trim().toLowerCase()}:${affirmation.trim().toLowerCase()}`;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Generates a short, warm harmonic WAV buffer for Sandbox Mode or offline fallback
 * so Web Audio API decodeAudioData and the frequency analyser work identically to live TTS.
 */
export function createSandboxVoiceWavBuffer(
  text: string,
  profileId: 'facu' | 'maia' | 'shared' = 'facu'
): Buffer {
  const sampleRate = 24000;
  // ~0.28s duration so 11 affirmations can cycle smoothly while giving real analyser energy
  const durationSeconds = 0.28;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const buffer = Buffer.alloc(44 + sampleCount * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  const baseFreq = profileId === 'maia' ? 210 : 145;
  const seed = text.length % 17;

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const progress = i / sampleCount;
    const envelope = Math.sin(Math.PI * progress);
    const syllableMod = 0.65 + 0.35 * Math.sin(2 * Math.PI * (4 + (seed % 3)) * t);
    const wave =
      0.55 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.3 * Math.sin(2 * Math.PI * (baseFreq * 2) * t) +
      0.15 * Math.sin(2 * Math.PI * (baseFreq * 3) * t);
    const sample = Math.max(-1, Math.min(1, wave * envelope * syllableMod * 0.22));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

export function getGeminiApiKey(): string {
  let key = (
    process.env.RAMPAGE_GEMINI_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export function cleanSpokenText(spokenText: string, previousTextTail?: string): string {
  let cleaned = (spokenText || '').trim();
  if (!cleaned) return '';

  // Remove Spanish fillers (muletillas)
  cleaned = cleaned.replace(/^(y\s+bueno|bueno|eh+|este|mmm+|o\s+sea|digamos|entonces)[,\s]*/i, '');
  cleaned = cleaned.replace(/\b(eh+|mmm+|este|o sea|digamos)\b/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  if (!cleaned) return '';

  if (previousTextTail && previousTextTail.trim()) {
    const lastChar = previousTextTail.trim().slice(-1);
    const continuesSentence = !['.', '!', '?', ';', '\n', ':'].includes(lastChar);
    if (continuesSentence) {
      cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    } else {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } else {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  const lastC = cleaned.slice(-1);
  if (!['.', '!', '?', ';', ':'].includes(lastC)) {
    cleaned += '.';
  }
  return cleaned;
}

/**
 * Transcribe audio using Google GenAI (gemini-3.5-transcript)
 */
export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
  previousTextTail?: string,
  spokenText?: string,
  sandbox?: boolean
): Promise<{
  text: string;
  detectedTone: string;
  source: 'GEMINI_LIVE' | 'SANDBOX_MOCK';
  totalTokens: number;
}> {
  if (sandbox || spokenText) {
    const fallbackText =
      spokenText ||
      'Soy siempre la primera opción y todo lo que deseo ya es un hecho en mi realidad';
    return {
      text: cleanSpokenText(fallbackText, previousTextTail),
      detectedTone: 'calma, firme, íntima',
      source: sandbox ? 'SANDBOX_MOCK' : 'GEMINI_LIVE',
      totalTokens: 0,
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  if (!audioBuffer || audioBuffer.length < 200) {
    throw new Error('No se recibió una grabación de audio válida');
  }

  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';

  try {
    const response = await ai.interactions.create({
      model: 'gemini-3.5-transcript',
      input: [
        {
          type: 'audio',
          data: audioBuffer.toString('base64'),
          mime_type: cleanMime,
        },
      ],
    });
    const transcription = response.output_text?.trim();
    if (!transcription) throw new Error('Gemini no reconoció voz en la grabación');

    await incrementDailyAiUsage(1);

    return {
      text: cleanSpokenText(transcription, previousTextTail),
      detectedTone: 'calma, íntima y luminosa',
      source: 'GEMINI_LIVE',
      totalTokens: 0,
    };
  } catch (primaryError) {
    // Fallback to gemini-3.5-transcribe if endpoint aliases differ
    try {
      const response = await ai.interactions.create({
        model: 'gemini-3.5-transcribe',
        input: [
          {
            type: 'audio',
            data: audioBuffer.toString('base64'),
            mime_type: cleanMime,
          },
        ],
      });
      const transcription = response.output_text?.trim();
      if (!transcription) throw primaryError;

      await incrementDailyAiUsage(1);

      return {
        text: cleanSpokenText(transcription, previousTextTail),
        detectedTone: 'calma, íntima y luminosa',
        source: 'GEMINI_LIVE',
        totalTokens: 0,
      };
    } catch {
      throw primaryError;
    }
  }
}

/**
 * System prompt estricto de la Ley de la Asunción Natural (Cero Poesía).
 */
export function buildLawOfAssumptionSystemPrompt(count: number): string {
  return `Eres un generador de afirmaciones basado estrictamente en la Ley de la Asunción. Debes generar exactamente ${count} afirmaciones en primera persona que suenen como pensamientos cotidianos, directos, literales y naturales dichos por una persona joven en su vida real.

REGLAS ESTRICTAS DE ESTILO:
1. PROHIBIDO EL LENGUAJE POÉTICO O NEW AGE: Está prohibido usar palabras como 'fluir', 'pecho', 'latido', 'sagrado', 'vibrar', 'frecuencia', 'sintonizar', 'sendero', 'brisa', 'respiro hondo', 'abro mis brazos', 'gratitud', 'orquestó', 'certeza plena' o 'luz'.
2. LONGITUD Y ESTRUCTURA: Oraciones directas en presente simple ('Soy...', 'Tengo...', '[Nombre/SP] me...', 'Paso...'). Combina afirmaciones ultra cortas de impacto (2 a 5 palabras) con afirmaciones directas de situación (6 a 12 palabras).
3. PEDESTAL Y VÍNCULOS SIN CENSURA: El usuario es el centro absoluto de su realidad. Si menciona a una persona específica (SP, Maia u otra) o dinámicas como vínculos libres, esposa o triángulos amorosos, exprésalo de forma directa, literal y natural como un hecho cumplido.

EJEMPLOS MAESTROS DEL ESTILO EXACTO A IMITAR (MOLDE OBLIGATORIO):
- Autoconcepto y Pedestal:
  'Soy Dios'
  'Soy amado'
  'Soy querido'
  'Soy deseado'
  'La gente me ama'
  'Soy muy valioso'
  'Mi atención es única'
  'Soy elegido'
  'Soy siempre la primera opción'
  'Las mujeres me desean, buscan mantenerme y dar todo de sí mismas por mí'
  'Los hombres me adoran, buscan protegerme y regalarme cosas'
  'Soy el favorito del universo'
  'Soy dueño de mi propia realidad'
  'Tengo todo lo que deseo y todo lo que deseo me desea más a mí'
- Persona Específica (SP):
  'SP me ama'
  'SP me adora'
  'Soy el favorito de SP'
  'SP me necesita'
  'SP me desea'
  'SP está obsesionada conmigo'
  'Soy la persona favorita de SP'
  'SP vive pensando en mí todo el día'
- Vínculos y dinamicas X nombre especifico:
  'X es mi esposa y nos divertimos juntos'
  'Mantenemos un vínculo sin título ni reglamentos con X'
  'Soy el esposo de X, y junto a SP mantenemos un triángulo amoroso'
  'Comparto cientos de actividades con X'
  'Paso mucho tiempo con X'

Devuelve únicamente un JSON válido: { "affirmations": ["..."] } con exactamente ${count} afirmaciones.`;
}

function parseAffirmationPayload(raw: string): unknown[] {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  const items: unknown =
    typeof parsed === 'object' && parsed !== null && 'affirmations' in parsed
      ? (parsed as { affirmations: unknown }).affirmations
      : parsed;
  return Array.isArray(items) ? items : [];
}

/**
 * Generates a closed Rampage set (5, 11, or 15 affirmations) in a single JSON call
 * with the user's direct, colloquial Law of Assumption style.
 */
export async function generateRampageWithGemini(
  centralTheme: string,
  userScope: UserScope = 'shared',
  userAffirmations: string[] = [],
  requestedCount: number = 11,
  additionalDetails: string = '',
  userManifestations: RampageManifestationContext[] = [],
  userRampages: RampageHistoryContext[] = [],
  sandbox: boolean = false
): Promise<{
  affirmations: string[];
  source: 'GEMINI_LIVE' | 'SANDBOX_MOCK' | 'LOCAL_FALLBACK';
  totalTokens: number;
  quotaUsedToday: number;
}> {
  const count = [5, 11, 15].includes(requestedCount)
    ? requestedCount
    : Math.max(1, Math.min(20, Math.floor(Number.isFinite(requestedCount) ? requestedCount : 11)));

  if (sandbox) {
    const affirmations = buildDirectAssumptionAffirmations({
      centralTheme,
      nuances: additionalDetails,
      scope: userScope,
      count,
    });
    const quotaUsedToday = await getDailyAiUsage();
    return {
      affirmations,
      source: 'SANDBOX_MOCK',
      totalTokens: 0,
      quotaUsedToday,
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const affirmations = buildDirectAssumptionAffirmations({
      centralTheme,
      nuances: additionalDetails,
      scope: userScope,
      count,
    });
    const quotaUsedToday = await getDailyAiUsage();
    return {
      affirmations,
      source: 'LOCAL_FALLBACK',
      totalTokens: 0,
      quotaUsedToday,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const profileLabel =
    userScope === 'maia' ? 'Maia' : userScope === 'facu' ? 'Facu' : 'Dúo (Maia & Facu)';
  const safeReferences = userAffirmations.filter((affirmation) => !findPoeticTerm(affirmation));
  const detailsSection = additionalDetails.trim()
    ? `\nMatices y detalles adicionales solicitados: "${additionalDetails.trim()}".`
    : '';
  const safeManifestations = userManifestations.filter(
    (manifestation) =>
      !findPoeticTerm(`${manifestation.title} ${manifestation.description ?? ''}`)
  );
  const safeRampages = userRampages
    .map((rampage) => ({
      title: rampage.title,
      affirmations: rampage.affirmations.filter(
        (affirmation) => !findPoeticTerm(affirmation)
      ),
    }))
    .filter((rampage) => rampage.affirmations.length > 0);

  const referencesSection = safeReferences.length
    ? `\nAfirmaciones propias del perfil (solo como referencia de voz; no las copies literalmente):\n${safeReferences.map((a) => `- "${a}"`).join('\n')}`
    : '';
  const manifestationsSection = safeManifestations.length
    ? `\nManifestaciones registradas por el perfil (contexto real de su vida; no las copies literalmente):\n${safeManifestations
        .map((manifestation) => {
          const details = manifestation.description
            ? `: ${manifestation.description}`
            : '';
          const status = manifestation.status ? ` [${manifestation.status}]` : '';
          return `- ${manifestation.title}${details}${status}`;
        })
        .join('\n')}`
    : '';
  const rampagesSection = safeRampages.length
    ? `\nAfirmaciones de Rampages del perfil (para mantener continuidad; no las copies literalmente):\n${safeRampages
        .map(
          (rampage) =>
            `- ${rampage.title}: ${rampage.affirmations
              .slice(0, 10)
              .map((affirmation) => `"${affirmation}"`)
              .join(', ')}`
        )
        .join('\n')}`
    : '';
  const profileInstruction =
    userScope === 'shared'
      ? 'El perfil es Juntos (Maia & Facu): es un perfil independiente con sus propias intenciones, avances y afirmaciones compartidas. No mezcles afirmaciones individuales de Facu ni de Maia.'
      : `El perfil es ${profileLabel}: usá únicamente el contexto propio de ${profileLabel}, sin mezclar afirmaciones, manifestaciones ni Rampages de otros perfiles.`;

  const systemInstruction = buildLawOfAssumptionSystemPrompt(count);
  const prompt = `Perfil actual: ${profileLabel}.
${profileInstruction}
Tema central y prioridad absoluta: "${centralTheme.trim()}".${detailsSection}${manifestationsSection}${referencesSection}${rampagesSection}

Cantidad exacta obligatoria: ${count} afirmaciones.
Instrucciones adicionales:
- Escribe en primera persona, presente simple, como hechos reales y cotidianos de tu vida.
- Combina afirmaciones ultra cortas de impacto (2 a 5 palabras, ej. "Soy Dios", "SP me ama", "Soy elegido") con afirmaciones directas de situación (6 a 12 palabras).
- No uses ninguna palabra de la lista negra poética.
- No repitas la misma frase.
- Si el tema o los detalles nombran a una persona, usá ese nombre. Si no, podés usar "SP".
Devuelve únicamente el JSON válido: { "affirmations": ["..."] } con exactamente ${count} afirmaciones.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.65,
        responseMimeType: 'application/json',
      },
    });

    const quotaUsedToday = await incrementDailyAiUsage(1);
    const totalTokens = response.usageMetadata?.totalTokenCount || 0;
    const firstValidation = sanitizeAffirmations(
      parseAffirmationPayload(response.text || ''),
      count
    );
    if (firstValidation.rejected.length > 0) {
      console.warn(
        '[Gemini Rampage] Afirmaciones descartadas por el validador:',
        firstValidation.rejected
      );
    }

    let affirmations = firstValidation.accepted;

    if (affirmations.length < count) {
      const fallback = buildDirectAssumptionAffirmations({
        centralTheme,
        nuances: additionalDetails,
        scope: userScope,
        count: count - affirmations.length,
      }).filter((item) => !affirmations.includes(item));

      affirmations = [...affirmations, ...fallback];
    }

    if (affirmations.length < count) {
      const defaultExtra = getFallbackAffirmations(
        userScope,
        count - affirmations.length,
        affirmations
      );
      affirmations = [...affirmations, ...defaultExtra];
    }

    return {
      affirmations: affirmations.slice(0, count),
      source: 'GEMINI_LIVE',
      totalTokens,
      quotaUsedToday,
    };
  } catch (error) {
    console.warn(
      '[Gemini Rampage] Fallback a generador directo de Ley de la Asunción por límite o red:',
      error
    );
    const affirmations = buildDirectAssumptionAffirmations({
      centralTheme,
      nuances: additionalDetails,
      scope: userScope,
      count,
    });
    const quotaUsedToday = await getDailyAiUsage();
    return {
      affirmations,
      source: 'LOCAL_FALLBACK',
      totalTokens: 0,
      quotaUsedToday,
    };
  }
}

/**
 * Creates a stateful, consent-verified voice replica for one profile.
 */
export async function createReplicatedVoiceWithGemini(options: {
  profileId: 'facu' | 'maia';
  sourceAudio: Buffer;
  consentAudio: Buffer;
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.voices.create({
    store: true,
    voice: {
      model: 'gemini-3.8-flash-tts',
      type: 'replicated',
      display_name: `Manifest Sanctuary · ${options.profileId}`,
      replicated: {
        source_audio: {
          mime_type: 'audio/wav',
          data: options.sourceAudio.toString('base64'),
        },
        consent_audio: {
          mime_type: 'audio/wav',
          data: options.consentAudio.toString('base64'),
        },
      },
    },
  });
  if (!result.id) throw new Error('Gemini no devolvió un identificador de voz');
  await incrementDailyAiUsage(1);
  return result.id;
}

export async function deleteReplicatedVoiceWithGemini(voiceId: string): Promise<void> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  const ai = new GoogleGenAI({ apiKey });
  await ai.voices.delete(voiceId);
}

/**
 * Synthesizes speech using a replicated profile voice or a matching prebuilt voice,
 * with permanent deduplication in Turso DB (audio_cache table) by SHA-256 hash.
 */
export async function synthesizeSpeechWithGemini38FlashTTS(options: {
  text: string;
  geminiVoiceId?: string;
  matchedVoice?: string;
  detectedTone?: string;
  userScope?: 'maia' | 'facu' | 'shared';
  sandbox?: boolean;
}): Promise<{
  wavBuffer: Buffer;
  voiceUsed: string;
  source: 'GEMINI_3_8_FLASH_TTS' | 'TURSO_CACHE' | 'SANDBOX_MOCK';
  hash: string;
}> {
  const profileKey = options.userScope === 'maia' ? 'maia' : 'facu';
  const cleanText = options.text.trim();
  const hash = computeServerAffirmationHash(profileKey, cleanText);

  // 1. Check Turso DB permanent audio_cache first (0 API cost if cached!)
  try {
    const cached = await turso.execute({
      sql: 'SELECT audio_base64, voice_used FROM audio_cache WHERE hash = ? LIMIT 1;',
      args: [hash],
    });
    const row = cached.rows[0];
    if (row && typeof row.audio_base64 === 'string' && row.audio_base64.length > 40) {
      return {
        wavBuffer: Buffer.from(row.audio_base64, 'base64'),
        voiceUsed: (row.voice_used as string) || profileKey,
        source: 'TURSO_CACHE',
        hash,
      };
    }
  } catch (cacheReadError) {
    console.warn('[TTS Cache] Error reading Turso audio_cache:', cacheReadError);
  }

  const voiceName =
    options.geminiVoiceId ||
    options.matchedVoice ||
    (options.userScope === 'maia' ? 'Kore' : options.userScope === 'facu' ? 'Charon' : 'Aoede');

  // 2. If Sandbox Mode is active, return deterministic harmonic WAV without spending API quota
  if (options.sandbox) {
    const sandboxBuffer = createSandboxVoiceWavBuffer(cleanText, profileKey);
    return {
      wavBuffer: sandboxBuffer,
      voiceUsed: `${voiceName}-sandbox`,
      source: 'SANDBOX_MOCK',
      hash,
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const fallbackBuffer = createSandboxVoiceWavBuffer(cleanText, profileKey);
    return {
      wavBuffer: fallbackBuffer,
      voiceUsed: `${voiceName}-fallback`,
      source: 'SANDBOX_MOCK',
      hash,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const tone = options.detectedTone || 'calma profunda, hipnótica y serena';
    const interaction = await ai.interactions.create({
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: cleanText,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: `Pronuncia en español con una cadencia pausada, cálida e íntima, de tono ${tone}.`,
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: voiceName }] },
    });

    const b64Data = interaction.output_audio?.data;
    if (!b64Data) {
      throw new Error('No se recibió audio desde Gemini 3.8 Flash TTS');
    }

    await incrementDailyAiUsage(1);

    // Save permanently in Turso DB audio_cache so this affirmation never costs API calls again
    try {
      await turso.execute({
        sql: `INSERT OR REPLACE INTO audio_cache (hash, profile_id, affirmation_text, audio_base64, voice_used, created_at)
              VALUES (?, ?, ?, ?, ?, ?);`,
        args: [hash, profileKey, cleanText, b64Data, voiceName, new Date().toISOString()],
      });
    } catch (cacheWriteError) {
      console.warn('[TTS Cache] Error writing Turso audio_cache:', cacheWriteError);
    }

    const wavBuffer = Buffer.from(b64Data, 'base64');
    return {
      wavBuffer,
      voiceUsed: voiceName,
      source: 'GEMINI_3_8_FLASH_TTS',
      hash,
    };
  } catch (ttsError) {
    console.warn('[TTS] Gemini 3.8 Flash TTS fallback activated:', ttsError);
    const fallbackBuffer = createSandboxVoiceWavBuffer(cleanText, profileKey);
    return {
      wavBuffer: fallbackBuffer,
      voiceUsed: `${voiceName}-fallback`,
      source: 'SANDBOX_MOCK',
      hash,
    };
  }
}
