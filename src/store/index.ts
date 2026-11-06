import { create } from 'zustand';
import {
  UserScope,
  Goal,
  JournalEntry,
  ManifestationSign,
  SuccessStory,
  Affirmation,
  RampageSet,
  AmbientSoundType,
  VoiceProfileMeta,
} from '@/types';
import {
  getVoiceProfileMeta,
  isProfileCalibrated,
  saveVoiceProfileMeta,
} from '@/lib/voiceStorage';
import {
  DEFAULT_AFFIRMATIONS,
  DEFAULT_RAMPAGE_SETS,
  mergeDefaultAffirmations,
  mergeDefaultRampageSets,
} from '@/lib/affirmationEngine';

export interface ProgressLog {
  id: string;
  manifestationId?: string;
  userId: UserScope;
  note: string;
  signType?: string;
  voiceTranscript?: string;
  createdAt: string;
}

export interface ManifestationItem {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  description: string;
  sensoryAnchor?: string;
  category?: string;
  status: 'semilla' | 'alineacion' | 'evidencia' | 'materializado';
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  activeScope: UserScope;
  setActiveScope: (scope: UserScope) => void;
  isVoiceCaptureLocked: boolean;
  setVoiceCaptureLocked: (locked: boolean) => void;

  // Theme mode (Liquid Glass light / dark / system)
  themeMode: 'system' | 'light' | 'dark';
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void;

  // Domain collections
  manifestations: ManifestationItem[];
  progressLogs: ProgressLog[];
  successStories: SuccessStory[];
  affirmations: Affirmation[];
  rampageSets: RampageSet[];

  // Ambient sound preference
  ambientSound: AmbientSoundType;
  setAmbientSound: (sound: AmbientSoundType) => void;

  // Voice calibration states
  isFacuCalibrated: boolean;
  isMaiaCalibrated: boolean;
  refreshVoiceCalibrationStatus: () => void;

  // Synchronization
  isLoading: boolean;
  fetchRemoteData: () => Promise<void>;

