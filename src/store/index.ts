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
  SongAttachment,
  MediaAttachment,
} from '@/types';
import { deleteMedia } from '@/lib/mediaStorage';
import { createManifestationId } from '@/lib/manifestationAttachments';
import {
  detectAutomatedSandbox,
  getVoiceProfileMeta,
  isProfileCalibrated,
  saveVoiceProfileMeta,
} from '@/lib/voiceStorage';
import {
  DEFAULT_AFFIRMATIONS,
  DEFAULT_RAMPAGE_SETS,
  mergeDefaultAffirmations,
  mergeDefaultRampageSets,
  sortAffirmations,
} from '@/lib/affirmationEngine';
import {
  WORST_CASE_AFFIRMATIONS,
  WORST_CASE_MANIFESTATIONS,
  WORST_CASE_PROGRESS_LOGS,
  WORST_CASE_SUCCESS_STORIES,
  ONE_ITEM_AFFIRMATION,
  ONE_ITEM_MANIFESTATION,
  ONE_ITEM_PROGRESS,
  ONE_ITEM_STORY,
  generateThousandAffirmations,
  generateThousandManifestations,
} from '@/lib/worstCaseFixtures';
import type { NarrativeCommitResult } from '@/lib/narrativeOrganizer';

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
  repeatCount?: number;
  songAttachment?: SongAttachment | null;
  mediaAttachment?: MediaAttachment | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Guards the sync response against out-of-order requests. When a user switches
 * profiles quickly, only the response for the latest scope may write to state.
 */
let syncRequestSequence = 0;

/**
 * Browser chrome follows the active profile palette: sage garden for Facu,
 * plum/rose for Maia and shared.
 */
const resolveThemeColor = (scope: UserScope, isDark: boolean) => {
  if (scope === 'facu') return isDark ? '#121014' : '#f1f1ef';
  return isDark ? '#171014' : '#fdf4f7';
};

const applyScopeChrome = (scope: UserScope, isDark: boolean) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.scope = scope;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = resolveThemeColor(scope, isDark);
  });
};

const getAffirmationOrderStorageKey = (scope: UserScope) =>
  `manifest_affirmation_order_${scope}`;

const readLocalAffirmationOrder = (
  scope: UserScope
): Record<string, { order: number; pinned?: boolean }> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getAffirmationOrderStorageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalAffirmationOrder = (scope: UserScope, items: Affirmation[]) => {
  if (typeof window === 'undefined') return;
  try {
    const map: Record<string, { order: number; pinned: boolean }> = {};
    items.forEach((item, index) => {
      map[item.id] = {
        order: typeof item.order === 'number' ? item.order : index,
        pinned: Boolean(item.pinned),
      };
    });
    window.localStorage.setItem(getAffirmationOrderStorageKey(scope), JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
};

interface ProfileCollections {
  manifestations: ManifestationItem[];
  progressLogs: ProgressLog[];
  successStories: SuccessStory[];
  affirmations: Affirmation[];
  rampageSets: RampageSet[];
}

const createInitialScopeCollections = (): Record<UserScope, ProfileCollections> => ({
  facu: {
    manifestations: [],
    progressLogs: [],
    successStories: [],
    affirmations: DEFAULT_AFFIRMATIONS.filter((item) => item.userId === 'facu'),
    rampageSets: DEFAULT_RAMPAGE_SETS.filter((item) => item.userId === 'facu'),
  },
  maia: {
    manifestations: [],
    progressLogs: [],
    successStories: [],
    affirmations: [],
    rampageSets: [],
  },
  shared: {
    manifestations: [],
    progressLogs: [],
    successStories: [],
    affirmations: [],
    rampageSets: [],
  },
});

const syncAffirmationOrderToServer = (scope: UserScope, items: Affirmation[]) => {
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: 'affirmation',
      action: 'reorder',
      scope,
      items: items
        .filter((item) => item.userId === scope)
        .map((item, index) => ({
          id: item.id,
          userId: scope,
          order: typeof item.order === 'number' ? item.order : index,
          pinned: Boolean(item.pinned),
        })),
    }),
  }).catch(console.error);
};

