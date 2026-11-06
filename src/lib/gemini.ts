import { GoogleGenAI } from '@google/genai';

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
 * Generates Rampage batch of short subliminal affirmations (2 to 6 words)
 */
export async function generateRampageWithGemini(
  centralTheme: string,
  userScope: string = 'shared',
  userAffirmations: string[] = [],
  batchSize: number = 3,
  additionalDetails: string = ''
): Promise<{
  affirmations: string[];
  source: 'GEMINI_LIVE';
  totalTokens: number;
}> {
  const apiKey = getGeminiApiKey();
  const count = Math.max(1, Math.min(10, Math.floor(Number.isFinite(batchSize) ? batchSize : 3)));
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const ai = new GoogleGenAI({ apiKey });
  const detailsSection = additionalDetails.trim()
    ? `\nDetalles adicionales solicitados: "${additionalDetails.trim()}".`
    : '';
  const referencesSection = userAffirmations.length
    ? `\nAfirmaciones propias del perfil, para integrar ocasionalmente sin desplazar el tema central:\n${userAffirmations.map((a) => `- "${a}"`).join('\n')}`
    : '';

  const prompt = `Eres el motor de Reprogramación Subliminal y Rampage.
Perfil actual: ${userScope === 'maia' ? 'Maia' : userScope === 'facu' ? 'Facu' : 'Dúo (Maia & Facu)'}.
Tema central y prioridad absoluta: "${centralTheme.trim()}".${detailsSection}${referencesSection}

REGLAS ESTRICTAS DE ESTILO SUBLIMINAL (CERO TEXTOS POÉTICOS LARGOS):
1. SIMPLICIDAD Y LONGITUD: Cada afirmación debe tener estrictamente entre 2 y 6 palabras.
2. TIEMPO PRESENTE: Usa primera persona ("Yo soy...", "Tengo...", "Elijo...", "Siento...").
3. Asertivas, naturales y rítmicas para repetición en bucle infinito mientras duermes o descansas.
4. El tema central siempre guía las frases; integra las referencias solo de vez en cuando y sin cambiar el foco.
5. Devuelve ÚNICAMENTE un JSON { "affirmations": string[] } con exactamente ${count} afirmaciones.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    const raw = (response.text || '').trim();
    const cleaned = raw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const parsed: unknown = JSON.parse(cleaned);
    const items: unknown =
      typeof parsed === 'object' && parsed !== null && 'affirmations' in parsed
        ? parsed.affirmations
        : parsed;
    const affirmations = Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [];
    if (affirmations.length !== count) {
      throw new Error(`Gemini no devolvió las ${count} afirmaciones solicitadas.`);
    }

    return {
      affirmations,
      source: 'GEMINI_LIVE',
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
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
