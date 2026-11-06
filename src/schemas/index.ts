import { z } from 'zod';

export const UserScopeEnum = z.enum(['facu', 'maia', 'shared']);
export const EntryTypeEnum = z.enum(['manifestation', 'progress', 'gratitude', 'affirmation', 'reflection', 'free', 'sign']);
export const MoodTypeEnum = z.enum(['peaceful', 'inspired', 'grateful', 'radiant', 'contemplative']);
export const GoalCategoryEnum = z.enum(['crecimiento', 'carrera', 'bienestar', 'relaciones', 'abundancia', 'creatividad']);
export const GoalStatusEnum = z.enum(['active', 'paused', 'completed', 'archived']);
export const SignTypeEnum = z.enum(['angel_number', 'dream', 'coincidence', 'symbol', 'encounter', 'intuitive']);
export const AmbientSoundEnum = z.enum(['none', 'white_noise', 'astral_rain']);

export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  title: z.string().min(1, 'El título o intención es requerido'),
  content: z.string().min(1, 'El contenido no puede estar vacío'),
  entryType: EntryTypeEnum,
  mood: MoodTypeEnum.optional(),
  gratitudeItems: z.array(z.string()).optional(),
  affirmations: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  goalReferences: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GoalSchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  title: z.string().min(1, 'La manifestación u objetivo es requerida'),
  description: z.string().default(''),
  category: GoalCategoryEnum,
  motivation: z.string().min(1, 'Escribe tu motivo o sentimiento íntimo'),
  status: GoalStatusEnum.default('active'),
  targetDate: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const SuccessStorySchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  title: z.string().min(1, 'Nombra tu manifestación cumplida'),
  goalId: z.string().optional(),
  manifestedDate: z.string(),
  story: z.string().min(1, 'Cuéntanos cómo se materializó en tu realidad'),
  signsEncountered: z.array(z.string()).default([]),
  mindsetShift: z.string().default(''),
  gratitudeNote: z.string().default(''),
  createdAt: z.string(),
});

export const ManifestationSignSchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  title: z.string().min(1, 'Escribe qué señal o sincronía percibiste'),
  signType: SignTypeEnum,
  description: z.string().default(''),
  date: z.string(),
  linkedGoalId: z.string().optional(),
  feeling: z.string().default(''),
  createdAt: z.string(),
});

export const AffirmationSchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  text: z.string().min(1, 'La afirmación no puede estar vacía'),
  category: z.string().optional(),
  repeatCount: z.number().int().default(0),
  pinned: z.boolean().default(false),
  createdAt: z.string(),
});

export const RampageSetSchema = z.object({
  id: z.string().min(1),
  userId: UserScopeEnum.default('facu'),
  author: z.string().default('Facu'),
  title: z.string().min(1, 'El título del Rampage es requerido'),
  category: z.string().optional(),
  affirmations: z.array(z.object({
    id: z.string(),
    text: z.string(),
    repeatCount: z.number().default(0),
  })),
  ambientSound: AmbientSoundEnum.default('astral_rain'),
  isFavorite: z.boolean().default(false),
  createdAt: z.string(),
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
