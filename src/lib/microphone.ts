/**
 * iOS Safari / WebKit Compliant Microphone Utilities
 *
 * WebKit on iOS has specific requirements:
 * 1. navigator.mediaDevices is only available in secure contexts (HTTPS or localhost).
 * 2. Overconstrained audio constraints (e.g. autoGainControl, noiseSuppression) frequently
 *    throw OverconstrainedError on iOS devices. We fall back to basic { audio: true }.
 * 3. AnalyserNode connected to a MediaStreamSource does NOT process audio in WebKit unless
 *    the graph connects to ctx.destination. We connect via a silent GainNode (gain = 0).
 * 4. MediaRecorder mimeType: iOS Safari does not support audio/webm; it uses audio/mp4 or audio/aac.
 * 5. Gemini API expects audio/mp4 (NOT audio/m4a).
 */

export async function getMicrophoneStream(constraints?: MediaTrackConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined') {
    throw new Error('El navegador no está disponible.');
  }

  // Check for secure context (crucial for iOS Safari)
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error('En iOS Safari el micrófono requiere una conexión HTTPS segura (o localhost).');
  }

  const getMedia =
    navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
    (navigator as any).webkitGetUserMedia?.bind(navigator) ||
    (navigator as any).mozGetUserMedia?.bind(navigator) ||
    (navigator as any).getUserMedia?.bind(navigator);

  if (!getMedia) {
    throw new Error('Este navegador o entorno no admite acceso al micrófono.');
  }

  // 1. Try with preferred constraints if provided, or iOS-safe echo cancellation
  try {
    return await getMedia({
      audio: constraints || {
        echoCancellation: true,
      },
    });
  } catch (err: any) {
    // If permission was denied by the user, don't retry with audio: true as it will just fail again
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      throw err;
    }

    console.warn('[Microphone] Preferred constraints failed on this device, falling back to audio: true', err);

    // 2. Guaranteed fallback on iOS WebKit
    return await getMedia({ audio: true });
  }
}

/**
 * Returns the best supported audio MIME type for MediaRecorder on the current device.
 * iOS Safari natively uses audio/mp4 or audio/aac.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }

  return '';
}

/**
 * Safely creates a MediaRecorder instance with optimal iOS Safari fallbacks.
 */
export function createSafeMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mimeType: string;
} {
  const mimeType = getSupportedAudioMimeType();
  const options: MediaRecorderOptions = {};

  if (mimeType) {
    options.mimeType = mimeType;
    if (mimeType.includes('webm')) {
      options.audioBitsPerSecond = 32000;
    }
  }

  try {
    const recorder = mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
    return { recorder, mimeType: recorder.mimeType || mimeType };
  } catch (err) {
    console.warn('[Microphone] Custom MediaRecorder options failed, falling back to default', err);
    const recorder = new MediaRecorder(stream);
    return { recorder, mimeType: recorder.mimeType || '' };
  }
}

/**
 * Connects a MediaStream to an AnalyserNode with iOS WebKit graph keep-alive.
 * (WebKit bug #172565: AnalyserNode receives 0 on iOS unless graph terminates at destination).
 */
export function connectAudioAnalyser(
  ctx: AudioContext,
  stream: MediaStream
): {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  silentGain: GainNode;
} {
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.8;

  // WebKit requires destination connection to pump audio through AnalyserNode
  const silentGain = ctx.createGain();
  silentGain.gain.value = 0;

  source.connect(analyser);
  analyser.connect(silentGain);
  silentGain.connect(ctx.destination);

  return { analyser, source, silentGain };
}
