import { NextRequest, NextResponse } from 'next/server';
import {
  createReplicatedVoiceWithGemini,
  deleteReplicatedVoiceWithGemini,
} from '@/lib/gemini';
import { turso } from '@/lib/turso';
import { VoiceProfileMeta } from '@/types';

export const dynamic = 'force-dynamic';

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function parseNumber(value: FormDataEntryValue | null): number {
  return typeof value === 'string' ? Number(value) : Number.NaN;
}

function readExistingVoiceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const meta = JSON.parse(value) as VoiceProfileMeta;
    return meta.geminiVoiceId;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  let createdVoiceId: string | undefined;

  try {
    const formData = await req.formData();
    const profileId = formData.get('profileId');
    const sourceAudio = formData.get('sourceAudio');
    const consentAudio = formData.get('consentAudio');
    const durationSeconds = parseNumber(formData.get('durationSeconds'));
    const consentDurationSeconds = parseNumber(formData.get('consentDurationSeconds'));

    if (profileId !== 'facu' && profileId !== 'maia') {
      return NextResponse.json({ success: false, error: 'Perfil de voz inválido' }, { status: 400 });
    }
    if (!isAudioFile(sourceAudio) || !isAudioFile(consentAudio)) {
      return NextResponse.json({ success: false, error: 'Faltan las dos grabaciones de voz' }, { status: 400 });
    }
    if (sourceAudio.type !== 'audio/wav' || consentAudio.type !== 'audio/wav') {
      return NextResponse.json({ success: false, error: 'Las grabaciones deben estar en formato WAV' }, { status: 400 });
    }
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 10 ||
      durationSeconds > 31 ||
      !Number.isFinite(consentDurationSeconds) ||
      consentDurationSeconds < 2 ||
      consentDurationSeconds > 20
    ) {
      return NextResponse.json({ success: false, error: 'La duración de las grabaciones no es válida' }, { status: 400 });
    }
    if (sourceAudio.size > 12_000_000 || consentAudio.size > 4_000_000) {
      return NextResponse.json({ success: false, error: 'Las grabaciones superan el tamaño permitido' }, { status: 413 });
    }

    const existing = await turso.execute({
      sql: 'SELECT voice_tone_profile, created_at FROM profiles WHERE id = ?;',
      args: [profileId],
    });
    const previousVoiceId = readExistingVoiceId(existing.rows[0]?.voice_tone_profile);
    const now = new Date().toISOString();
    const detectedTone = String(formData.get('detectedTone') || 'calma, íntima y luminosa');
    const detectedPitch = parseNumber(formData.get('detectedPitch'));
    const fundamentalFrequency = parseNumber(formData.get('fundamentalFrequency'));
    const transcript = String(formData.get('transcript') || '').trim();
    if (!transcript) {
      return NextResponse.json({ success: false, error: 'No se reconoció la muestra de voz' }, { status: 400 });
    }

    createdVoiceId = await createReplicatedVoiceWithGemini({
      profileId,
      sourceAudio: Buffer.from(await sourceAudio.arrayBuffer()),
      consentAudio: Buffer.from(await consentAudio.arrayBuffer()),
    });

    const voiceProfileMeta: VoiceProfileMeta = {
      voiceProfileId: `profile_${profileId}_${Date.now()}`,
      userId: profileId,
      recordedAt: now,
      durationSeconds,
      detectedTone,
      detectedPitch: Number.isFinite(detectedPitch) ? detectedPitch : 1,
      fundamentalFrequency: Number.isFinite(fundamentalFrequency) ? fundamentalFrequency : 160,
      matchedVoice: profileId === 'maia' ? 'Kore' : 'Charon',
      geminiVoiceId: createdVoiceId,
      isCalibrated: true,
    };

    await turso.execute({
      sql: `INSERT INTO profiles (
              id, name, avatar, voice_tone_profile, has_calibrated_voice, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              avatar = excluded.avatar,
              voice_tone_profile = excluded.voice_tone_profile,
              has_calibrated_voice = 1,
              updated_at = excluded.updated_at;`,
      args: [
        profileId,
        profileId === 'maia' ? 'Maia' : 'Facu',
        profileId === 'maia' ? 'maia' : 'facu',
        JSON.stringify(voiceProfileMeta),
        (existing.rows[0]?.created_at as string) || now,
        now,
      ],
    });

    let warning: string | undefined;
    if (previousVoiceId && previousVoiceId !== createdVoiceId) {
      try {
        await deleteReplicatedVoiceWithGemini(previousVoiceId);
      } catch (error) {
        console.error('[API /api/ai/voice-replication] Previous voice cleanup failed:', error);
        warning = 'La nueva voz está lista, pero no se pudo eliminar la réplica anterior del proyecto Gemini.';
      }
    }

    return NextResponse.json({ success: true, data: { voiceProfileMeta, warning } });
  } catch (error) {
    if (createdVoiceId) {
      try {
        await deleteReplicatedVoiceWithGemini(createdVoiceId);
      } catch (cleanupError) {
        console.error('[API /api/ai/voice-replication] New voice cleanup failed:', cleanupError);
      }
    }
    console.error('[API /api/ai/voice-replication] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al crear el perfil de voz' },
      { status: 500 }
    );
  }
}
