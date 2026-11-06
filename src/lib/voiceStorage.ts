import { VoiceProfileMeta, CalibrationPhrase } from '@/types';

export const CALIBRATION_PHRASES: CalibrationPhrase[] = [
  {
    id: 1,
    text: 'Merezco todo lo bueno y me permito recibirlo con profunda gratitud.',
    focus: 'Merecimiento y Paz',
  },
  {
    id: 2,
    text: 'Cada paso que doy abre puertas de sincronicidad y abundancia.',
    focus: 'Alineación y Confianza',
  },
  {
    id: 3,
    text: 'Mi realidad refleja la certeza y serenidad de mi mente.',
    focus: 'Poder de Creación',
  },
];

const DB_NAME = 'manifest_voice_db';
const DB_VERSION = 1;
const STORE_NAME = 'voice_samples';

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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
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
      // Map f0 to SpeechSynthesis pitch rate (0.85 to 1.15)
      const clampedF0 = Math.max(80, Math.min(280, f0));
      const pitchRate = 0.85 + ((clampedF0 - 80) / (280 - 80)) * 0.3;
      return { f0: clampedF0, pitchRate: Number(pitchRate.toFixed(2)) };
    }
  } catch (e) {
    console.warn('[voiceStorage] Pitch detection fallback:', e);
  }
  return { f0: 160, pitchRate: 1.0 };
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
