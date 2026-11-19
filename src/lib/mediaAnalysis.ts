'use client';

import type { MediaAttachment } from '@/types';
import { getMedia } from '@/lib/mediaStorage';
import { extractVideoFramesFallback } from '@/lib/videoProcessing';

const DIRECT_UPLOAD_THRESHOLD_BYTES = 3.5 * 1024 * 1024; // 3.5 MB (under Vercel 4.5 MB limit)

export interface MediaAnalysisResult {
  aiSummary: string;
  aiSummaryAt: string;
}

const inFlightByKey = new Map<string, Promise<MediaAnalysisResult | null>>();

async function uploadBlobToGeminiFilesFromClient(
  blob: Blob,
  mimeType: string,
  fileName: string,
): Promise<{ name: string; uri: string; mimeType: string } | null> {
  try {
    const startRes = await fetch('/api/ai/narrative-organizer/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mimeType,
        fileName,
        byteSize: blob.size,
      }),
    });
    if (!startRes.ok) return null;
    const startJson = (await startRes.json()) as {
      success?: boolean;
      uploadUrl?: string;
      mimeType?: string;
    };
    if (!startJson.success || !startJson.uploadUrl) return null;

    const uploadRes = await fetch(startJson.uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: blob,
    });
    if (!uploadRes.ok) return null;
    const uploadJson = (await uploadRes.json()) as {
      file?: { name?: string; uri?: string; mimeType?: string };
    };
    const fileObj = uploadJson?.file;
    if (!fileObj?.name || !fileObj?.uri) return null;

    return {
      name: fileObj.name,
      uri: fileObj.uri,
      mimeType: fileObj.mimeType || startJson.mimeType || mimeType,
    };
  } catch {
    return null;
  }
}

async function runAnalyzeMediaAttachment(options: {
  mediaAttachment: MediaAttachment;
  blob?: Blob | null;
  title?: string;
  description?: string;
  sandbox?: boolean;
}): Promise<MediaAnalysisResult | null> {
  const { mediaAttachment, title, description, sandbox } = options;

  try {
    const resolvedBlob =
      options.blob ??
      (mediaAttachment.storageKey ? await getMedia(mediaAttachment.storageKey) : null);

    // Case 1: Large video (> 3.5 MB) — resumable upload to Gemini Files API with frame-extraction fallback
    if (
      resolvedBlob &&
      mediaAttachment.kind === 'video' &&
      resolvedBlob.size > DIRECT_UPLOAD_THRESHOLD_BYTES &&
      !sandbox
    ) {
      const uploaded = await uploadBlobToGeminiFilesFromClient(
        resolvedBlob,
        mediaAttachment.mimeType || resolvedBlob.type || 'video/mp4',
        `${mediaAttachment.storageKey || 'manifestation'}.mp4`,
      );

      if (uploaded) {
        const res = await fetch('/api/ai/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'video',
            title: title || '',
            description: description || '',
            uploadedMedia: uploaded,
            sandbox: Boolean(sandbox),
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            success?: boolean;
            aiSummary?: string;
            aiSummaryAt?: string;
          };
          if (json.success && json.aiSummary) {
            return {
              aiSummary: json.aiSummary,
              aiSummaryAt: json.aiSummaryAt || new Date().toISOString(),
            };
          }
        }
      }

      // Fallback: extract up to 4 representative frames from the local video
      const frames = await extractVideoFramesFallback(resolvedBlob, 4);
      if (frames.length > 0) {
        const formData = new FormData();
        formData.append('kind', 'video');
        if (title) formData.append('title', title);
        if (description) formData.append('description', description);
        if (sandbox) formData.append('sandbox', 'true');
        frames.forEach((frame, idx) => {
          formData.append('frames', frame, `frame_${idx + 1}.jpg`);
        });
        const res = await fetch('/api/ai/analyze-media', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const json = (await res.json()) as {
            success?: boolean;
            aiSummary?: string;
            aiSummaryAt?: string;
          };
          if (json.success && json.aiSummary) {
            return {
              aiSummary: json.aiSummary,
              aiSummaryAt: json.aiSummaryAt || new Date().toISOString(),
            };
          }
        }
      }
    }

    // Case 2: Photo or small video (<= 3.5 MB) — direct multipart upload
    if (resolvedBlob && resolvedBlob.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
      const formData = new FormData();
      formData.append('kind', mediaAttachment.kind);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      if (sandbox) formData.append('sandbox', 'true');
      const ext = mediaAttachment.kind === 'video' ? 'mp4' : 'webp';
      formData.append(
        'file',
        resolvedBlob,
        `${mediaAttachment.storageKey || 'media'}.${ext}`,
      );

      const res = await fetch('/api/ai/analyze-media', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          aiSummary?: string;
          aiSummaryAt?: string;
        };
        if (json.success && json.aiSummary) {
          return {
            aiSummary: json.aiSummary,
            aiSummaryAt: json.aiSummaryAt || new Date().toISOString(),
          };
        }
      }
    }

    // Case 3: Cross-device fallback (blob not present in local IndexedDB) — analyze Turso thumbnail
    if (mediaAttachment.thumbDataUrl?.startsWith('data:image/')) {
      const res = await fetch('/api/ai/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: mediaAttachment.kind,
          title: title || '',
          description: description || '',
          thumbDataUrl: mediaAttachment.thumbDataUrl,
          sandbox: Boolean(sandbox),
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          aiSummary?: string;
          aiSummaryAt?: string;
        };
        if (json.success && json.aiSummary) {
          return {
            aiSummary: json.aiSummary,
            aiSummaryAt: json.aiSummaryAt || new Date().toISOString(),
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[mediaAnalysis] Failed to analyze attachment:', err);
    return null;
  }
}

/**
 * Analyzes a manifestation's photo or video attachment with Gemini and deduplicates
 * concurrent requests for the same storageKey.
 */
export function analyzeMediaAttachment(options: {
  mediaAttachment: MediaAttachment;
  blob?: Blob | null;
  title?: string;
  description?: string;
  sandbox?: boolean;
}): Promise<MediaAnalysisResult | null> {
  const key = options.mediaAttachment.storageKey || options.mediaAttachment.thumbDataUrl.slice(0, 48);
  const existing = inFlightByKey.get(key);
  if (existing) return existing;

  const promise = runAnalyzeMediaAttachment(options).finally(() => {
    inFlightByKey.delete(key);
  });
  inFlightByKey.set(key, promise);
  return promise;
}
