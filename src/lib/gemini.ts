import { GoogleGenAI } from '@google/genai';
import type { UserScope } from '@/types';
import {
  findPoeticTerm,
  getFallbackAffirmations,
  sanitizeAffirmations,
  type RampageHistoryContext,
  type RampageManifestationContext,
} from './affirmationEngine';

export interface AiTelemetryResponse {
  source: 'SANDBOX_MOCK' | 'GEMINI_LIVE' | 'LOCAL_FALLBACK';
  totalTokens: number;
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

  // Remove Spanish fillers
  cleaned = cleaned.replace(/^(y\s+bueno|bueno|eh|este|mmm|o\s+sea)[,\s]*/i, '');
  cleaned = cleaned.replace(/\b(eh|mmm|este|o sea)\b/gi, '');
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
 * Transcribe audio using Google GenAI (Gemini 3.5 transcript / flash)
 */
export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
  previousTextTail?: string,
  spokenText?: string
): Promise<{ text: string; detectedTone: string; source: 'GEMINI_LIVE'; totalTokens: number }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (spokenText) {
      return {
        text: cleanSpokenText(spokenText, previousTextTail),
        detectedTone: 'calma, firme, íntima',
        source: 'GEMINI_LIVE',
        totalTokens: 0,
      };
    }
    throw new Error('GEMINI_API_KEY no configurada');
  }

  if (!audioBuffer || audioBuffer.length < 200) {
    throw new Error('No se recibió una grabación de audio válida');
  }

  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';
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
  if (!transcription) throw new Error('Gemini no reconoció voz en la grabación');

  return {
    text: cleanSpokenText(transcription, previousTextTail),
    detectedTone: 'calma, íntima y luminosa',
    source: 'GEMINI_LIVE',
    totalTokens: 0,
  };
}

/**
 * System prompt de la Ley de la Asunción: few-shot con el molde exacto del usuario.
 * No cambiar los ejemplos sin respetar el tono directo, literal y coloquial.
 */
const AFFIRMATION_SYSTEM_PROMPT = `Eres un generador de afirmaciones basado estrictamente en la Ley de la Asunción (Law of Assumption). Tu único objetivo es generar afirmaciones que suenen como pensamientos naturales, directos, literales y cotidianos en primera persona, como si el usuario estuviera declarando hechos reales de su vida.

REGLAS DE ESTILO INQUEBRANTABLES:
1. CERO POESÍA Y CERO NEW AGE: Está terminantemente PROHIBIDO usar metáforas, lenguaje poético o palabras como: "fluir", "fluye", "pecho", "latido", "sagrado", "vibrar", "vibración", "frecuencia", "sintonizar", "sendero", "brisa", "abro mis brazos", "respiro hondo", "certeza plena", "orquestó", "gratitud", "gratitud profunda", "reclamo mi poder", "universo conspira", "luz", "energía" o "merecer".
2. ESTRUCTURA DIRECTA Y COLOQUIAL: Usa oraciones simples en presente indicativo ("Soy...", "Tengo...", "[Nombre/SP] me...", "Paso...", "Comparto..."). Deben sonar como habla una persona joven en la vida real, sin palabras difíciles ni adornos literarios.
3. AUTOCONCEPTO EN EL PEDESTAL: El usuario es el centro absoluto de su realidad ("Soy Dios", "Soy la primera opción", "Mi atención es única"). Las demás personas lo buscan, lo priorizan, lo desean, están obsesionadas con él, lo protegen y le dan todo.
4. NATURALIDAD EN VÍNCULOS ESPECÍFICOS: Si el usuario menciona a una persona específica (SP, Maia u otra) o dinámicas relacionales (esposa, vínculos sin reglamentos, triángulos amorosos, juntadas), genera afirmaciones directas y literales sobre cuánto lo aman, lo necesitan, lo buscan y lo bien que la pasan juntos, sin suavizar ni juzgar la dinámica.

EJEMPLOS EXACTOS DEL ESTILO QUE DEBES IMITAR (MOLDE OBLIGATORIO):
- Autoconcepto y Realidad:
  "Soy Dios"
  "Soy amado"
  "Soy querido"
  "Soy deseado"
  "La gente me ama"
  "Soy muy valioso"
  "Mi atención es única"
  "Soy elegido"
  "Soy siempre la primera opción"
  "Las mujeres me desean, buscan mantenerme y dar todo de sí mismas por mí"
  "Los hombres me adoran, buscan protegerme y regalarme cosas"
  "Soy el favorito del universo"
  "Soy dueño de mi propia realidad"
  "Tengo todo lo que deseo y todo lo que deseo me desea más a mí"

- Persona Específica (SP):
  "SP me ama"
  "SP me adora"
  "Soy el favorito de SP"
  "SP me necesita"
  "SP me desea"
  "SP está obsesionada conmigo"
  "Soy la persona favorita de SP"
  "SP vive pensando en mí todo el día"

- Vínculos y Dinámicas (ej. Maia):
  "Maia es mi esposa y nos divertimos juntos"
  "Mantenemos un vínculo sin título ni reglamentos con Maia"
  "Soy el esposo de Maia, y junto a SP mantenemos un triángulo amoroso"
  "Comparto cientos de actividades con Maia"
  "Paso mucho tiempo con Maia"

INSTRUCCIÓN DE SALIDA:
Basado en el tema central y los matices que indique el usuario, genera un lote de afirmaciones nuevas que sigan EXACTAMENTE el tono, la simpleza y la estructura de los ejemplos anteriores. Devuelve únicamente un JSON válido con el formato: { "affirmations": ["...", "...", "..."] }. No agregues explicaciones, markdown ni texto fuera del JSON.`;

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
      ? parsed.affirmations
      : parsed;
  return Array.isArray(items) ? items : [];
}