interface AppState {
  activeScope: UserScope;
  setActiveScope: (scope: UserScope) => void;
  isScopeRegenerating: boolean;
  setScopeRegenerating: (regenerating: boolean) => void;
  isVoiceCaptureLocked: boolean;
  setVoiceCaptureLocked: (locked: boolean) => void;

  // Theme mode (Liquid Glass light / dark / system)
  themeMode: 'system' | 'light' | 'dark';
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void;

  // Domain collections (active profile)
  manifestations: ManifestationItem[];
  progressLogs: ProgressLog[];
  successStories: SuccessStory[];
  affirmations: Affirmation[];
  rampageSets: RampageSet[];
  scopeCollections: Record<UserScope, ProfileCollections>;

  // Ambient sound preference
  ambientSound: AmbientSoundType;
  setAmbientSound: (sound: AmbientSoundType) => void;

  // Voice calibration states
  isFacuCalibrated: boolean;
  isMaiaCalibrated: boolean;
  refreshVoiceCalibrationStatus: () => void;

  // Tier 1 Quota & Sandbox Mode Protection
  aiRequestsToday: number;
  aiDailyLimit: number;
  isSandboxMode: boolean;
  setSandboxMode: (enabled: boolean) => void;
  setAiRequestsToday: (count: number) => void;
  incrementAiRequestsToday: (delta?: number) => void;

  // Synchronization
  isLoading: boolean;
  fetchRemoteData: () => Promise<void>;
  /**
   * Merges an AI narrative commit into the local cache. The commit route
   * already persisted everything atomically, so this is a UI-only merge.
   */
  applyNarrativeCommit: (result: NarrativeCommitResult) => void;

  // Dev Edge-Case Testing (break-ui)
  fixtureMode: 'demo' | 'worst' | 'empty' | 'one' | 'thousand';
  setFixtureMode: (mode: 'demo' | 'worst' | 'empty' | 'one' | 'thousand') => void;