  // Actions
  addManifestation: (item: Omit<ManifestationItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ManifestationItem>;
  updateManifestationStatus: (id: string, status: ManifestationItem['status']) => Promise<void>;
  deleteManifestation: (id: string) => Promise<void>;

  addProgressLog: (log: Omit<ProgressLog, 'id' | 'createdAt'>) => Promise<ProgressLog>;
  deleteProgressLog: (id: string) => Promise<void>;

  addSuccessStory: (story: Omit<SuccessStory, 'id' | 'createdAt'>) => Promise<SuccessStory>;
  deleteSuccessStory: (id: string) => Promise<void>;

  addAffirmation: (text: string) => Promise<Affirmation>;
  togglePinAffirmation: (id: string) => Promise<void>;
  incrementAffirmationRepeat: (id: string) => Promise<void>;
  deleteAffirmation: (id: string) => Promise<void>;

  saveRampageSet: (
    rampage: Omit<RampageSet, 'id' | 'createdAt'> &
      Partial<Pick<RampageSet, 'id' | 'createdAt'>>
  ) => Promise<RampageSet>;
  deleteRampageSet: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeScope: 'facu',
  setActiveScope: (scope) => {
    if (get().isVoiceCaptureLocked) return;
    set({ activeScope: scope });
    get().fetchRemoteData();
  },
  isVoiceCaptureLocked: false,
  setVoiceCaptureLocked: (isVoiceCaptureLocked) => set({ isVoiceCaptureLocked }),

  themeMode: 'system',
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    if (typeof window !== 'undefined') {
      localStorage.setItem('manifest_theme_mode', mode);
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        meta.content = isDark ? '#171014' : '#fdf4f7';
      });
    }
  },

  manifestations: [],
  progressLogs: [],
  successStories: [],
  affirmations: DEFAULT_AFFIRMATIONS,
  rampageSets: DEFAULT_RAMPAGE_SETS,

  ambientSound: 'astral_rain',
  setAmbientSound: (ambientSound) => {
    set({ ambientSound });
    if (typeof window !== 'undefined') {
      localStorage.setItem('manifest_ambient_sound', ambientSound);
    }
  },

  isFacuCalibrated: false,
  isMaiaCalibrated: false,
  refreshVoiceCalibrationStatus: () => {
    if (typeof window !== 'undefined') {
      set({
        isFacuCalibrated: isProfileCalibrated('facu'),
        isMaiaCalibrated: isProfileCalibrated('maia'),
      });
    }
  },

  isLoading: false,

  fetchRemoteData: async () => {
    try {
      set({ isLoading: true });
      const scope = get().activeScope;
      const res = await fetch(`/api/sync?scope=${scope}&t=${Date.now()}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Sync failed with status ${res.status}`);
      }

      set({
        manifestations: json.data.manifestations || [],
        progressLogs: json.data.progressLogs || [],
        successStories: json.data.successStories || [],
        affirmations: mergeDefaultAffirmations(json.data.affirmations || []),
        rampageSets: mergeDefaultRampageSets(json.data.rampageSets || []),
      });
      for (const profile of json.data.profiles || []) {
        if (
          (profile.id === 'facu' || profile.id === 'maia') &&
          profile.voiceToneProfile?.isCalibrated
        ) {
          saveVoiceProfileMeta(profile.id, profile.voiceToneProfile);
        }
      }
    } catch (e) {
      console.warn('[Store] Sync error:', e);
    } finally {
      set({ isLoading: false });
      get().refreshVoiceCalibrationStatus();
    }
  },

  addManifestation: async (item) => {
    const id = `manif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newItem: ManifestationItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      manifestations: [newItem, ...state.manifestations],
    }));

    // Async push to Turso
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'manifestation', action: 'save', data: newItem }),
    }).catch(console.error);

    return newItem;
  },

  updateManifestationStatus: async (id, status) => {
    const manifestations = get().manifestations.map((m) =>
      m.id === id ? { ...m, status, updatedAt: new Date().toISOString() } : m
    );
    set({ manifestations });

    const target = manifestations.find((m) => m.id === id);
    if (target) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'manifestation', action: 'save', data: target }),
      }).catch(console.error);
    }
  },

  deleteManifestation: async (id) => {
    set((state) => ({
      manifestations: state.manifestations.filter((m) => m.id !== id),
      progressLogs: state.progressLogs.filter((p) => p.manifestationId !== id),
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'manifestation', action: 'delete', id }),
    }).catch(console.error);
  },

  addProgressLog: async (log) => {
    const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newLog: ProgressLog = { ...log, id, createdAt: now };

    set((state) => ({
      progressLogs: [newLog, ...state.progressLogs],
    }));

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'progress', action: 'save', data: newLog }),
      });
      if (!response.ok) {
        throw new Error(`Progress save failed with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Progress save failed');
      }
    } catch (error) {
      set((state) => ({
        progressLogs: state.progressLogs.filter((item) => item.id !== id),
      }));
      throw error;
    }

    return newLog;
  },

  deleteProgressLog: async (id) => {
    set((state) => ({
      progressLogs: state.progressLogs.filter((p) => p.id !== id),
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'progress', action: 'delete', id }),
    }).catch(console.error);
  },

  addSuccessStory: async (story) => {
    const id = `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newStory: SuccessStory = { ...story, id, createdAt: now };

    set((state) => ({
      successStories: [newStory, ...state.successStories],
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'story', action: 'save', data: newStory }),
    }).catch(console.error);

    return newStory;
  },

  deleteSuccessStory: async (id) => {
    set((state) => ({
      successStories: state.successStories.filter((s) => s.id !== id),
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'story', action: 'delete', id }),
    }).catch(console.error);
  },

  addAffirmation: async (text) => {
    const id = `aff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const scope = get().activeScope;
    const author = scope === 'maia' ? 'Maia' : scope === 'facu' ? 'Facu' : 'Ambos';

    const newAff: Affirmation = {
      id,
      userId: scope,
      author,
      text,
      repeatCount: 0,
      pinned: false,
      createdAt: now,
    };

    set((state) => ({
      affirmations: [newAff, ...state.affirmations],
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'affirmation', action: 'save', data: newAff }),
    }).catch(console.error);

    return newAff;
  },

  togglePinAffirmation: async (id) => {
    const affirmations = get().affirmations.map((a) =>
      a.id === id ? { ...a, pinned: !a.pinned } : a
    );
    set({ affirmations });

    const target = affirmations.find((a) => a.id === id);
    if (target) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'affirmation', action: 'save', data: target }),
      }).catch(console.error);
    }
  },

  incrementAffirmationRepeat: async (id) => {
    const affirmations = get().affirmations.map((a) =>
      a.id === id ? { ...a, repeatCount: a.repeatCount + 1 } : a
    );
    set({ affirmations });

    const target = affirmations.find((a) => a.id === id);
    if (target) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'affirmation', action: 'save', data: target }),
      }).catch(console.error);
    }
  },

  deleteAffirmation: async (id) => {
    set((state) => ({
      affirmations: state.affirmations.filter((a) => a.id !== id),
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'affirmation', action: 'delete', id }),
    }).catch(console.error);
  },

  saveRampageSet: async (rampage) => {
    const now = new Date().toISOString();
    const newSet: RampageSet = {
      ...rampage,
      id: rampage.id || `rampage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: rampage.createdAt || now,
      updatedAt: now,
    };

    set((state) => ({
      rampageSets: [
        newSet,
        ...state.rampageSets.filter((rampageSet) => rampageSet.id !== newSet.id),
      ],
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'rampageSet', action: 'save', data: newSet }),
    }).catch(console.error);

    return newSet;
  },

  deleteRampageSet: async (id) => {
    set((state) => ({
      rampageSets: state.rampageSets.filter((r) => r.id !== id),
    }));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'rampageSet', action: 'delete', id }),
    }).catch(console.error);
  },
}));
