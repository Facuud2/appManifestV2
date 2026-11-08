const MAX_PHOTO_EDGE = 1200;
const THUMB_EDGE = 280;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_THUMB_DATA_URL_LENGTH = 72_000;

export interface PreparedPhoto {
  blob: Blob;
  thumbDataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
}

function assertImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen válida.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 30 MB).');
  }
}

async function loadSource(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, width: bitmap.width, height: bitmap.height };
      } catch {
        // Fall through to the <img> path.
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No pudimos leer la imagen.'));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitWithin(width: number, height: number, maxEdge: number) {
  if (width <= maxEdge && height <= maxEdge) return { width, height };
  const ratio = Math.min(maxEdge / width, maxEdge / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function drawSource(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No pudimos procesar la imagen.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No pudimos comprimir la imagen.'));
      },
      type,
      quality,
    );
  });
}

async function encodeBestEffort(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  if (!blob.type.includes('webp')) {
    blob = await canvasToBlob(canvas, 'image/jpeg', Math.max(0.7, quality));
  }
  return blob;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No pudimos generar la miniatura.'));
    reader.readAsDataURL(blob);
  });
}

async function buildThumbnail(
  source: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
): Promise<string> {
  const attempts = [
    { edge: THUMB_EDGE, quality: 0.72 },
    { edge: 240, quality: 0.6 },
    { edge: 200, quality: 0.52 },
  ];

  let smallest: string | null = null;
  for (const attempt of attempts) {
    const size = fitWithin(sourceWidth, sourceHeight, attempt.edge);
    const canvas = drawSource(source, size.width, size.height);
    const blob = await encodeBestEffort(canvas, attempt.quality);
    const dataUrl = await readAsDataUrl(blob);
    smallest = dataUrl;
    if (dataUrl.length <= MAX_THUMB_DATA_URL_LENGTH) return dataUrl;
  }

  if (!smallest) throw new Error('No pudimos generar la miniatura.');
  return smallest;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  assertImageFile(file);
  const { source, width, height } = await loadSource(file);

  try {
    const fullSize = fitWithin(width, height, MAX_PHOTO_EDGE);
    const fullCanvas = drawSource(source, fullSize.width, fullSize.height);

    let blob = await encodeBestEffort(fullCanvas, 0.82);
    if (blob.size > 900 * 1024) {
      blob = await encodeBestEffort(fullCanvas, 0.7);
    }
    if (blob.size > 1.6 * 1024 * 1024) {
      const smaller = fitWithin(width, height, 900);
      const smallerCanvas = drawSource(source, smaller.width, smaller.height);
      blob = await encodeBestEffort(smallerCanvas, 0.68);
    }

    const thumbDataUrl = await buildThumbnail(source, width, height);

    return {
      blob,
      thumbDataUrl,
      width: fullSize.width,
      height: fullSize.height,
      mimeType: blob.type || 'image/webp',
      byteSize: blob.size,
    };
  } finally {
    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }
  }
}