  // Actions
  addManifestation: (
    item: Omit<ManifestationItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<ManifestationItem>;
  updateManifestationStatus: (id: string, status: ManifestationItem['status']) => Promise<void>;
  incrementManifestationRepeat: (id: string) => Promise<void>;
  deleteManifestation: (id: string) => Promise<void>;

  addProgressLog: (log: Omit<ProgressLog, 'id' | 'createdAt'>) => Promise<ProgressLog>;
  deleteProgressLog: (id: string) => Promise<void>;

  addSuccessStory: (story: Omit<SuccessStory, 'id' | 'createdAt'>) => Promise<SuccessStory>;
  deleteSuccessStory: (id: string) => Promise<void>;

  addAffirmation: (text: string) => Promise<Affirmation>;
  togglePinAffirmation: (id: string) => Promise<void>;
  reorderAffirmations: (activeId: string, overId: string) => void;
  moveAffirmation: (id: string, direction: 'up' | 'down') => Promise<void>;
  commitAffirmationOrder: () => Promise<void>;
  incrementAffirmationRepeat: (id: string) => Promise<void>;
  deleteAffirmation: (id: string) => Promise<void>;

  saveRampageSet: (
    rampage: Omit<RampageSet, 'id' | 'createdAt'> &
      Partial<Pick<RampageSet, 'id' | 'createdAt'>>
  ) => Promise<RampageSet>;
  deleteRampageSet: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => {
  const initialCollections = createInitialScopeCollections();
  return {
    activeScope: 'facu',
    isScopeRegenerating: false,
    setScopeRegenerating: (isScopeRegenerating) => set({ isScopeRegenerating }),
    setActiveScope: (scope) => {
      const state = get();
      if (state.isVoiceCaptureLocked || state.activeScope === scope) return;
      const previousScope = state.activeScope;
      const updatedCollections: Record<UserScope, ProfileCollections> = {
        ...state.scopeCollections,
        [previousScope]: {
          manifestations: state.manifestations.filter((item) => item.userId === previousScope),
          progressLogs: state.progressLogs.filter((item) => item.userId === previousScope),
          successStories: state.successStories.filter((item) => item.userId === previousScope),
          affirmations: state.affirmations.filter((item) => item.userId === previousScope),
          rampageSets: state.rampageSets.filter((item) => item.userId === previousScope),
        },
      };
      const nextSlice = updatedCollections[scope];
      set({
        activeScope: scope,
        isScopeRegenerating: true,
        scopeCollections: updatedCollections,
        manifestations: nextSlice.manifestations,
        progressLogs: nextSlice.progressLogs,
        successStories: nextSlice.successStories,
        affirmations: nextSlice.affirmations,
        rampageSets: nextSlice.rampageSets,
      });
      if (typeof document !== 'undefined') {
        applyScopeChrome(scope, document.documentElement.classList.contains('dark'));
      }
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
        applyScopeChrome(get().activeScope, isDark);
      }
    },

    manifestations: initialCollections.facu.manifestations,
    progressLogs: initialCollections.facu.progressLogs,
    successStories: initialCollections.facu.successStories,
    affirmations: initialCollections.facu.affirmations,
    rampageSets: initialCollections.facu.rampageSets,
    scopeCollections: initialCollections,

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
          isSandboxMode: detectAutomatedSandbox(),
        });
      }
    },

    aiRequestsToday: 0,
    aiDailyLimit: 100,
    isSandboxMode: false,
    setSandboxMode: (enabled) => {
      set({ isSandboxMode: enabled });
      if (typeof window !== 'undefined') {
        localStorage.setItem('manifest_ai_sandbox', enabled ? 'true' : 'false');
      }
    },
    setAiRequestsToday: (count) => {
      if (Number.isFinite(count) && count >= 0) {
        set({ aiRequestsToday: count });
      }
    },
    incrementAiRequestsToday: (delta = 1) => {
      set((state) => ({
        aiRequestsToday: Math.max(0, state.aiRequestsToday + delta),
      }));
    },

    isLoading: false,
    fixtureMode: 'demo',

    setFixtureMode: (mode) => {
      set({ fixtureMode: mode });
      const scope = get().activeScope;
      if (mode === 'demo') {
        void get().fetchRemoteData();
        return;
      }
      if (mode === 'worst') {
        const worstManifs = WORST_CASE_MANIFESTATIONS.map((m) => ({ ...m, userId: scope }));
        const worstAffs = WORST_CASE_AFFIRMATIONS.map((a) => ({ ...a, userId: scope }));
        const worstLogs = WORST_CASE_PROGRESS_LOGS.map((p) => ({ ...p, userId: scope }));
        const worstStories = WORST_CASE_SUCCESS_STORIES.map((s) => ({ ...s, userId: scope }));
        set({
          manifestations: worstManifs,
          affirmations: worstAffs,
          progressLogs: worstLogs,
          successStories: worstStories,
        });
        return;
      }
      if (mode === 'empty') {
        set({
          manifestations: [],
          affirmations: [],
          progressLogs: [],
          successStories: [],
        });
        return;
      }
      if (mode === 'one') {
        set({
          manifestations: [{ ...ONE_ITEM_MANIFESTATION, userId: scope }],
          affirmations: [{ ...ONE_ITEM_AFFIRMATION, userId: scope }],
          progressLogs: [{ ...ONE_ITEM_PROGRESS, userId: scope }],
          successStories: [{ ...ONE_ITEM_STORY, userId: scope }],
        });
        return;
      }
      if (mode === 'thousand') {
        const thousandManifs = generateThousandManifestations().map((m) => ({ ...m, userId: scope }));
        const thousandAffs = generateThousandAffirmations().map((a) => ({ ...a, userId: scope }));
        set({
          manifestations: thousandManifs,
          affirmations: thousandAffs,
          progressLogs: [],
          successStories: [],
        });
        return;
      }
    },

    fetchRemoteData: async () => {
      if (get().fixtureMode !== 'demo') return;
      const requestId = ++syncRequestSequence;
      const scope = get().activeScope;
      try {
        set({ isLoading: true });
        const res = await fetch(`/api/sync?scope=${scope}&t=${Date.now()}`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `Sync failed with status ${res.status}`);
        }

        // A newer switch already owns the screen. Drop this response silently.
        if (requestId !== syncRequestSequence || get().activeScope !== scope) {
          return;
        }

        const scopedManifestations: ManifestationItem[] = (json.data.manifestations || []).filter(
          (item: ManifestationItem) => item.userId === scope
        );
        const manifestationIds = new Set(scopedManifestations.map((m) => m.id));

        const scopedProgressLogs: ProgressLog[] = (json.data.progressLogs || []).filter(
          (item: ProgressLog) =>
            item.userId === scope &&
            (!item.manifestationId || manifestationIds.has(item.manifestationId))
        );

        const scopedSuccessStories: SuccessStory[] = (json.data.successStories || []).filter(
          (item: SuccessStory) =>
            item.userId === scope &&
            (!item.manifestationId || manifestationIds.has(item.manifestationId))
        );

        const localOrderMap = readLocalAffirmationOrder(scope);
        const mergedAffirmations = mergeDefaultAffirmations(
          (json.data.affirmations || [])
            .filter((item: Affirmation) => item.userId === scope)
            .map((item: Affirmation, index: number) => {
              const localEntry = localOrderMap[item.id];
              return {
                ...item,
                pinned:
                  typeof item.pinned === 'boolean'
                    ? item.pinned
                    : Boolean(localEntry?.pinned),
                order:
                  typeof localEntry?.order === 'number'
                    ? localEntry.order
                    : typeof item.order === 'number'
                      ? item.order
                      : index,
              };
            }),
          scope
        );

        const mergedRampageSets = mergeDefaultRampageSets(
          (json.data.rampageSets || []).filter((item: RampageSet) => item.userId === scope),
          scope
        );

        set((state) => ({
          manifestations: scopedManifestations,
          progressLogs: scopedProgressLogs,
          successStories: scopedSuccessStories,
          affirmations: mergedAffirmations,
          rampageSets: mergedRampageSets,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              manifestations: scopedManifestations,
              progressLogs: scopedProgressLogs,
              successStories: scopedSuccessStories,
              affirmations: mergedAffirmations,
              rampageSets: mergedRampageSets,
            },
          },
          aiRequestsToday:
            typeof json.data.aiUsageToday === 'number'
              ? json.data.aiUsageToday
              : state.aiRequestsToday,
          aiDailyLimit:
            typeof json.data.aiDailyLimit === 'number' ? json.data.aiDailyLimit : 100,
        }));
        for (const profile of json.data.profiles || []) {
          if (
            (profile.id === 'facu' || profile.id === 'maia') &&
            profile.voiceToneProfile?.isCalibrated
          ) {
            saveVoiceProfileMeta(profile.id, profile.voiceToneProfile);
          }
        }
      } catch (e) {
        if (requestId === syncRequestSequence) {
          console.warn('[Store] Sync error:', e);
        }
      } finally {
        // Only the latest request is allowed to settle the loading flag.
        if (requestId === syncRequestSequence) {
          set({ isLoading: false });
          get().refreshVoiceCalibrationStatus();
        }
      }
    },

    applyNarrativeCommit: (result) => {
      const scope = result.profileId as UserScope;

      set((state) => {
        const previous = state.scopeCollections[scope];

        const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
          if (incoming.length === 0) return current;
          const byId = new Map(current.map((item) => [item.id, item]));
          incoming.forEach((item) => byId.set(item.id, item));
          const incomingIds = new Set(incoming.map((item) => item.id));
          const merged = Array.from(byId.values());
          // Keep fresh items on top of the lists that read newest-first.
          merged.sort((a, b) => {
            const aNew = incomingIds.has(a.id) ? 0 : 1;
            const bNew = incomingIds.has(b.id) ? 0 : 1;
            return aNew - bNew;
          });
          return merged;
        };

        const manifestations = mergeById(
          previous.manifestations,
          result.manifestations.map(({ tempId: _tempId, ...item }) => item)
        );

        const progressLogs = mergeById(
          previous.progressLogs,
          result.progressLogs.map(({ tempId: _tempId, ...item }) => ({
            ...item,
            manifestationId: item.manifestationId ?? undefined,
            signType: item.signType ?? undefined,
            voiceTranscript: item.voiceTranscript ?? undefined,
          }))
        );

        const successStories = mergeById(
          previous.successStories,
          result.successStories.map(({ tempId: _tempId, ...item }) => ({
            ...item,
            manifestationId: item.manifestationId ?? undefined,
          }))
        );

        const affirmations = sortAffirmations(
          mergeById(
            previous.affirmations,
            result.affirmations.map(({ tempId: _tempId, ...item }) => item)
          )
        );

        let finalAffirmations = affirmations;
        if (result.repeatedAffirmations && result.repeatedAffirmations.length > 0) {
          const repeatMap = new Map(result.repeatedAffirmations.map((r) => [r.id, r.repeatCount]));
          finalAffirmations = affirmations.map((a) => {
            if (repeatMap.has(a.id)) {
              return { ...a, repeatCount: repeatMap.get(a.id)! };
            }
            return a;
          });
        }

        // A success story marks its manifestation as materialized.
        const materializedIds = new Set(
          result.successStories
            .map((story) => story.manifestationId)
            .filter((id): id is string => Boolean(id))
        );
        let nextManifestations =
          materializedIds.size > 0
            ? manifestations.map((item) =>
                materializedIds.has(item.id) && item.userId === scope
                  ? { ...item, status: 'materializado' as const }
                  : item
              )
            : manifestations;

        if (result.repeatedManifestations && result.repeatedManifestations.length > 0) {
          const repeatMap = new Map(result.repeatedManifestations.map((r) => [r.id, r.repeatCount]));
          nextManifestations = nextManifestations.map((m) => {
            if (repeatMap.has(m.id)) {
              return {
                ...m,
                repeatCount: repeatMap.get(m.id)!,
                updatedAt: new Date().toISOString(),
              };
            }
            return m;
          });
        }

        const nextCollections: ProfileCollections = {
          ...previous,
          manifestations: nextManifestations,
          progressLogs,
          successStories,
          affirmations: finalAffirmations,
        };

        const isActive = state.activeScope === scope;

        return {
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: nextCollections,
          },
          ...(isActive
            ? {
                manifestations: nextCollections.manifestations,
                progressLogs: nextCollections.progressLogs,
                successStories: nextCollections.successStories,
                affirmations: nextCollections.affirmations,
              }
            : {}),
        };
      });

      writeLocalAffirmationOrder(scope, get().scopeCollections[scope].affirmations);
    },

    addManifestation: async (item) => {
      const scope = item.userId || get().activeScope;
      const id = (item as { id?: string }).id || createManifestationId();
      const now = new Date().toISOString();
      const newItem: ManifestationItem = {
        ...item,
        userId: scope,
        id,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        const nextManifestations = [newItem, ...state.manifestations];
        return {
          manifestations: nextManifestations,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              manifestations: nextManifestations,
            },
          },
        };
      });

      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'manifestation', action: 'save', scope, data: newItem }),
        });
      } catch (error) {
        console.error(error);
      }

      return newItem;
    },

    updateManifestationStatus: async (id, status) => {
      const scope = get().activeScope;
      const manifestations = get().manifestations.map((m) =>
        m.id === id && m.userId === scope ? { ...m, status, updatedAt: new Date().toISOString() } : m
      );
      set((state) => ({
        manifestations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            manifestations,
          },
        },
      }));

      const target = manifestations.find((m) => m.id === id && m.userId === scope);
      if (target) {
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity: 'manifestation', action: 'save', scope, data: target }),
          });
        } catch (error) {
          console.error(error);
        }
      }
    },

    incrementManifestationRepeat: async (id) => {
      const scope = get().activeScope;
      const now = new Date().toISOString();
      const manifestations = get().manifestations.map((m) =>
        m.id === id && m.userId === scope
          ? { ...m, repeatCount: (m.repeatCount || 0) + 1, updatedAt: now }
          : m
      );
      set((state) => ({
        manifestations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            manifestations,
          },
        },
      }));

      const target = manifestations.find((m) => m.id === id && m.userId === scope);
      if (target) {
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity: 'manifestation', action: 'save', scope, data: target }),
          });
        } catch (error) {
          console.error(error);
        }
      }
    },

    deleteManifestation: async (id) => {
      const scope = get().activeScope;
      const target = get().manifestations.find((m) => m.id === id);
      set((state) => {
        const nextManifestations = state.manifestations.filter((m) => m.id !== id);
        const nextProgressLogs = state.progressLogs.filter((p) => p.manifestationId !== id);
        return {
          manifestations: nextManifestations,
          progressLogs: nextProgressLogs,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              manifestations: nextManifestations,
              progressLogs: nextProgressLogs,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'manifestation', action: 'delete', scope, id }),
      }).catch(console.error);

      if (target?.mediaAttachment?.storageKey) {
        void deleteMedia(target.mediaAttachment.storageKey);
      }
    },

    addProgressLog: async (log) => {
      const scope = log.userId || get().activeScope;
      const validManifestationId =
        log.manifestationId &&
        get().manifestations.some((m) => m.id === log.manifestationId && m.userId === scope)
          ? log.manifestationId
          : undefined;
      const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const newLog: ProgressLog = {
        ...log,
        userId: scope,
        manifestationId: validManifestationId,
        id,
        createdAt: now,
      };

      set((state) => {
        const nextProgressLogs = [newLog, ...state.progressLogs];
        return {
          progressLogs: nextProgressLogs,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              progressLogs: nextProgressLogs,
            },
          },
        };
      });

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'progress', action: 'save', scope, data: newLog }),
        });
        if (!response.ok) {
          throw new Error(`Progress save failed with status ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Progress save failed');
        }
      } catch (error) {
        set((state) => {
          const nextProgressLogs = state.progressLogs.filter((item) => item.id !== id);
          return {
            progressLogs: nextProgressLogs,
            scopeCollections: {
              ...state.scopeCollections,
              [scope]: {
                ...state.scopeCollections[scope],
                progressLogs: nextProgressLogs,
              },
            },
          };
        });
        throw error;
      }

      return newLog;
    },

    deleteProgressLog: async (id) => {
      const scope = get().activeScope;
      set((state) => {
        const nextProgressLogs = state.progressLogs.filter((p) => p.id !== id);
        return {
          progressLogs: nextProgressLogs,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              progressLogs: nextProgressLogs,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'progress', action: 'delete', scope, id }),
      }).catch(console.error);
    },

    addSuccessStory: async (story) => {
      const scope = story.userId || get().activeScope;
      const validManifestationId =
        story.manifestationId &&
        get().manifestations.some((m) => m.id === story.manifestationId && m.userId === scope)
          ? story.manifestationId
          : undefined;
      const id = `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const newStory: SuccessStory = {
        ...story,
        userId: scope,
        manifestationId: validManifestationId,
        id,
        createdAt: now,
      };

      set((state) => {
        const nextStories = [newStory, ...state.successStories];
        return {
          successStories: nextStories,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              successStories: nextStories,
            },
          },
        };
      });

      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'story', action: 'save', scope, data: newStory }),
        });
      } catch (error) {
        console.error(error);
      }

      return newStory;
    },

    deleteSuccessStory: async (id) => {
      const scope = get().activeScope;
      set((state) => {
        const nextStories = state.successStories.filter((s) => s.id !== id);
        return {
          successStories: nextStories,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              successStories: nextStories,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'story', action: 'delete', scope, id }),
      }).catch(console.error);
    },

    addAffirmation: async (text) => {
      const id = `aff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const scope = get().activeScope;
      const author = scope === 'maia' ? 'Maia' : scope === 'facu' ? 'Facu' : 'Juntos';

      const currentSorted = sortAffirmations(
        get().affirmations.filter((item) => item.userId === scope)
      );
      const pinnedItems = currentSorted.filter((a) => a.pinned);
      const unpinnedItems = currentSorted.filter((a) => !a.pinned);

      const newAff: Affirmation = {
        id,
        userId: scope,
        author,
        text,
        repeatCount: 0,
        pinned: false,
        order: pinnedItems.length,
        createdAt: now,
      };

      const nextAffirmations = [...pinnedItems, newAff, ...unpinnedItems].map((item, index) => ({
        ...item,
        order: index,
      }));

      set((state) => ({
        affirmations: nextAffirmations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            affirmations: nextAffirmations,
          },
        },
      }));
      writeLocalAffirmationOrder(scope, nextAffirmations);

      const savedNewAff = nextAffirmations.find((item) => item.id === id) ?? newAff;

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'affirmation', action: 'save', scope, data: savedNewAff }),
      })
        .then(() => {
          syncAffirmationOrderToServer(scope, nextAffirmations);
        })
        .catch(console.error);

      return savedNewAff;
    },

    togglePinAffirmation: async (id) => {
      const scope = get().activeScope;
      const current = sortAffirmations(
        get().affirmations.filter((item) => item.userId === scope)
      );
      const target = current.find((a) => a.id === id);
      if (!target) return;

      const nextPinned = !Boolean(target.pinned);
      const remaining = current.filter((a) => a.id !== id);
      const pinnedItems = remaining.filter((a) => a.pinned);
      const unpinnedItems = remaining.filter((a) => !a.pinned);

      const updatedTarget: Affirmation = {
        ...target,
        pinned: nextPinned,
      };

      const orderedList = [...pinnedItems, updatedTarget, ...unpinnedItems];

      const affirmations = orderedList.map((item, index) => ({
        ...item,
        order: index,
      }));

      set((state) => ({
        affirmations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            affirmations,
          },
        },
      }));
      writeLocalAffirmationOrder(scope, affirmations);

      const savedTarget = affirmations.find((a) => a.id === id);
      if (savedTarget) {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'affirmation', action: 'save', scope, data: savedTarget }),
        })
          .then(() => {
            syncAffirmationOrderToServer(scope, affirmations);
          })
          .catch(console.error);
      }
    },

    reorderAffirmations: (activeId, overId) => {
      if (activeId === overId) return;
      const scope = get().activeScope;
      const current = sortAffirmations(
        get().affirmations.filter((item) => item.userId === scope)
      );
      const activeItem = current.find((a) => a.id === activeId);
      const overItem = current.find((a) => a.id === overId);
      if (!activeItem || !overItem) return;

      const pinnedList = current.filter((a) => a.pinned);
      const unpinnedList = current.filter((a) => !a.pinned);

      if (activeItem.pinned) {
        const fromIndex = pinnedList.findIndex((a) => a.id === activeId);
        if (fromIndex === -1) return;
        const rawToIndex = pinnedList.findIndex((a) => a.id === overId);
        const toIndex = rawToIndex !== -1 ? rawToIndex : pinnedList.length - 1;
        if (fromIndex === toIndex) return;

        const [moved] = pinnedList.splice(fromIndex, 1);
        pinnedList.splice(toIndex, 0, moved);
      } else {
        const fromIndex = unpinnedList.findIndex((a) => a.id === activeId);
        if (fromIndex === -1) return;
        const rawToIndex = unpinnedList.findIndex((a) => a.id === overId);
        const toIndex = rawToIndex !== -1 ? rawToIndex : 0;
        if (fromIndex === toIndex) return;

        const [moved] = unpinnedList.splice(fromIndex, 1);
        unpinnedList.splice(toIndex, 0, moved);
      }

      const affirmations = [...pinnedList, ...unpinnedList].map((item, index) => ({
        ...item,
        order: index,
      }));

      set((state) => ({
        affirmations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            affirmations,
          },
        },
      }));
      writeLocalAffirmationOrder(scope, affirmations);
    },

    moveAffirmation: async (id, direction) => {
      const scope = get().activeScope;
      const current = sortAffirmations(
        get().affirmations.filter((item) => item.userId === scope)
      );
      const target = current.find((a) => a.id === id);
      if (!target) return;

      const pinnedList = current.filter((a) => a.pinned);
      const unpinnedList = current.filter((a) => !a.pinned);
      const group = target.pinned ? pinnedList : unpinnedList;

      const fromIndex = group.findIndex((a) => a.id === id);
      if (fromIndex === -1) return;

      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= group.length) return;

      const [moved] = group.splice(fromIndex, 1);
      group.splice(toIndex, 0, moved);

      const affirmations = [...pinnedList, ...unpinnedList].map((item, index) => ({
        ...item,
        order: index,
      }));

      set((state) => ({
        affirmations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            affirmations,
          },
        },
      }));
      writeLocalAffirmationOrder(scope, affirmations);
      syncAffirmationOrderToServer(scope, affirmations);
    },

    commitAffirmationOrder: async () => {
      const scope = get().activeScope;
      const affirmations = sortAffirmations(
        get().affirmations.filter((item) => item.userId === scope)
      );
      writeLocalAffirmationOrder(scope, affirmations);
      syncAffirmationOrderToServer(scope, affirmations);
    },

    incrementAffirmationRepeat: async (id) => {
      const scope = get().activeScope;
      const affirmations = get().affirmations.map((a) =>
        a.id === id && a.userId === scope ? { ...a, repeatCount: a.repeatCount + 1 } : a
      );
      set((state) => ({
        affirmations,
        scopeCollections: {
          ...state.scopeCollections,
          [scope]: {
            ...state.scopeCollections[scope],
            affirmations,
          },
        },
      }));

      const target = affirmations.find((a) => a.id === id && a.userId === scope);
      if (target) {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'affirmation', action: 'save', scope, data: target }),
        }).catch(console.error);
      }
    },

    deleteAffirmation: async (id) => {
      const scope = get().activeScope;
      set((state) => {
        const nextAffirmations = state.affirmations.filter((a) => a.id !== id);
        return {
          affirmations: nextAffirmations,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              affirmations: nextAffirmations,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'affirmation', action: 'delete', scope, id }),
      }).catch(console.error);
    },

    saveRampageSet: async (rampage) => {
      const scope = rampage.userId || get().activeScope;
      const now = new Date().toISOString();
      const newSet: RampageSet = {
        ...rampage,
        userId: scope,
        id: rampage.id || `rampage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: rampage.createdAt || now,
        updatedAt: now,
      };

      set((state) => {
        const nextRampageSets = [
          newSet,
          ...state.rampageSets.filter((rampageSet) => rampageSet.id !== newSet.id),
        ];
        return {
          rampageSets: nextRampageSets,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              rampageSets: nextRampageSets,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'rampageSet', action: 'save', scope, data: newSet }),
      }).catch(console.error);

      return newSet;
    },

    deleteRampageSet: async (id) => {
      const scope = get().activeScope;
      set((state) => {
        const nextRampageSets = state.rampageSets.filter((r) => r.id !== id);
        return {
          rampageSets: nextRampageSets,
          scopeCollections: {
            ...state.scopeCollections,
            [scope]: {
              ...state.scopeCollections[scope],
              rampageSets: nextRampageSets,
            },
          },
        };
      });

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'rampageSet', action: 'delete', scope, id }),
      }).catch(console.error);
    },
  };
});
