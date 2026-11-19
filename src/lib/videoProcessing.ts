const POSTER_EDGE = 280;
const FALLBACK_FRAME_EDGE = 640;
const MAX_THUMB_DATA_URL_LENGTH = 72_000;

export interface PreparedVideo {
  blob: Blob;
  thumbDataUrl: string;
  width: number;
  height: number;
  durationSeconds: number;
  mimeType: string;
  byteSize: number;
}

const VIDEO_EXT_MIMES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  ogv: 'video/ogg',
};

export function inferVideoMimeType(file: { name?: string; type?: string }): string {
  const rawType = (file.type || '').split(';')[0].trim().toLowerCase();
  if (rawType.startsWith('video/')) {
    return rawType;
  }
  const name = (file.name || '').trim().toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  return VIDEO_EXT_MIMES[ext] || '';
}

export function isVideoFile(file: { name?: string; type?: string }): boolean {
  return Boolean(inferVideoMimeType(file));
}

function assertVideoFile(file: File) {
  if (!isVideoFile(file)) {
    throw new Error('El archivo no es un video válido.');
  }
}

function createPlaceholderPoster(): string {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_EDGE;
  canvas.height = POSTER_EDGE;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#181818';
  context.fillRect(0, 0, POSTER_EDGE, POSTER_EDGE);
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.beginPath();
  context.moveTo(112, 96);
  context.lineTo(112, 184);
  context.lineTo(190, 140);
  context.closePath();
  context.fill();
  return canvas.toDataURL('image/jpeg', 0.72);
}

function loadVideoMetadata(file: Blob): Promise<{
  video: HTMLVideoElement;
  objectUrl: string;
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const timeout = window.setTimeout(() => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El video tardó demasiado en cargar.'));
    }, 8_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      cleanup();
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      resolve({
        video,
        objectUrl,
        duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No pudimos leer el video. Probá con otro formato (MP4).'));
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    try {
      video.load();
    } catch {
      // ignore
    }
  });
}

function waitForSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 3_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      resolve();
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = time;
    } catch {
      cleanup();
      resolve();
    }
  });
}

function drawPoster(video: HTMLVideoElement, width: number, height: number): string {
  try {
    const ratio = Math.min(POSTER_EDGE / Math.max(1, width), POSTER_EDGE / Math.max(1, height));
    const targetWidth = Math.max(1, Math.round(width * ratio));
    const targetHeight = Math.max(1, Math.round(height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return createPlaceholderPoster();
    context.drawImage(video, 0, 0, targetWidth, targetHeight);

    let dataUrl = canvas.toDataURL('image/webp', 0.72);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.74);
    }
    if (dataUrl.length > MAX_THUMB_DATA_URL_LENGTH) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    }
    return dataUrl || createPlaceholderPoster();
  } catch {
    return createPlaceholderPoster();
  }
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  assertVideoFile(file);
  const cleanMime = inferVideoMimeType(file) || 'video/mp4';

  try {
    const metadata = await loadVideoMetadata(file);
    try {
      const seekTime = Math.min(0.6, Math.max(0.1, metadata.duration / 3));
      await waitForSeek(metadata.video, seekTime);

      const thumbDataUrl = drawPoster(
        metadata.video,
        metadata.width || POSTER_EDGE,
        metadata.height || POSTER_EDGE,
      );

      return {
        blob: file,
        thumbDataUrl,
        width: metadata.width || POSTER_EDGE,
        height: metadata.height || POSTER_EDGE,
        durationSeconds: metadata.duration,
        mimeType: cleanMime,
        byteSize: file.size,
      };
    } finally {
      URL.revokeObjectURL(metadata.objectUrl);
      metadata.video.removeAttribute('src');
      try {
        metadata.video.load();
      } catch {
        // ignore
      }
    }
  } catch {
    // Graceful fallback when browser lacks local codec support (e.g. HEVC/H.264 on Linux/Firefox):
    // Gemini can still process the raw video file on the backend.
    return {
      blob: file,
      thumbDataUrl: createPlaceholderPoster(),
      width: 720,
      height: 1280,
      durationSeconds: 0,
      mimeType: cleanMime,
      byteSize: file.size,
    };
  }
}

/**
 * Fallback frame extractor used only if direct resumable upload to Gemini Files API
 * is blocked by a client firewall/extension AND the video exceeds Vercel's 4.5 MB limit.
 */
export async function extractVideoFramesFallback(
  file: Blob,
  maxFrames = 4,
): Promise<Blob[]> {
  try {
    const metadata = await loadVideoMetadata(file);
    try {
      const duration = metadata.duration > 0 ? metadata.duration : 2;
      const width = metadata.width || FALLBACK_FRAME_EDGE;
      const height = metadata.height || FALLBACK_FRAME_EDGE;
      const ratio = Math.min(
        FALLBACK_FRAME_EDGE / Math.max(1, width),
        FALLBACK_FRAME_EDGE / Math.max(1, height),
        1,
      );
      const targetWidth = Math.max(1, Math.round(width * ratio));
      const targetHeight = Math.max(1, Math.round(height * ratio));

      const frames: Blob[] = [];
      const count = Math.max(1, Math.min(4, maxFrames));

      for (let i = 0; i < count; i++) {
        const fraction = count === 1 ? 0.3 : 0.1 + (0.8 * i) / (count - 1);
        const seekTime = Math.min(Math.max(0.05, duration * fraction), Math.max(0.05, duration - 0.05));
        await waitForSeek(metadata.video, seekTime);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(metadata.video, 0, 0, targetWidth, targetHeight);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72),
        );
        if (blob && blob.size > 0) {
          frames.push(blob);
        }
      }
      return frames;
    } finally {
      URL.revokeObjectURL(metadata.objectUrl);
      metadata.video.removeAttribute('src');
      try {
        metadata.video.load();
      } catch {
        // ignore
      }
    }
  } catch {
    return [];
  }
}
