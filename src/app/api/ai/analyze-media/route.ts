import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  getDailyAiUsage,
  getGeminiApiKey,
  incrementDailyAiUsage,
  TIER_1_DAILY_LIMIT,
} from '@/lib/gemini';
import { inferVideoMimeType } from '@/lib/videoProcessing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 90;

const MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;
const MAX_SUMMARY_CHARS = 650;
const MAX_INLINE_FILE_BYTES = 18 * 1024 * 1024;

interface UploadedMediaPayload {
  name: string;
  uri: string;
  mimeType: string;
}

function cleanMediaMimeType(mimeType: string, fileName?: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/') || base.startsWith('video/')) {
    return base;
  }
  const inferred = inferVideoMimeType({ name: fileName, type: mimeType });
  if (inferred) return inferred;
  return '';
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
  let currentMime = fallbackMime || 'video/mp4';

  while (Date.now() < deadline) {
    const info = await ai.files.get({ name: normalizedName });
    if (info.uri) currentUri = info.uri;
    if (info.mimeType) currentMime = info.mimeType.split(';')[0].trim().toLowerCase();

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

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].trim().toLowerCase();
  if (!mimeType.startsWith('image/')) return null;
  return { mimeType, base64: match[2] };
}

function buildMediaAnalysisPrompt(options: {
  kind: 'photo' | 'video';
  title?: string;
  description?: string;
  isThumbOnly?: boolean;
}): string {
  const contextLines: string[] = [];
  if (options.title) {
    contextLines.push(`Título que puso el usuario a la manifestación: "${options.title}".`);
  }
  if (options.description && options.description !== options.title) {
    contextLines.push(`Nota del usuario: "${options.description}".`);
  }
  const contextBlock = contextLines.length > 0 ? `\n${contextLines.join('\n')}\n` : '';
  const sourceNote = options.isThumbOnly
    ? 'Nota: solo tenés la miniatura/portada del archivo adjunto; describí con precisión lo que se ve sin inventar detalles que no aparecen.'
    : options.kind === 'video'
      ? 'Analizá tanto las imágenes/escenas del video como el audio hablado, texto en pantalla, subtítulos, lugares, objetos, personas, estilo de vida o situación que muestra.'
      : 'Analizá con precisión la imagen: objetos, lugares, personas, estilo, texto visible y situación que representa.';

  return `Sos un analizador visual para una app de Ley de la Asunción (estilo literal, directo, cero poesía New Age).
El usuario adjuntó ${options.kind === 'video' ? 'un video' : 'una foto'} a una manifestación para representar algo concreto que ya quiere asumir como propio en su vida.${contextBlock}
${sourceNote}

Devolvé ÚNICAMENTE un párrafo conciso y concreto en español (máximo 450 caracteres, sin comillas, sin listas ni prefijos como "El video muestra:") describiendo exactamente qué se ve, qué se dice o qué texto aparece, y cuál es el deseo/situación específica que representa, para que después otro módulo pueda redactar afirmaciones precisas en primera persona sobre eso.
Prohibido usar lenguaje poético o palabras como "vibrar", "frecuencia", "sagrado", "energía", "fluir", "universo", "gratitud" o "certeza plena".`;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let kind: 'photo' | 'video' = 'photo';
    let title = '';
    let description = '';
    let sandbox =
      req.headers.get('x-ai-sandbox') === 'true' || process.env.AI_SANDBOX === 'true';
    let uploadedMedia: UploadedMediaPayload | null = null;
    let thumbDataUrl = '';
    const inlineParts: Array<{ mimeType: string; data: string }> = [];

    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Solicitud inválida.' },
          { status: 400 },
        );
      }
      kind = body.kind === 'video' ? 'video' : 'photo';
      title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
      description =
        typeof body.description === 'string' ? body.description.trim().slice(0, 400) : '';
      if (body.sandbox === true) sandbox = true;

      if (body.uploadedMedia && typeof body.uploadedMedia === 'object') {
        const um = body.uploadedMedia as Record<string, unknown>;
        const name = typeof um.name === 'string' ? um.name.trim() : '';
        const uri = typeof um.uri === 'string' ? um.uri.trim() : '';
        const mimeType = cleanMediaMimeType(
          typeof um.mimeType === 'string' ? um.mimeType : '',
          name,
        );
        if (name && uri && mimeType) {
          uploadedMedia = { name, uri, mimeType };
          if (mimeType.startsWith('video/')) kind = 'video';
        }
      }

      if (typeof body.thumbDataUrl === 'string' && body.thumbDataUrl.startsWith('data:image/')) {
        thumbDataUrl = body.thumbDataUrl;
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const rawKind = formData.get('kind');
      kind = rawKind === 'video' ? 'video' : 'photo';
      title = String(formData.get('title') || '').trim().slice(0, 160);
      description = String(formData.get('description') || '').trim().slice(0, 400);
      if (formData.get('sandbox') === 'true') sandbox = true;

      const rawThumb = formData.get('thumbDataUrl');
      if (typeof rawThumb === 'string' && rawThumb.startsWith('data:image/')) {
        thumbDataUrl = rawThumb;
      }

      const rawUploaded = formData.get('uploadedMedia');
      if (typeof rawUploaded === 'string' && rawUploaded.trim()) {
        try {
          const parsed = JSON.parse(rawUploaded) as Record<string, unknown>;
          const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
          const uri = typeof parsed.uri === 'string' ? parsed.uri.trim() : '';
          const mimeType = cleanMediaMimeType(
            typeof parsed.mimeType === 'string' ? parsed.mimeType : '',
            name,
          );
          if (name && uri && mimeType) {
            uploadedMedia = { name, uri, mimeType };
            if (mimeType.startsWith('video/')) kind = 'video';
          }
        } catch {
          // ignore malformed uploadedMedia
        }
      }

      const entries = [...formData.getAll('file'), ...formData.getAll('frames')].slice(0, 4);
      for (const entry of entries) {
        if (!(entry instanceof File) || entry.size <= 0) continue;
        if (entry.size > MAX_INLINE_FILE_BYTES) {
          return NextResponse.json(
            {
              success: false,
              error: 'El archivo es demasiado grande para envío directo.',
            },
            { status: 413 },
          );
        }
        const mime = cleanMediaMimeType(entry.type, entry.name);
        if (!mime) continue;
        if (mime.startsWith('video/')) kind = 'video';
        const buffer = Buffer.from(await entry.arrayBuffer());
        inlineParts.push({
          mimeType: mime,
          data: buffer.toString('base64'),
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo de contenido no soportado.' },
        { status: 400 },
      );
    }

    const isThumbOnly = !uploadedMedia && inlineParts.length === 0 && Boolean(thumbDataUrl);
    if (isThumbOnly) {
      const parsed = parseDataUrl(thumbDataUrl);
      if (parsed) {
        inlineParts.push({ mimeType: parsed.mimeType, data: parsed.base64 });
      }
    }

    if (!uploadedMedia && inlineParts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se recibió ninguna imagen ni video para analizar.' },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    if (sandbox) {
      const label = kind === 'video' ? 'video adjunto' : 'foto adjunta';
      const hint = title ? ` asociado a "${title}"` : '';
      const aiSummary = `Contenido del ${label}${hint}: escena concreta lista para usar en afirmaciones en primera persona.`;
      return NextResponse.json({
        success: true,
        aiSummary,
        aiSummaryAt: nowIso,
        source: 'SANDBOX_MOCK',
      });
    }

    const dailyUsage = await getDailyAiUsage();
    if (dailyUsage >= TIER_1_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Has alcanzado el límite diario de solicitudes IA (${TIER_1_DAILY_LIMIT} RPD).`,
          code: 'DAILY_QUOTA_EXCEEDED',
          quotaUsedToday: dailyUsage,
        },
        { status: 429 },
      );
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Servicio de IA no disponible: falta clave de API.' },
        { status: 502 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const parts: Array<Record<string, unknown>> = [];

    if (uploadedMedia) {
      const active = await waitForGeminiFileActive(
        ai,
        uploadedMedia.name,
        uploadedMedia.uri,
        uploadedMedia.mimeType,
      );
      parts.push({
        fileData: {
          fileUri: active.uri,
          mimeType: active.mimeType,
        },
      });
    } else {
      for (const item of inlineParts) {
        parts.push({
          inlineData: {
            mimeType: item.mimeType,
            data: item.data,
          },
        });
      }
    }

    parts.push({
      text: buildMediaAnalysisPrompt({
        kind,
        title,
        description,
        isThumbOnly,
      }),
    });

    let rawSummary = '';
    let lastError: unknown = null;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: parts as any }],
          config: {
            temperature: 0.25,
            maxOutputTokens: 320,
          },
        });
        const text = (response.text || '').trim();
        if (text) {
          rawSummary = text;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[API /api/ai/analyze-media] Model ${model} failed:`, err);
      }
    }

    if (!rawSummary) {
      throw lastError instanceof Error
        ? lastError
        : new Error('No se pudo analizar el archivo multimedia.');
    }

    const aiSummary = rawSummary
      .replace(/\s+/g, ' ')
      .replace(/^["'«“]+|["'»”]+$/g, '')
      .trim()
      .slice(0, MAX_SUMMARY_CHARS);

    const quotaUsedToday = await incrementDailyAiUsage(1);

    return NextResponse.json({
      success: true,
      aiSummary,
      aiSummaryAt: nowIso,
      source: 'GEMINI_LIVE',
      quotaUsedToday,
    });
  } catch (error: unknown) {
    console.error('[API /api/ai/analyze-media] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Error analizando el archivo adjunto.';
    const isQuota =
      message.includes('429') ||
      message.includes('quota') ||
      message.includes('RESOURCE_EXHAUSTED');
    return NextResponse.json(
      { success: false, error: message },
      { status: isQuota ? 429 : 500 },
    );
  }
}
