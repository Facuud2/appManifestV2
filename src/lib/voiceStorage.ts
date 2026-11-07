import { VoiceProfileMeta, CalibrationPhrase } from '@/types';

export const CALIBRATION_PHRASES: CalibrationPhrase[] = [
  {
    id: 1,
    text: 'Soy dueño de mi propia realidad y todo lo que deseo me desea más a mí.',
    focus: 'Autoconcepto y Pedestal',
  },
  {
    id: 2,
    text: 'Soy siempre la primera opción, mi atención es única y muy valiosa.',
    focus: 'Certeza y Elección',
  },
  {
    id: 3,
    text: 'Soy amado, soy elegido y todas mis relaciones funcionan exactamente como quiero.',
    focus: 'Vínculos y Asunción',
  },
];

const DB_NAME = 'manifest_voice_db';
const DB_VERSION = 2;
const STORE_NAME = 'voice_samples';
const AUDIO_CACHE_STORE = 'audio_cache';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(AUDIO_CACHE_STORE)) {
          db.createObjectStore(AUDIO_CACHE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Generates deterministic SHA-256 hash: sha256(profileId + ":" + affirmation.trim().toLowerCase())
 */
export async function computeAffirmationHash(
  profileId: string,
  affirmation: string
): Promise<string> {
  const normalized = `${profileId.trim().toLowerCase()}:${affirmation.trim().toLowerCase()}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')) // taste-skill-ignore
      .join('');
  }
  // Fallback deterministic hash if crypto.subtle is unavailable
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0, ch; i < normalized.length; i++) {
    ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

/**
 * Retrieve cached synthesized WAV buffer from IndexedDB by deterministic SHA-256 hash
 */
export async function getCachedAffirmationAudio(hash: string): Promise<ArrayBuffer | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUDIO_CACHE_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_CACHE_STORE);
      const req = store.get(hash);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) {
          resolve(null);
          return;
        }
        if (res instanceof ArrayBuffer) {
          resolve(res.slice(0));
          return;
        }
        if (res instanceof Blob) {
          res.arrayBuffer().then(resolve).catch(() => resolve(null));
          return;
        }
        if (res.wavBuffer instanceof ArrayBuffer) {
          resolve(res.wavBuffer.slice(0));
          return;
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save synthesized WAV buffer permanently in IndexedDB by deterministic SHA-256 hash
 */
export async function saveCachedAffirmationAudio(
  hash: string,
  wavBuffer: ArrayBuffer,
  meta?: { profileId: string; text: string }
): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUDIO_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_CACHE_STORE);
      const payload = {
        hash,
        wavBuffer: wavBuffer.slice(0),
        profileId: meta?.profileId || 'facu',
        text: meta?.text || '',
        createdAt: new Date().toISOString(),
      };
      const req = store.put(payload, hash);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Detect fundamental frequency (F0) and pitch multiplier using autocorrelation
 */
export function detectPitchFromAudioBuffer(audioBuffer: AudioBuffer): {
  f0: number;
  pitchRate: number;
} {
  try {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.min(channelData.length, 4096);
    if (windowSize < 512) return { f0: 160, pitchRate: 1.0 };

    let bestOffset = 0;
    let maxRms = 0;
    const step = 256;
    for (let offset = 0; offset + windowSize < channelData.length; offset += step) {
      let sum = 0;
      for (let i = 0; i < windowSize; i += 4) {
        sum += channelData[offset + i] * channelData[offset + i];
      }
      const rms = Math.sqrt(sum / (windowSize / 4));
      if (rms > maxRms) {
        maxRms = rms;
        bestOffset = offset;
      }
    }

    const minPeriod = Math.floor(sampleRate / 320);
    const maxPeriod = Math.floor(sampleRate / 70);

    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      let corr = 0;
      let norm1 = 0;
      let norm2 = 0;
      for (let i = 0; i < windowSize - lag; i += 2) {
        const s1 = channelData[bestOffset + i];
        const s2 = channelData[bestOffset + i + lag];
        corr += s1 * s2;
        norm1 += s1 * s1;
        norm2 += s2 * s2;
      }
      const denom = Math.sqrt(norm1 * norm2);
      const coeff = denom > 0.0001 ? corr / denom : 0;
      if (coeff > bestCorr) {
        bestCorr = coeff;
        bestLag = lag;
      }
    }

    if (bestCorr > 0.4 && bestLag > 0) {
      const f0 = Math.round(sampleRate / bestLag);
      const clampedF0 = Math.max(80, Math.min(280, f0));
      const pitchRate = 0.85 + ((clampedF0 - 80) / (280 - 80)) * 0.3;
      return { f0: clampedF0, pitchRate: Number(pitchRate.toFixed(2)) };
    }
  } catch (e) {
    console.warn('[voiceStorage] Pitch detection fallback:', e);
  }
  return { f0: 160, pitchRate: 1.0 };
}

export async function convertRecordingToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frameCount = Math.ceil(decoded.duration * 24000);
    const offlineContext = new OfflineAudioContext(1, frameCount, 24000);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start();

    const mono = await offlineContext.startRendering();
    const samples = mono.getChannelData(0);
    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    const writeString = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return new Blob([wav], { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

export async function saveProfileAudioSample(
  userId: 'facu' | 'maia',
  audioBlob: Blob
): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const key = `sample_${userId}`;
      const req = store.put(audioBlob, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getProfileAudioSample(
  userId: 'facu' | 'maia'
): Promise<Blob | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const key = `sample_${userId}`;
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function saveVoiceProfileMeta(
  userId: 'facu' | 'maia',
  meta: VoiceProfileMeta
): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(`manifest_voice_profile_${userId}`, JSON.stringify(meta));
  } catch (e) {
    console.warn('[voiceStorage] Error saving meta:', e);
  }
}

export function getVoiceProfileMeta(
  userId: 'facu' | 'maia'
): VoiceProfileMeta | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(`manifest_voice_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isProfileCalibrated(userId: 'facu' | 'maia'): boolean {
  const profile = getVoiceProfileMeta(userId);
  return Boolean(profile?.isCalibrated);
}

export function detectAutomatedSandbox(): boolean {
  if (!isBrowser()) return false;
  try {
    const saved = localStorage.getItem('manifest_ai_sandbox');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return Boolean(navigator.webdriver);
  } catch {
    return Boolean(typeof navigator !== 'undefined' && navigator.webdriver);
  }
}
