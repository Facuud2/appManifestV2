import {
  NARRATIVE_LIMITS,
  type NarrativeCommitResult,
  type NarrativeDraft,
  type NarrativeProfileId,
} from './narrativeOrganizer';
import { generateCleanTitle, URL_REGEX } from '@/utils/urlParser';
import { serializeAttachment } from './manifestationAttachments';
import type { SongAttachment, MediaAttachment } from '@/types';

export interface CommitStatement {
  sql: string;
  args: Array<string | number | null>;
}

export interface BuildCommitOptions {
  draft: NarrativeDraft;
  profileId: NarrativeProfileId;
  /** Real IDs that exist for this profile and may be linked to. */
  validExistingIds: string[];
  /** Affirmations already stored for this profile (to avoid duplicates). */
  existingAffirmationTexts?: string[];
  /** Full existing affirmations for repeat count lookups. */
  existingAffirmations?: Array<{ id: string; text: string; repeatCount?: number }>;
  /** Full existing manifestations for repeat count lookups. */
  existingManifestations?: Array<{ id: string; title: string; repeatCount?: number }>;
  /** Current MAX(sort_order) + 1 for unpinned affirmations. */
  baseSortOrder?: number;
}

export interface BuiltNarrativeCommit {
  statements: CommitStatement[];
  result: NarrativeCommitResult;
}

function sanitizeFragment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'item';
}

function shortDraftId(draftId: string): string {
  const cleaned = draftId.replace(/[^a-zA-Z0-9]/g, '');
  return (cleaned.slice(0, 8) || Date.now().toString(36)).toLowerCase();
}

