export type UserScope = 'facu' | 'maia' | 'shared';

export type EntryType = 'progress' | 'sign' | 'manifestation' | 'gratitude' | 'reflection' | 'free' | 'affirmation';

export type MoodType = 'peaceful' | 'inspired' | 'grateful' | 'radiant' | 'contemplative';

export type AmbientSoundType = 'none' | 'white_noise' | 'astral_rain';

export interface VoiceProfileMeta {
  voiceProfileId: string;
  userId: 'facu' | 'maia';
  recordedAt: string;
  durationSeconds: number;
  detectedTone: string;
  sampleName?: string;
  detectedPitch?: number; // 0.75 - 1.25 for SpeechSynthesisUtterance.pitch
  fundamentalFrequency?: number; // e.g. 150 Hz
  matchedVoice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | string;
  geminiVoiceId?: string;
  isCalibrated: boolean;
}

export interface CalibrationPhrase {
  id: number;
  text: string;
  focus: string;
}

/**
 * A song that accompanies a manifestation. Metadata is small enough to live in
 * Turso; the actual audio is never stored, only a short preview URL when the
 * free provider can supply one.
 */
export interface SongAttachment {
  id: string;
  title: string;
  artist: string;
  albumCoverUrl: string;
  spotifyUrl: string;
  previewAudioUrl: string | null;
  provider?: 'spotify' | 'itunes' | 'deezer';
  providerTrackId?: string;
  previewFetchedAt?: string;
}

/** A result returned by the free music search route. */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumCoverUrl: string;
  spotifyUrl: string;
  previewAudioUrl: string | null;
  provider: 'spotify' | 'itunes' | 'deezer';
  providerTrackId?: string;
}

/**
 * A photo or video attached to a manifestation. Only the lightweight thumbnail
 * travels to Turso; the full blob stays in IndexedDB on the device that
 * created it.
 */
export interface MediaAttachment {
  kind: 'photo' | 'video';
  thumbDataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  byteSize: number;
  storageKey: string;
}

export interface Affirmation {
  id: string;
  userId: UserScope;
  author: string;
  text: string;
  repeatCount: number;
  category?: string;
  createdAt: string;
  lastRepeatedAt?: string;
  pinned?: boolean;
  order?: number;
}

export interface RampageAffirmation {
  id: string;
  text: string;
  repeatCount: number;
}

export interface RampageSet {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  category?: string;
  affirmations: RampageAffirmation[];
  ambientSound: AmbientSoundType;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type GoalCategory = 'crecimiento' | 'carrera' | 'bienestar' | 'relaciones' | 'abundancia' | 'creatividad';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type SignType = 'angel_number' | 'dream' | 'coincidence' | 'symbol' | 'encounter' | 'intuitive';

export interface JournalEntry {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  content: string;
  entryType: EntryType;
  mood?: MoodType;
  gratitudeItems?: string[];
  affirmations?: string[];
  tags: string[];
  goalReferences?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalStep {
  id: string;
  goalId: string;
  userId: UserScope;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  description: string;
  category: GoalCategory;
  motivation: string;
  status: GoalStatus;
  targetDate?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ManifestationSign {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  signType: SignType;
  description: string;
  date: string;
  linkedGoalId?: string;
  feeling: string;
  createdAt: string;
}

export interface SuccessStory {
  id: string;
  manifestationId?: string;
  userId: UserScope;
  author: string;
  title: string;
  goalId?: string;
  manifestedDate: string;
  story: string;
  signsEncountered?: string[];
  mindsetShift?: string;
  gratitudeNote?: string;
  createdAt: string;
}

export interface FutureManifestation {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  horizon: '3_months' | '6_months' | '1_year' | '3_years' | 'exact_date';
  targetDate?: string;
  visionText: string;
  letterToFutureSelf?: string;
  isSealed: boolean;
  createdAt: string;
}

export interface AgendaEvent {
  id: string;
  userId: UserScope;
  author: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  completed: boolean;
  goalId?: string;
  createdAt: string;
}

export interface UserSettings {
  userName: string;
  greetingPreference: 'morning_gentle' | 'intimate' | 'empowered';
  theme: 'pastel-rainbow' | 'serene-lavender' | 'mint-glow' | 'liquid-glass' | 'neumorphism-esoteric';
  colorMode?: 'dark' | 'light' | 'system';
  reducedMotion: boolean;
  favoriteAffirmations: string[];
  firstLaunchCompleted: boolean;
  tutorialCompleted: boolean;
  activeScope: UserScope;
  dailyStreak: number;
  lastActiveDate: string;
  totalJournalEntries: number;
  totalActionsCompleted: number;
  totalReleases: number;
  unlockedMilestones: string[];
  ambientSound: AmbientSoundType;
}
