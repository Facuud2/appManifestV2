import { z } from 'zod';

export const UserScopeEnum = z.enum(['facu', 'maia', 'shared']);
export const EntryTypeEnum = z.enum(['manifestation', 'progress', 'gratitude', 'affirmation', 'reflection', 'free', 'sign']);
export const MoodTypeEnum = z.enum(['peaceful', 'inspired', 'grateful', 'radiant', 'contemplative']);
export const GoalCategoryEnum = z.enum(['crecimiento', 'carrera', 'bienestar', 'relaciones', 'abundancia', 'creatividad']);
export const GoalStatusEnum = z.enum(['active', 'paused', 'completed', 'archived']);
export const SignTypeEnum = z.enum(['angel_number', 'dream', 'coincidence', 'symbol', 'encounter', 'intuitive']);
export const AmbientSoundEnum = z.enum(['none', 'white_noise', 'astral_rain']);

export const JournalEntrySchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().min(1, 'El título o intención es requerido').max(280),
  content: z.string().min(1, 'El contenido no puede estar vacío').max(10000),
  entryType: EntryTypeEnum,
  mood: MoodTypeEnum.optional(),
  gratitudeItems: z.array(z.string().max(500)).max(50).optional(),
  affirmations: z.array(z.string().max(500)).max(50).optional(),
  tags: z.array(z.string().max(60)).max(30).default([]),
  goalReferences: z.array(z.string().max(128)).max(50).optional(),
  createdAt: z.string().max(100),
  updatedAt: z.string().max(100),
});

export const GoalSchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().min(1, 'La manifestación u objetivo es requerida').max(280),
  description: z.string().max(5000).default(''),
  category: GoalCategoryEnum,
  motivation: z.string().min(1, 'Escribe tu motivo o sentimiento íntimo').max(2000),
  status: GoalStatusEnum.default('active'),
  targetDate: z.string().max(100).optional(),
  createdAt: z.string().max(100),
  completedAt: z.string().max(100).optional(),
});

export const SuccessStorySchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().min(1, 'Nombra tu manifestación cumplida').max(280),
  manifestationId: z.string().max(128).nullable().optional(),
  /** @deprecated legacy alias kept for older clients. Use `manifestationId`. */
  goalId: z.string().max(128).optional(),
  manifestedDate: z.string().max(100),
  story: z.string().min(1, 'Cuéntanos cómo se materializó en tu realidad').max(10000),
  signsEncountered: z.array(z.string().max(280)).max(50).default([]),
  mindsetShift: z.string().max(2000).default(''),
  gratitudeNote: z.string().max(2000).default(''),
  createdAt: z.string().max(100),
});

export const ManifestationSignSchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().min(1, 'Escribe qué señal o sincronía percibiste').max(280),
  signType: SignTypeEnum,
  description: z.string().max(5000).default(''),
  date: z.string().max(100),
  linkedGoalId: z.string().max(128).optional(),
  feeling: z.string().max(1000).default(''),
  createdAt: z.string().max(100),
});

export const AffirmationSchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  text: z.string().min(1, 'La afirmación no puede estar vacía').max(1000),
  category: z.string().max(100).optional(),
  repeatCount: z.number().int().min(0).max(100000000).default(0),
  pinned: z.boolean().default(false),
  order: z.number().int().optional(),
  createdAt: z.string().max(100),
});

export const RampageSetSchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().min(1, 'El título del Rampage es requerido').max(200),
  category: z.string().max(100).optional(),
  affirmations: z.array(z.object({
    id: z.string().max(128),
    text: z.string().max(1000),
    repeatCount: z.number().int().min(0).max(100000000).default(0),
  })).max(100),
  ambientSound: AmbientSoundEnum.default('astral_rain'),
  isFavorite: z.boolean().default(false),
  createdAt: z.string().max(100),
});

export const ManifestationMutationSchema = z.object({
  id: z.string().min(1).max(128),
  userId: UserScopeEnum.default('facu'),
  author: z.string().max(100).default('Facu'),
  title: z.string().max(280).default(''),
  description: z.string().max(10000).default(''),
  sensoryAnchor: z.string().max(1000).optional(),
  category: z.string().max(100).default('crecimiento'),
  status: z.enum(['semilla', 'alineacion', 'evidencia', 'materializado']).default('semilla'),
  targetDate: z.string().max(100).nullable().optional(),
  songAttachment: z.any().optional(),
  mediaAttachment: z.any().optional(),
  createdAt: z.string().max(100).optional(),
  updatedAt: z.string().max(100).optional(),
});

export const ProgressMutationSchema = z.object({
  id: z.string().min(1).max(128),
  manifestationId: z.string().max(128).nullable().optional(),
  userId: UserScopeEnum.default('facu'),
  note: z.string().max(10000).default(''),
  signType: z.string().max(100).nullable().optional(),
  voiceTranscript: z.string().max(10000).nullable().optional(),
  createdAt: z.string().max(100).optional(),
});

export const VoiceProfileSchema = z.object({
  voiceProfileId: z.string(),
  userId: z.enum(['facu', 'maia']),
  recordedAt: z.string(),
  durationSeconds: z.number(),
  detectedTone: z.string(),
  sampleName: z.string().optional(),
  detectedPitch: z.number().optional(),
  fundamentalFrequency: z.number().optional(),
  matchedVoice: z.string().optional(),
  isCalibrated: z.boolean().default(false),
});