/**
 * Generates a Rampage batch with the user's direct, colloquial Law of Assumption style.
 * The output is validated against the poetic blacklist before reaching the frontend.
 */
export async function generateRampageWithGemini(
  centralTheme: string,
  userScope: UserScope = 'shared',
  userAffirmations: string[] = [],
  batchSize: number = 3,
  additionalDetails: string = '',
  userManifestations: RampageManifestationContext[] = [],
  userRampages: RampageHistoryContext[] = []
): Promise<{
  affirmations: string[];
  source: 'GEMINI_LIVE';
  totalTokens: number;
}> {
  const apiKey = getGeminiApiKey();
  const count = Math.max(1, Math.min(10, Math.floor(Number.isFinite(batchSize) ? batchSize : 3)));
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const ai = new GoogleGenAI({ apiKey });
  const profileLabel =
    userScope === 'maia' ? 'Maia' : userScope === 'facu' ? 'Facu' : 'Dúo (Maia & Facu)';
  const safeReferences = userAffirmations.filter((affirmation) => !findPoeticTerm(affirmation));
  const detailsSection = additionalDetails.trim()
    ? `\nDetalles adicionales solicitados: "${additionalDetails.trim()}".`
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
      ? 'El perfil es Juntos (Maia & Facu): podés integrar naturalmente a ambos y su vida en común.'
      : `El perfil es ${profileLabel}: usá solo su contexto, sin mezclar afirmaciones, manifestaciones ni Rampages del otro perfil.`;

  const prompt = `Perfil actual: ${profileLabel}.
${profileInstruction}
Tema central y prioridad absoluta: "${centralTheme.trim()}".${detailsSection}${manifestationsSection}${referencesSection}${rampagesSection}

Cantidad exacta: ${count} afirmaciones.
Instrucciones adicionales:
- Escribe en primera persona, presente indicativo, como hechos reales de tu vida.
- El título y los detalles del Rampage mandan por encima de cualquier referencia.
- Usá las manifestaciones y afirmaciones registradas como contexto para que las frases suenen a la vida real de este perfil, pero no las copies literalmente.
- No uses ninguna palabra de la lista negra poética.
- No repitas la misma idea ni la misma frase.
- Si el tema o los detalles nombran a una persona, usá ese nombre. Si no, podés usar "SP".
- Cada afirmación tiene que poder decirse en voz alta sin sonar rara.
Devuelve únicamente el JSON { "affirmations": [...] }.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: AFFIRMATION_SYSTEM_PROMPT,
        temperature: 0.65,
        responseMimeType: 'application/json',
      },
    });

    let totalTokens = response.usageMetadata?.totalTokenCount || 0;
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
      const missing = count - affirmations.length;
      const retryResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}\n\nLa respuesta anterior no cumplió el molde. Genera ${missing} afirmaciones nuevas, directas y sin lenguaje poético.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: AFFIRMATION_SYSTEM_PROMPT,
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      });

      totalTokens += retryResponse.usageMetadata?.totalTokenCount || 0;
      const retryValidation = sanitizeAffirmations(
        parseAffirmationPayload(retryResponse.text || ''),
        missing
      );
      if (retryValidation.rejected.length > 0) {
        console.warn(
          '[Gemini Rampage] Afirmaciones descartadas en el reintento:',
          retryValidation.rejected
        );
      }
      affirmations = [...affirmations, ...retryValidation.accepted];
    }

    if (affirmations.length < count) {
      const fallback = getFallbackAffirmations(
        userScope,
        count - affirmations.length,
        affirmations
      );
      if (fallback.length > 0) {
        console.warn('[Gemini Rampage] Se completó el lote con afirmaciones por defecto:', fallback);
        affirmations = [...affirmations, ...fallback];
      }
    }

    if (affirmations.length < count) {
      throw new Error(`Gemini no devolvió las ${count} afirmaciones solicitadas.`);
    }

    return {
      affirmations: affirmations.slice(0, count),
      source: 'GEMINI_LIVE',
      totalTokens,
    };
  } catch (error) {
    console.error('[Gemini Rampage] gemini-3.5-flash-lite error:', error);
    throw error;
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
  return result.id;
}

export async function deleteReplicatedVoiceWithGemini(voiceId: string): Promise<void> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  const ai = new GoogleGenAI({ apiKey });
  await ai.voices.delete(voiceId);
}

/**
 * Synthesizes speech using a replicated profile voice or a matching prebuilt voice.
 */
export async function synthesizeSpeechWithGemini38FlashTTS(options: {
  text: string;
  geminiVoiceId?: string;
  matchedVoice?: string;
  detectedTone?: string;
  userScope?: 'maia' | 'facu' | 'shared';
}): Promise<{ wavBuffer: Buffer; voiceUsed: string; source: 'GEMINI_3_8_FLASH_TTS' }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const ai = new GoogleGenAI({ apiKey });

  const voiceName =
    options.geminiVoiceId ||
    options.matchedVoice ||
    (options.userScope === 'maia' ? 'Kore' : options.userScope === 'facu' ? 'Charon' : 'Aoede');
  const tone = options.detectedTone || 'calma profunda, hipnótica y serena';
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash-tts',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: options.text.trim(),
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

  const wavBuffer = Buffer.from(b64Data, 'base64');
  return {
    wavBuffer,
    voiceUsed: voiceName,
    source: 'GEMINI_3_8_FLASH_TTS',
  };
}