function buildId(prefix: string, short: string, tempId: string): string {
  const id = `${prefix}_${short}_${sanitizeFragment(tempId)}`;
  return id.slice(0, 128);
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function authorFor(profileId: NarrativeProfileId): string {
  if (profileId === 'maia') return 'Maia';
  if (profileId === 'facu') return 'Facu';
  return 'Juntos';
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

/**
 * Turns a normalized draft into an atomic set of SQL statements.
 * No I/O happens here: the route resolves the DB facts and executes the batch.
 */
export function buildNarrativeCommit(options: BuildCommitOptions): BuiltNarrativeCommit {
  const { draft, profileId } = options;
  const plan = draft.proposedPlan;
  const short = shortDraftId(draft.draftId);
  const author = authorFor(profileId);
  const now = new Date().toISOString();

  const validExistingIds = new Set(options.validExistingIds);
  const manifestationIdByTemp = new Map<string, string>();
  const repeatedManifestations: Array<{ id: string; repeatCount: number }> = [];
  const repeatedAffirmations: Array<{ id: string; repeatCount: number }> = [];

  const existingManMap = new Map((options.existingManifestations || []).map((m) => [m.id, m]));
  const existingAffMap = new Map((options.existingAffirmations || []).map((a) => [a.id, a]));

  const manifestations: Array<{
    id: string;
    userId: NarrativeProfileId;
    author: string;
    title: string;
    description: string;
    sensoryAnchor: string;
    category: string;
    status: any;
    createdAt: string;
    updatedAt: string;
    tempId: string;
    songAttachment?: SongAttachment | null;
    mediaAttachment?: MediaAttachment | null;
  }> = [];

  plan.manifestations.forEach((item) => {
    // If it is a repeat and has existingId
    if (item.action === 'repeat' && item.existingId && validExistingIds.has(item.existingId)) {
      manifestationIdByTemp.set(item.tempId, item.existingId);
      const prevRepeat = existingManMap.get(item.existingId)?.repeatCount ?? 0;
      repeatedManifestations.push({ id: item.existingId, repeatCount: prevRepeat + 1 });
      return;
    }

    const id = buildId('manif', short, item.tempId);
    manifestationIdByTemp.set(item.tempId, id);

    // Enforce 1 single paragraph, no \n\n, no "Contexto:"
    let cleanContent = item.content.trim();
    if (cleanContent.includes('\n\n')) {
      cleanContent = cleanContent.split(/\n\n+/)[0].trim();
    }
    cleanContent = cleanContent.replace(/^Contexto:\s*/i, '').trim();
    const description = clip(cleanContent, NARRATIVE_LIMITS.content);

    // Sanitize title to remove any URLs and robotic prefixes
    let cleanTitle = item.title.replace(URL_REGEX, '').replace(/https?:\/\/\S*/gi, '').trim();
    cleanTitle = cleanTitle.replace(/^\([^\)]+\)\s*-\s*/, '').trim();
    if (!cleanTitle) {
      cleanTitle = generateCleanTitle(cleanContent) || 'Manifestación';
    }

    manifestations.push({
      id,
      userId: profileId,
      author,
      title: clip(cleanTitle, NARRATIVE_LIMITS.title),
      description,
      sensoryAnchor: '',
      category: item.category || 'crecimiento',
      status: item.status,
      createdAt: now,
      updatedAt: now,
      tempId: item.tempId,
      songAttachment: item.songAttachment ?? null,
      mediaAttachment: item.mediaAttachment ?? null,
    });
  });

  const resolveManifestationId = (link: {
    kind: 'existing' | 'temp' | 'none';
    id?: string;
  }): string | null => {
    if (link.kind === 'existing' && link.id && validExistingIds.has(link.id)) {
      return link.id;
    }
    if (link.kind === 'temp' && link.id) {
      return manifestationIdByTemp.get(link.id) || null;
    }
    return null;
  };

  const progressLogs = plan.progressLogs.map((item) => ({
    id: buildId('prog', short, item.tempId),
    manifestationId: resolveManifestationId(item.link),
    userId: profileId,
    note: clip(`${item.title}\n${item.content}`.trim(), NARRATIVE_LIMITS.content),
    signType: item.signType || null,
    voiceTranscript: draft.userTranscript
      ? clip(draft.userTranscript, NARRATIVE_LIMITS.transcript)
      : null,
    createdAt: now,
    tempId: item.tempId,
    songAttachment: item.songAttachment ?? null,
    mediaAttachment: item.mediaAttachment ?? null,
  }));

  // Route any orphan context to a linked progress log so that history/context is preserved
  // exclusively inside progressLogs (generating the 👣 1 avance vinculado badge)
  plan.manifestations.forEach((item) => {
    const manifestationId = manifestationIdByTemp.get(item.tempId);
    if (!manifestationId) return;

    const hasLinkedProgress = progressLogs.some(
      (p) => p.manifestationId === manifestationId
    );

    if (!hasLinkedProgress && item.context && item.context.trim()) {
      const cleanCtx = item.context.replace(/^Contexto:\s*/i, '').trim();
      if (cleanCtx) {
        progressLogs.push({
          id: buildId('prog', short, `${item.tempId}_ctx`),
          manifestationId,
          userId: profileId,
          note: clip(cleanCtx, NARRATIVE_LIMITS.content),
          signType: 'encounter',
          voiceTranscript: draft.userTranscript
            ? clip(draft.userTranscript, NARRATIVE_LIMITS.transcript)
            : null,
          createdAt: now,
          tempId: `${item.tempId}_ctx`,
          songAttachment: null,
          mediaAttachment: null,
        });
      }
    }
  });

  const successStories = plan.successStories.map((item) => ({
    id: buildId('story', short, item.tempId),
    manifestationId: resolveManifestationId(item.link),
    userId: profileId,
    author,
    title: clip(item.title, NARRATIVE_LIMITS.title),
    story: clip(item.content, NARRATIVE_LIMITS.content),
    gratitudeNote: '',
    manifestedDate: item.manifestedDate,
    createdAt: now,
    tempId: item.tempId,
  }));

  const existingTexts = new Set(
    (options.existingAffirmationTexts || []).map((text) => normalizeForCompare(text))
  );
  const seen = new Set<string>();
  const skippedAffirmations: string[] = [];
  let nextOrder = options.baseSortOrder ?? 0;

  const affirmations = plan.affirmations.flatMap((item) => {
    if (item.action === 'repeat' && item.existingId) {
      const prevRepeat = existingAffMap.get(item.existingId)?.repeatCount ?? 0;
      repeatedAffirmations.push({ id: item.existingId, repeatCount: prevRepeat + 1 });
      return [];
    }

    const key = normalizeForCompare(item.text);
    if (!key || seen.has(key)) {
      skippedAffirmations.push(item.text);
      return [];
    }

    if (existingTexts.has(key) && item.action !== 'create_new') {
      const matched = (options.existingAffirmations || []).find(
        (ea) => normalizeForCompare(ea.text) === key
      );
      if (matched) {
        repeatedAffirmations.push({ id: matched.id, repeatCount: (matched.repeatCount ?? 0) + 1 });
        return [];
      }
      skippedAffirmations.push(item.text);
      return [];
    }

    seen.add(key);
    const record = {
      id: buildId('aff', short, item.tempId),
      userId: profileId,
      author,
      text: clip(item.text, NARRATIVE_LIMITS.affirmation),
      category: item.category,
      repeatCount: 0,
      pinned: false,
      order: nextOrder++,
      createdAt: now,
      tempId: item.tempId,
      songAttachment: item.songAttachment ?? null,
      mediaAttachment: item.mediaAttachment ?? null,
    };
    return [record];
  });

  const statements: CommitStatement[] = [];

  repeatedManifestations.forEach((item) => {
    statements.push({
      sql: 'UPDATE manifestations SET repeat_count = COALESCE(repeat_count, 0) + 1, updated_at = ? WHERE id = ? AND user_id = ?;',
      args: [now, item.id, profileId],
    });
  });

  repeatedAffirmations.forEach((item) => {
    statements.push({
      sql: 'UPDATE affirmations SET repeat_count = COALESCE(repeat_count, 0) + 1 WHERE id = ? AND user_id = ?;',
      args: [item.id, profileId],
    });
  });

  manifestations.forEach((item) => {
    statements.push({
      sql: `INSERT INTO manifestations
        (id, user_id, author, title, description, sensory_anchor, category, status, target_date, song_attachment, media_attachment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          author = excluded.author,
          title = excluded.title,
          description = excluded.description,
          sensory_anchor = excluded.sensory_anchor,
          category = excluded.category,
          status = excluded.status,
          song_attachment = COALESCE(excluded.song_attachment, manifestations.song_attachment),
          media_attachment = COALESCE(excluded.media_attachment, manifestations.media_attachment),
          updated_at = excluded.updated_at;`,
      args: [
        item.id,
        item.userId,
        item.author,
        item.title,
        item.description,
        item.sensoryAnchor,
        item.category,
        item.status,
        serializeAttachment(item.songAttachment),
        serializeAttachment(item.mediaAttachment),
        item.createdAt,
        item.updatedAt,
      ],
    });
  });

  progressLogs.forEach((item) => {
    statements.push({
      sql: `INSERT INTO manifestation_progress
        (id, manifestation_id, user_id, note, sign_type, voice_transcript, song_attachment, media_attachment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          manifestation_id = excluded.manifestation_id,
          user_id = excluded.user_id,
          note = excluded.note,
          sign_type = excluded.sign_type,
          voice_transcript = excluded.voice_transcript,
          song_attachment = COALESCE(excluded.song_attachment, manifestation_progress.song_attachment),
          media_attachment = COALESCE(excluded.media_attachment, manifestation_progress.media_attachment);`,
      args: [
        item.id,
        item.manifestationId,
        item.userId,
        item.note,
        item.signType,
        item.voiceTranscript,
        serializeAttachment(item.songAttachment),
        serializeAttachment(item.mediaAttachment),
        item.createdAt,
      ],
    });
  });

  successStories.forEach((item) => {
    statements.push({
      sql: `INSERT INTO success_stories
        (id, manifestation_id, user_id, author, title, story, gratitude_note, manifested_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          manifestation_id = excluded.manifestation_id,
          user_id = excluded.user_id,
          author = excluded.author,
          title = excluded.title,
          story = excluded.story,
          manifested_date = excluded.manifested_date;`,
      args: [
        item.id,
        item.manifestationId,
        item.userId,
        item.author,
        item.title,
        item.story,
        item.gratitudeNote,
        item.manifestedDate,
        item.createdAt,
      ],
    });

    if (item.manifestationId) {
      statements.push({
        sql: `UPDATE manifestations
          SET status = 'materializado', updated_at = ?
          WHERE id = ? AND user_id = ?;`,
        args: [now, item.manifestationId, profileId],
      });
    }
  });

  affirmations.forEach((item) => {
    statements.push({
      sql: `INSERT INTO affirmations
        (id, user_id, text, category, repeat_count, pinned, sort_order, song_attachment, media_attachment, created_at)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          text = excluded.text,
          category = excluded.category,
          sort_order = excluded.sort_order,
          song_attachment = COALESCE(excluded.song_attachment, affirmations.song_attachment),
          media_attachment = COALESCE(excluded.media_attachment, affirmations.media_attachment);`,
      args: [
        item.id,
        item.userId,
        item.text,
        item.category || null,
        item.order,
        serializeAttachment(item.songAttachment),
        serializeAttachment(item.mediaAttachment),
        item.createdAt,
      ],
    });
  });

  return {
    statements,
    result: {
      draftId: draft.draftId,
      profileId,
      manifestations,
      progressLogs,
      successStories,
      affirmations,
      skippedAffirmations,
      repeatedAffirmations,
      repeatedManifestations,
    },
  };
}
