const MAX_VIDEO_SECONDS = 20;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const POSTER_EDGE = 280;
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

function assertVideoFile(file: File) {
  if (!file.type.startsWith('video/')) {
    throw new Error('El archivo no es un video válido.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('El video es demasiado grande (máximo 30 MB).');
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

function loadVideoMetadata(file: File): Promise<{
  video: HTMLVideoElement;
  objectUrl: string;
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const timeout = window.setTimeout(() => {
      cleanup();
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
  });
}

function waitForSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
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
      reject(new Error('No pudimos capturar la portada del video.'));
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
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  assertVideoFile(file);

  const metadata = await loadVideoMetadata(file);
  try {
    if (metadata.duration > MAX_VIDEO_SECONDS + 0.25) {
      throw new Error(`El video dura ${Math.ceil(metadata.duration)} s. El máximo es 20 s.`);
    }

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
      width: metadata.width,
      height: metadata.height,
      durationSeconds: Math.min(metadata.duration, MAX_VIDEO_SECONDS),
      mimeType: file.type || 'video/mp4',
      byteSize: file.size,
    };
  } finally {
    URL.revokeObjectURL(metadata.objectUrl);
    metadata.video.removeAttribute('src');
    metadata.video.load();
  }
}
