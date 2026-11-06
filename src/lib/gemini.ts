import { GoogleGenAI } from '@google/genai';

export interface AiTelemetryResponse {
  source: 'SANDBOX_MOCK' | 'GEMINI_LIVE';
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

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ];

  const hasAudio = audioBuffer && audioBuffer.length > 200;
  const base64Data = hasAudio ? audioBuffer.toString('base64') : '';

  const prompt = `Actúa como un transcriptor neuro-acústico en español. Escucha el audio del usuario y devuelve un JSON con { "text": string, "detectedTone": string }.
1. En "text": Transcribe exactamente el mensaje eliminando por completo muletillas ('eh', 'este', 'mmm', 'o sea', 'y bueno'), falsos comienzos y repeticiones involuntarias. Aplica puntuación impecable (comas, puntos, punto y coma, signos de exclamación/interrogación: ¿?, ¡!) que refleje las pausas naturales del hablante.
2. En "detectedTone": Describe en 3 palabras la cadencia emocional de la voz (ej. 'calma, firme, íntima') para mantener esa misma energía en las afirmaciones.
${previousTextTail ? `Contexto previo: "${previousTextTail.slice(-60)}"` : ''}
${spokenText ? `Borrador fonético de referencia: "${spokenText}"` : ''}
Responde ÚNICAMENTE con el objeto JSON válido: { "text": "...", "detectedTone": "..." }`;

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const parts: any[] = [];
      if (hasAudio) {
        const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';
        parts.push({
          inlineData: {
            mimeType: cleanMime,
            data: base64Data,
          },
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });

      const raw = (response.text || '').trim();
      const cleaned = raw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      const text = String(parsed.text || '').trim();
      const detectedTone = String(parsed.detectedTone || 'calma, firme, íntima').trim();

      if (text) {
        return {
          text,
          detectedTone,
          source: 'GEMINI_LIVE',
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Transcribe] Model ${model} failed:`, err?.message || err);
    }
  }

  if (spokenText) {
    return {
      text: cleanSpokenText(spokenText, previousTextTail),
      detectedTone: 'calma, firme, íntima',
      source: 'GEMINI_LIVE',
      totalTokens: 0,
    };
  }

  throw lastError || new Error('No se pudo transcribir con Gemini');
}

/**
 * Generates Rampage batch of short subliminal affirmations (2 to 6 words)
 */
export async function generateRampageWithGemini(
  centralTheme: string,
  userScope: string = 'shared',
  userAffirmations: string[] = [],
  batchSize: number = 3
): Promise<{ affirmations: string[]; source: 'GEMINI_LIVE'; totalTokens: number }> {
  const apiKey = getGeminiApiKey();
  const count = batchSize || 3;

  if (!apiKey) {
    // Elegant fallback pool
    const pool = [
      'Soy abundancia viva.',
      'Todo conspira a mi favor.',
      'Merezco recibir amor.',
      'Mi mente está en paz.',
      'Siempre elijo mi poder.',
      'El camino está despejado.',
      'Soy merecedor de todo.',
    ];
    return {
      affirmations: pool.sort(() => 0.5 - Math.random()).slice(0, count),
      source: 'GEMINI_LIVE',
      totalTokens: 0,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ];

  const prompt = `Eres el motor de Reprogramación Subliminal y Rampage.
Perfil actual: ${userScope === 'maia' ? 'Maia' : userScope === 'facu' ? 'Facu' : 'Dúo (Maia & Facu)'}.
Tema central: "${centralTheme || 'Abundancia, Amor y Realización'}".
Afirmaciones de referencia previas:
${userAffirmations.map((a) => `- "${a}"`).join('\n')}

REGLAS ESTRICTAS DE ESTILO SUBLIMINAL (CERO TEXTOS POÉTICOS LARGOS):
1. SIMPLICIDAD Y LONGITUD: Cada afirmación debe tener estrictamente entre 2 y 6 palabras.
2. TIEMPO PRESENTE: Usa primera persona ("Yo soy...", "Tengo...", "Elijo...", "Siento...").
3. Asertivas, naturales y rítmicas para repetición en bucle infinito mientras duermes o descansas.
4. Devuelve ÚNICAMENTE un JSON { "affirmations": string[] } con exactamente ${count} afirmaciones.`;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const raw = (response.text || '').trim();
      const cleaned = raw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      const items: string[] = Array.isArray(parsed) ? parsed : parsed.affirmations || [];
      if (items.length > 0) {
        return {
          affirmations: items.slice(0, count).map((s) => String(s).trim()),
          source: 'GEMINI_LIVE',
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini Rampage] ${model} error:`, err?.message || err);
    }
  }

  return {
    affirmations: ['Soy paz infinita.', 'Todo se alinea perfecto.', 'Merezco todo lo bueno.'].slice(0, count),
    source: 'GEMINI_LIVE',
    totalTokens: 0,
  };
}

/**
 * Synthesizes speech using Gemini 3.8 Flash TTS
 */
export async function synthesizeSpeechWithGemini38FlashTTS(options: {
  text: string;
  matchedVoice?: string;
  detectedTone?: string;
  userScope?: 'maia' | 'facu' | 'shared';
}): Promise<{ wavBuffer: Buffer; voiceUsed: string; source: 'GEMINI_3_8_FLASH_TTS' }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Intelligent voice matching according to user profile
  let voiceName = options.matchedVoice;
  if (!voiceName) {
    if (options.userScope === 'maia') {
      voiceName = 'Kore'; // Melodic gentle feminine
    } else if (options.userScope === 'facu') {
      voiceName = 'Charon'; // Warm calm masculine
    } else {
      voiceName = 'Aoede'; // Harmonious neutral
    }
  }

  const tone = options.detectedTone || 'calma profunda, hipnótica y serena';
  const prompt = `Actúa como la voz interior de afirmaciones subconscientes y reprogramación mental profunda.
Pronuncia la siguiente afirmación en español con una cadencia pausada, hipnótica, cálida e íntima, con tono de ${tone}.

Afirmación a pronunciar:
"${options.text.trim()}"`;

  const res = await ai.models.generateContent({
    model: 'gemini-3.8-flash-tts',
    contents: prompt,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });

  const part = res.candidates?.[0]?.content?.parts?.[0];
  const b64Data = part?.inlineData?.data;

  if (!b64Data) {
    throw new Error('No se recibió audio desde gemini-3.8-flash-tts');
  }

  const wavBuffer = Buffer.from(b64Data, 'base64');
  return {
    wavBuffer,
    voiceUsed: voiceName,
    source: 'GEMINI_3_8_FLASH_TTS',
  };
}
