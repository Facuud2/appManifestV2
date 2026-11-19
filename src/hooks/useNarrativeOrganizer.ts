'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import {
  connectAudioAnalyser,
  createSafeMediaRecorder,
  getMicrophoneStream,
} from '@/lib/microphone';
import { useAppStore } from '@/store';
import { preparePhoto } from '@/lib/imageProcessing';
import {
  extractVideoFramesFallback,
  isVideoFile,
  prepareVideo,
} from '@/lib/videoProcessing';
import { buildMediaStorageKey } from '@/lib/manifestationAttachments';
import { putMedia } from '@/lib/mediaStorage';
import { analyzeMediaAttachment } from '@/lib/mediaAnalysis';
import type { MediaAttachment } from '@/types';
import {
  countProposedItems,
  NARRATIVE_SCENARIOS,
  type ExistingContextItem,
  type ExistingAffirmationItem,
  type ExistingRampageItem,
  type ExistingSuccessStoryItem,
  type NarrativeChatMessage,
  type NarrativeCommitResult,
  type NarrativeDraft,
  type NarrativeScenario,
} from '@/lib/narrativeOrganizer';

export type NarrativePhase =
  | 'idle'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'review'
  | 'committing'
  | 'success'
  | 'error';

export type NarrativeErrorKind = 'analyze' | 'commit' | 'microphone' | 'quota';

export interface PendingChatAttachment {
  id: string;
  kind: 'photo' | 'video';
  attachment: MediaAttachment;
  blob: Blob;
  previewUrl: string;
}

interface UseNarrativeOrganizerProps {
  profileId: string;
  existingContext: ExistingContextItem[];
  existingAffirmations?: ExistingAffirmationItem[];
  existingRampages?: ExistingRampageItem[];
  existingSuccessStories?: ExistingSuccessStoryItem[];
  isSandboxMode?: boolean;
  onOpenManualCreate: () => void;
  onCommitted?: (
    result: NarrativeCommitResult,
    saveRampage: boolean,
    draft: NarrativeDraft
  ) => void;
  onClosed?: () => void;
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:([^;]+);base64/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

function readSandboxScenario(): NarrativeScenario | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fromStorage = window.localStorage.getItem('manifest_narrative_scenario');
    const fromUrl = new URLSearchParams(window.location.search).get('narrativeScenario');
    const scenario = fromUrl || fromStorage;
    if (scenario && (NARRATIVE_SCENARIOS as readonly string[]).includes(scenario)) {
      return scenario as NarrativeScenario;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function readSandboxSpeech(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('manifest_narrative_speech') || '';
  } catch {
    return '';
  }
}

export function useNarrativeOrganizer({
  profileId,
  existingContext,
  existingAffirmations,
  existingRampages,
  existingSuccessStories,
  isSandboxMode = false,
  onOpenManualCreate,
  onCommitted,
  onClosed,
}: UseNarrativeOrganizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<NarrativePhase>('idle');
  const [draft, setDraft] = useState<NarrativeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<NarrativeErrorKind | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [messages, setMessages] = useState<NarrativeChatMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingChatAttachment[]>([]);
  const [sessionAttachmentsCount, setSessionAttachmentsCount] = useState(0);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const isOpenRef = useRef(false);
  const phaseRef = useRef<NarrativePhase>('idle');
  const draftRef = useRef<NarrativeDraft | null>(null);
  const draftIdRef = useRef('');
  const isMountedRef = useRef(true);
  const messagesRef = useRef<NarrativeChatMessage[]>([]);
  const pendingAttachmentsRef = useRef<PendingChatAttachment[]>([]);
  const sessionAttachmentsRef = useRef<PendingChatAttachment[]>([]);
  const sessionUploadedMediaRef = useRef<
    Map<string, { name: string; uri: string; mimeType: string }>
  >(new Map());
  const processingAttachmentPromiseRef = useRef<Promise<void> | null>(null);
  const mediaBlobsForCommitRef = useRef<Map<string, Blob>>(new Map());
  const latestMediaAttachmentRef = useRef<{ attachment: MediaAttachment; blob: Blob } | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const vadIntervalRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const isLongPressActiveRef = useRef(false);
  const spacePressTimerRef = useRef<number | null>(null);
  const isSpaceHoldingRef = useRef(false);
  const ignoreSubmitUntilRef = useRef<number>(0);

  const profileIdRef = useRef(profileId);
  const existingContextRef = useRef(existingContext);
  const existingAffirmationsRef = useRef(existingAffirmations);
  const existingRampagesRef = useRef(existingRampages);
  const existingSuccessStoriesRef = useRef(existingSuccessStories);
  const callbacksRef = useRef({ onOpenManualCreate, onCommitted, onClosed });
  const isSandboxRef = useRef(isSandboxMode);

  useEffect(() => {
    profileIdRef.current = profileId;
    existingContextRef.current = existingContext;
    existingAffirmationsRef.current = existingAffirmations;
    existingRampagesRef.current = existingRampages;
    existingSuccessStoriesRef.current = existingSuccessStories;
    callbacksRef.current = { onOpenManualCreate, onCommitted, onClosed };
    isSandboxRef.current = isSandboxMode;
  }, [
    profileId,
    existingContext,
    existingAffirmations,
    existingRampages,
    existingSuccessStories,
    isSandboxMode,
    onOpenManualCreate,
    onCommitted,
    onClosed,
  ]);

  const setPhaseSafe = useCallback((next: NarrativePhase) => {
    phaseRef.current = next;
    if (isMountedRef.current) setPhase(next);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.onerror = null;
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    if (isMountedRef.current) setAnalyserNode(null);
  }, []);

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore
      }
      abortRef.current = null;
    }
  }, []);

  const appendMessages = useCallback((...newMsgs: NarrativeChatMessage[]) => {
    const next = [...messagesRef.current, ...newMsgs];
    messagesRef.current = next;
    if (isMountedRef.current) setMessages(next);
  }, []);

  const clearSessionAttachments = useCallback(() => {
    const seen = new Set<string>();
    const allItems = [...pendingAttachmentsRef.current, ...sessionAttachmentsRef.current];
    allItems.forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    });
    pendingAttachmentsRef.current = [];
    sessionAttachmentsRef.current = [];
    sessionUploadedMediaRef.current.clear();
    if (isMountedRef.current) {
      setPendingAttachments([]);
      setSessionAttachmentsCount(0);
      setAttachmentError(null);
    }
  }, []);

  const addAttachments = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    if (phaseRef.current === 'listening') {
      cleanupAudio();
      setPhaseSafe(draftRef.current || messagesRef.current.length > 0 ? 'review' : 'ready');
    }

    const run = async () => {
      setIsProcessingAttachment(true);
      setAttachmentError(null);

      const added: PendingChatAttachment[] = [];
      const remainingSlots = Math.max(0, 4 - pendingAttachmentsRef.current.length);
      for (const file of list.slice(0, remainingSlots)) {
        try {
          const lowerName = (file.name || '').toLowerCase();
          const isImage =
            file.type.startsWith('image/') ||
            /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(lowerName);

          if (isImage) {
            const prepared = await preparePhoto(file);
            const previewUrl = URL.createObjectURL(prepared.blob);
            const attachment: MediaAttachment = {
              kind: 'photo',
              thumbDataUrl: prepared.thumbDataUrl,
              mimeType: prepared.mimeType,
              width: prepared.width,
              height: prepared.height,
              byteSize: prepared.byteSize,
              storageKey: 'draft',
            };
            added.push({
              id: createDraftId(),
              kind: 'photo',
              attachment,
              blob: prepared.blob,
              previewUrl,
            });
            latestMediaAttachmentRef.current = { attachment, blob: prepared.blob };
          } else if (isVideoFile(file)) {
            const prepared = await prepareVideo(file);
            const previewUrl = URL.createObjectURL(prepared.blob);
            const attachment: MediaAttachment = {
              kind: 'video',
              thumbDataUrl: prepared.thumbDataUrl,
              mimeType: prepared.mimeType,
              width: prepared.width,
              height: prepared.height,
              durationSeconds: prepared.durationSeconds,
              byteSize: prepared.byteSize,
              storageKey: 'draft',
            };
            added.push({
              id: createDraftId(),
              kind: 'video',
              attachment,
              blob: prepared.blob,
              previewUrl,
            });
            latestMediaAttachmentRef.current = { attachment, blob: prepared.blob };
          } else {
            setAttachmentError('Solo podés adjuntar imágenes o videos.');
          }
        } catch (err) {
          setAttachmentError(
            err instanceof Error ? err.message : 'No pudimos procesar el archivo adjunto.'
          );
        }
      }

      if (added.length > 0 && isMountedRef.current) {
        const nextPending = [...pendingAttachmentsRef.current, ...added];
        pendingAttachmentsRef.current = nextPending;
        setPendingAttachments(nextPending);

        const nextSession = [...sessionAttachmentsRef.current, ...added].slice(-4);
        sessionAttachmentsRef.current = nextSession;
        setSessionAttachmentsCount(nextSession.length);
      }
      if (isMountedRef.current) setIsProcessingAttachment(false);
    };

    const promise = run().finally(() => {
      if (processingAttachmentPromiseRef.current === promise) {
        processingAttachmentPromiseRef.current = null;
      }
    });
    processingAttachmentPromiseRef.current = promise;
    await promise;
  }, [cleanupAudio, setPhaseSafe]);

  const removeAttachment = useCallback((id: string) => {
    const target =
      pendingAttachmentsRef.current.find((a) => a.id === id) ||
      sessionAttachmentsRef.current.find((a) => a.id === id);
    if (target) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch {
        // ignore
      }
    }
    const nextPending = pendingAttachmentsRef.current.filter((a) => a.id !== id);
    pendingAttachmentsRef.current = nextPending;
    const nextSession = sessionAttachmentsRef.current.filter((a) => a.id !== id);
    sessionAttachmentsRef.current = nextSession;
    sessionUploadedMediaRef.current.delete(id);
    if (nextSession.length === 0) {
      latestMediaAttachmentRef.current = null;
    } else {
      const last = nextSession[nextSession.length - 1];
      latestMediaAttachmentRef.current = { attachment: last.attachment, blob: last.blob };
    }
    if (isMountedRef.current) {
      setPendingAttachments(nextPending);
      setSessionAttachmentsCount(nextSession.length);
    }
  }, []);

  const attachLatestMediaToDraft = useCallback((nextDraft: NarrativeDraft): NarrativeDraft => {
    const latest = latestMediaAttachmentRef.current;
    if (!latest) return nextDraft;

    const plan = nextDraft.proposedPlan;
    const hasAnyMedia =
      plan.manifestations.some((m) => Boolean(m.mediaAttachment)) ||
      plan.progressLogs.some((p) => Boolean(p.mediaAttachment)) ||
      plan.affirmations.some((a) => Boolean(a.mediaAttachment));

    if (hasAnyMedia) return nextDraft;

    if (plan.progressLogs.length > 0) {
      const target = plan.progressLogs[0];
      const storageKey = buildMediaStorageKey(`${nextDraft.draftId}_${target.tempId}`);
      mediaBlobsForCommitRef.current.set(storageKey, latest.blob);
      target.mediaAttachment = { ...latest.attachment, storageKey };
    } else if (plan.manifestations.length > 0) {
      const target = plan.manifestations[0];
      const storageKey = buildMediaStorageKey(`${nextDraft.draftId}_${target.tempId}`);
      mediaBlobsForCommitRef.current.set(storageKey, latest.blob);
      target.mediaAttachment = { ...latest.attachment, storageKey };
    } else if (plan.affirmations.length > 0) {
      const target = plan.affirmations[0];
      const storageKey = buildMediaStorageKey(`${nextDraft.draftId}_${target.tempId}`);
      mediaBlobsForCommitRef.current.set(storageKey, latest.blob);
      target.mediaAttachment = { ...latest.attachment, storageKey };
    }
    return nextDraft;
  }, []);

  const uploadAttachmentDirectlyToGemini = useCallback(
    async (
      item: PendingChatAttachment,
      signal: AbortSignal,
    ): Promise<{ name: string; uri: string; mimeType: string }> => {
      const initRes = await fetch('/api/ai/narrative-organizer/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: item.attachment.mimeType,
          byteSize: item.blob.size,
          fileName: item.kind === 'video' ? 'chat_video.mp4' : 'chat_image.jpg',
        }),
        signal,
      });
      const initJson = await initRes.json().catch(() => null);
      if (!initRes.ok || !initJson?.success || !initJson?.uploadUrl) {
        throw new Error(initJson?.error || 'UPLOAD_INIT_FAILED');
      }

      const uploadRes = await fetch(initJson.uploadUrl as string, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: item.blob,
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error('DIRECT_UPLOAD_FAILED');
      }

      const uploadJson = (await uploadRes.json().catch(() => null)) as {
        file?: { name?: string; uri?: string; mimeType?: string };
      } | null;

      const fileObj = uploadJson?.file;
      if (!fileObj?.name || !fileObj?.uri) {
        throw new Error('DIRECT_UPLOAD_INVALID_RESPONSE');
      }

      return {
        name: fileObj.name,
        uri: fileObj.uri,
        mimeType: fileObj.mimeType || (initJson.mimeType as string) || item.attachment.mimeType,
      };
    },
    [],
  );

  const submitNarrativePayload = useCallback(
    async (payload: {
      audioBlob?: Blob;
      text?: string;
      attachments?: PendingChatAttachment[];
      displayAttachments?: PendingChatAttachment[];
      isVoice?: boolean;
    }) => {
      setPhaseSafe('processing');
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const formData = new FormData();
        if (payload.audioBlob) {
          const ext =
            payload.audioBlob.type.includes('mp4') || payload.audioBlob.type.includes('aac')
              ? 'mp4'
              : 'webm';
          formData.append('audio', payload.audioBlob, `narrative.${ext}`);
        }
        if (payload.text) {
          formData.append('text', payload.text);
        }

        if (payload.attachments && payload.attachments.length > 0) {
          formData.append('hasMediaAttachments', 'true');
          const uploadedMediaList: Array<{ name: string; uri: string; mimeType: string }> = [];

          for (let index = 0; index < payload.attachments.length; index++) {
            const item = payload.attachments[index];
            const ext = item.attachment.mimeType.includes('png')
              ? 'png'
              : item.attachment.mimeType.includes('webp')
                ? 'webp'
                : item.kind === 'video'
                  ? 'mp4'
                  : 'jpg';

            if (isSandboxRef.current) {
              if (item.blob.size <= 1024 * 1024) {
                formData.append('media', item.blob, `attachment_${index}.${ext}`);
              }
              continue;
            }

            const cachedUploaded = sessionUploadedMediaRef.current.get(item.id);
            if (cachedUploaded) {
              uploadedMediaList.push(cachedUploaded);
              continue;
            }

            // Videos (or files > 3 MB) are uploaded directly to Gemini Files API so they
            // never hit Vercel's 4.5 MB function payload limit.
            if (item.kind === 'video' || item.blob.size > 3 * 1024 * 1024) {
              try {
                const uploaded = await uploadAttachmentDirectlyToGemini(item, controller.signal);
                sessionUploadedMediaRef.current.set(item.id, uploaded);
                uploadedMediaList.push(uploaded);
                continue;
              } catch (directErr) {
                if (directErr instanceof DOMException && directErr.name === 'AbortError') {
                  throw directErr;
                }
                // Fallback if direct browser upload to generativelanguage.googleapis.com was blocked:
                if (item.blob.size <= 3.5 * 1024 * 1024) {
                  formData.append('media', item.blob, `attachment_${index}.${ext}`);
                } else if (item.kind === 'video') {
                  const frames = await extractVideoFramesFallback(item.blob, 4);
                  if (frames.length > 0) {
                    frames.forEach((frame, frameIdx) => {
                      formData.append('media', frame, `video_frame_${index}_${frameIdx}.jpg`);
                    });
                  } else if (item.attachment.thumbDataUrl) {
                    const posterBlob = dataUrlToBlob(item.attachment.thumbDataUrl);
                    if (posterBlob) {
                      formData.append('media', posterBlob, `video_poster_${index}.jpg`);
                    }
                  }
                }
                continue;
              }
            }

            formData.append('media', item.blob, `attachment_${index}.${ext}`);
          }

          if (uploadedMediaList.length > 0) {
            formData.append('uploadedMedia', JSON.stringify(uploadedMediaList));
          }
        }

        // Lazy media analysis: if user text references an existing manifestation with media
        // that does not have aiSummary yet, analyze it now and persist to Turso before calling AI.
        let enrichedExistingContext = existingContextRef.current;
        const spokenLower = (payload.text || '').toLowerCase().trim();
        if (spokenLower.length >= 3) {
          const storeState = useAppStore.getState();
          const candidates = storeState.manifestations
            .filter(
              (m) =>
                m.userId === profileIdRef.current &&
                m.mediaAttachment &&
                !m.mediaAttachment.aiSummary &&
                m.title.trim().length >= 3 &&
                spokenLower.includes(m.title.trim().toLowerCase())
            )
            .slice(0, 2);

          if (candidates.length > 0) {
            const analyzedEntries = await Promise.all(
              candidates.map(async (m) => {
                if (!m.mediaAttachment) return null;
                const res = await analyzeMediaAttachment({
                  mediaAttachment: m.mediaAttachment,
                  title: m.title,
                  description: m.description,
                  sandbox: isSandboxRef.current,
                });
                if (res?.aiSummary) {
                  void storeState.updateManifestationMediaSummary(
                    m.id,
                    res.aiSummary,
                    res.aiSummaryAt
                  );
                  return { id: m.id, aiSummary: res.aiSummary };
                }
                return null;
              })
            );

            const summaryById = new Map<string, string>();
            analyzedEntries.forEach((entry) => {
              if (entry) summaryById.set(entry.id, entry.aiSummary);
            });
            if (summaryById.size > 0) {
              enrichedExistingContext = existingContextRef.current.map((ctx) =>
                summaryById.has(ctx.id)
                  ? { ...ctx, mediaSummary: summaryById.get(ctx.id) }
                  : ctx
              );
            }
          }
        }

        formData.append('profileId', profileIdRef.current);
        formData.append('draftId', draftIdRef.current);
        formData.append('existingContext', JSON.stringify(enrichedExistingContext));
        if (existingAffirmationsRef.current) {
          formData.append('existingAffirmations', JSON.stringify(existingAffirmationsRef.current));
        }
        if (existingRampagesRef.current) {
          formData.append('existingRampages', JSON.stringify(existingRampagesRef.current));
        }
        if (existingSuccessStoriesRef.current) {
          formData.append('existingSuccessStories', JSON.stringify(existingSuccessStoriesRef.current));
        }
        if (draftRef.current) {
          formData.append(
            'currentDraft',
            JSON.stringify(draftRef.current, (key, value) =>
              key === 'thumbDataUrl' ? undefined : value,
            ),
          );
        }
        if (messagesRef.current.length > 0) {
          formData.append(
            'conversationHistory',
            JSON.stringify(
              messagesRef.current.map((m) => ({ role: m.role, text: m.text }))
            )
          );
        }

        if (isSandboxRef.current) {
          formData.append('sandbox', 'true');
          const scenario = readSandboxScenario();
          if (scenario) formData.append('scenario', scenario);
          const speech = payload.text || readSandboxSpeech();
          if (speech) formData.append('spokenText', speech);
        }

        const res = await fetch('/api/ai/narrative-organizer', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);

        if (!isMountedRef.current) return;

        if (res.status === 429) {
          setError(
            json?.error ||
              'Límite diario de IA alcanzado. Se renueva a la medianoche UTC.'
          );
          setErrorKind('quota');
          setPhaseSafe('error');
          return;
        }

        if (!res.ok || !json?.success || !json?.data) {
          setError(json?.error || 'No se pudo organizar tu relato. Probá de nuevo.');
          setErrorKind('analyze');
          setPhaseSafe('error');
          return;
        }

        const nextDraft = attachLatestMediaToDraft(json.data as NarrativeDraft);
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setError(null);
        setErrorKind(null);

        if (payload.isVoice) {
          const shownAttachments = payload.displayAttachments ?? payload.attachments;
          appendMessages(
            {
              id: createDraftId(),
              role: 'user',
              text: nextDraft.userTranscript || payload.text || 'Nota de voz',
              attachments:
                shownAttachments && shownAttachments.length > 0
                  ? shownAttachments.map((a) => ({
                      id: a.id,
                      kind: a.kind,
                      thumbDataUrl: a.attachment.thumbDataUrl,
                      mimeType: a.attachment.mimeType,
                      byteSize: a.attachment.byteSize,
                    }))
                  : undefined,
              timestamp: Date.now(),
            },
            {
              id: createDraftId(),
              role: 'assistant',
              text: nextDraft.siriResponse,
              timestamp: Date.now(),
            }
          );
        } else {
          appendMessages({
            id: createDraftId(),
            role: 'assistant',
            text: nextDraft.siriResponse,
            timestamp: Date.now(),
          });
        }

        setPhaseSafe('review');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo procesar tu solicitud. Comprobá tu conexión.'
        );
        setErrorKind('analyze');
        setPhaseSafe('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [appendMessages, attachLatestMediaToDraft, setPhaseSafe, uploadAttachmentDirectlyToGemini]
  );

  const sendAudioToServer = useCallback(
    async (audioBlob: Blob, extraText?: string) => {
      if (processingAttachmentPromiseRef.current) {
        await processingAttachmentPromiseRef.current;
      }
      const pending = [...pendingAttachmentsRef.current];
      if (pending.length > 0) {
        pendingAttachmentsRef.current = [];
        if (isMountedRef.current) {
          setPendingAttachments([]);
          setAttachmentError(null);
        }
      }
      const effectiveAttachments =
        pending.length > 0 ? pending : [...sessionAttachmentsRef.current];
      const trimmedExtra = extraText?.trim() || undefined;

      await submitNarrativePayload({
        audioBlob,
        text: trimmedExtra,
        attachments: effectiveAttachments.length > 0 ? effectiveAttachments : undefined,
        displayAttachments: pending.length > 0 ? pending : undefined,
        isVoice: true,
      });
    },
    [submitNarrativePayload]
  );

  const sendChatMessage = useCallback(
    async (rawText: string) => {
      if (phaseRef.current === 'processing' || phaseRef.current === 'committing') return;
      if (processingAttachmentPromiseRef.current) {
        await processingAttachmentPromiseRef.current;
      }
      const trimmed = rawText.trim();
      const pending = [...pendingAttachmentsRef.current];
      if (!trimmed && pending.length === 0) return;

      cleanupAudio();
      setError(null);
      setErrorKind(null);

      appendMessages({
        id: createDraftId(),
        role: 'user',
        text:
          trimmed ||
          (pending[0]?.kind === 'video' ? 'Video adjunto' : 'Imagen adjunta'),
        attachments:
          pending.length > 0
            ? pending.map((a) => ({
                id: a.id,
                kind: a.kind,
                thumbDataUrl: a.attachment.thumbDataUrl,
                mimeType: a.attachment.mimeType,
                byteSize: a.attachment.byteSize,
              }))
            : undefined,
        timestamp: Date.now(),
      });

      // Clear pending attachments from composer (blobs remain in sessionAttachmentsRef until close/confirm)
      pendingAttachmentsRef.current = [];
      if (isMountedRef.current) {
        setPendingAttachments([]);
        setAttachmentError(null);
      }

      const effectiveAttachments =
        pending.length > 0 ? pending : [...sessionAttachmentsRef.current];

      await submitNarrativePayload({
        text: trimmed,
        attachments: effectiveAttachments.length > 0 ? effectiveAttachments : undefined,
        isVoice: false,
      });
    },
    [appendMessages, cleanupAudio, submitNarrativePayload]
  );

  const pauseListening = useCallback(() => {
    if (phaseRef.current !== 'listening') return;
    cleanupAudio();
    setPhaseSafe(draftRef.current || messagesRef.current.length > 0 ? 'review' : 'ready');
  }, [cleanupAudio, setPhaseSafe]);

  const finishAndSubmit = useCallback(
    (extraText?: string) => {
      if (Date.now() < ignoreSubmitUntilRef.current) return;
      if (phaseRef.current === 'processing' || phaseRef.current === 'committing') return;
      if (abortRef.current) return;

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        if (isSandboxRef.current) {
          const dummy = new Blob([new Uint8Array(256)], { type: 'audio/webm' });
          void sendAudioToServer(dummy, extraText);
          return;
        }
        cleanupAudio();
        if (extraText && extraText.trim()) {
          void submitNarrativePayload({ text: extraText.trim(), isVoice: false });
          return;
        }
        setPhaseSafe(draftRef.current || messagesRef.current.length > 0 ? 'review' : 'ready');
        return;
      }

      recorder.onstop = () => {
        const mime = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (!isSandboxRef.current && blob.size < 400) {
          cleanupAudio();
          setPhaseSafe(draftRef.current || messagesRef.current.length > 0 ? 'review' : 'ready');
          return;
        }
        void sendAudioToServer(blob, extraText);
      };

      try {
        recorder.stop();
      } catch {
        const mime = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (!isSandboxRef.current && blob.size < 400) {
          cleanupAudio();
          setPhaseSafe(draftRef.current || messagesRef.current.length > 0 ? 'review' : 'ready');
          return;
        }
        void sendAudioToServer(blob, extraText);
      }
    },
    [cleanupAudio, sendAudioToServer, setPhaseSafe, submitNarrativePayload]
  );

  const startListening = useCallback(async () => {
    if (phaseRef.current === 'processing' || phaseRef.current === 'committing') return;

    try {
      void audioEngine?.unlock('record');
    } catch {
      // ignore
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {
        // ignore
      }
    }

    cleanupAudio();
    setError(null);
    setErrorKind(null);
    setPhaseSafe('listening');
    setHoldProgress(0);

    // Sandbox: deterministic flow without asking for a real microphone.
    if (isSandboxRef.current) {
      return;
    }

    try {
      const stream = await getMicrophoneStream();
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const { analyser } = connectAudioAnalyser(ctx, stream);
        setAnalyserNode(analyser);

        const vadBuffer = new Uint8Array(analyser.frequencyBinCount);
        let noiseFloor = 14;
        let calibrationSamples = 0;
        let noiseSum = 0;

        vadIntervalRef.current = window.setInterval(() => {
          if (phaseRef.current !== 'listening') return;
          analyser.getByteFrequencyData(vadBuffer as unknown as Uint8Array<ArrayBuffer>);
          let sum = 0;
          for (let i = 0; i < vadBuffer.length; i += 1) sum += vadBuffer[i];
          const avg = sum / vadBuffer.length;

          if (calibrationSamples < 5) {
            noiseSum += avg;
            calibrationSamples += 1;
            noiseFloor = Math.max(10, Math.min(30, Math.round(noiseSum / calibrationSamples)));
            return;
          }

          const speechThreshold = Math.max(22, Math.min(45, noiseFloor + 10));
          if (avg > speechThreshold) {
            hasSpokenRef.current = true;
            if (silenceTimerRef.current !== null) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasSpokenRef.current && silenceTimerRef.current === null) {
            silenceTimerRef.current = window.setTimeout(() => {
              finishAndSubmit();
            }, 2000);
          }
        }, 100);
      }

      const { recorder, mimeType } = createSafeMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      try {
        if (mimeType.includes('webm')) recorder.start(250);
        else recorder.start();
      } catch {
        recorder.start();
      }

      maxDurationTimerRef.current = window.setTimeout(() => {
        finishAndSubmit();
      }, 90_000);
    } catch (micError: unknown) {
      const name = (micError as { name?: string })?.name;
      const isNotAllowed = name === 'NotAllowedError' || name === 'PermissionDeniedError';
      const isUnsecure = typeof window !== 'undefined' && !window.isSecureContext;
      setError(
        isUnsecure
          ? 'En iOS Safari el micrófono requiere una conexión HTTPS segura.'
          : isNotAllowed
            ? 'El acceso al micrófono fue denegado. Habilitá el permiso en Ajustes > Safari.'
            : 'No se detectó el micrófono. Comprobá que esté habilitado e intentá de nuevo.'
      );
      setErrorKind('microphone');
      setPhaseSafe('error');
    }
  }, [cleanupAudio, finishAndSubmit, setPhaseSafe]);

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    draftIdRef.current = createDraftId();
    draftRef.current = null;
    messagesRef.current = [];
    mediaBlobsForCommitRef.current.clear();
    latestMediaAttachmentRef.current = null;
    clearSessionAttachments();
    setMessages([]);
    setDraft(null);
    setError(null);
    setErrorKind(null);
    isOpenRef.current = true;
    setIsOpen(true);
    void startListening();
  }, [clearSessionAttachments, startListening]);

  const reRecord = useCallback(() => {
    // Keep the current draft: the new audio is a correction over it.
    void startListening();
  }, [startListening]);

  const closeOverlay = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    setHoldProgress(0);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      draftRef.current = null;
      messagesRef.current = [];
      mediaBlobsForCommitRef.current.clear();
      latestMediaAttachmentRef.current = null;
      clearSessionAttachments();
      if (isMountedRef.current) {
        setDraft(null);
        setMessages([]);
      }
      setError(null);
      setErrorKind(null);
      setPhaseSafe('idle');
      callbacksRef.current.onClosed?.();
    }, 240);
  }, [clearSessionAttachments, setPhaseSafe]);

  const cancelAll = useCallback(() => {
    // Stop the microphone and in-flight request immediately, but keep the
    // visual state for one exit beat so the sheet animates out cleanly.
    abortInFlight();
    cleanupAudio();
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    isLongPressActiveRef.current = false;
    isOpenRef.current = false;
    setIsOpen(false);
    setHoldProgress(0);
    closeTimerRef.current = window.setTimeout(() => {
      draftRef.current = null;
      messagesRef.current = [];
      mediaBlobsForCommitRef.current.clear();
      latestMediaAttachmentRef.current = null;
      clearSessionAttachments();
      if (isMountedRef.current) {
        setDraft(null);
        setMessages([]);
        setError(null);
        setErrorKind(null);
        setPhase('idle');
        phaseRef.current = 'idle';
      }
    }, 240);
  }, [abortInFlight, cleanupAudio, clearSessionAttachments]);

  const confirm = useCallback(async (saveRampage = true) => {
    const current = draftRef.current;
    if (!current || phaseRef.current === 'committing') return;

    setPhaseSafe('committing');
    setError(null);
    setErrorKind(null);

    try {
      const res = await fetch('/api/ai/narrative-organizer/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: current.draftId,
          profileId: profileIdRef.current,
          currentDraft: current,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success || !json?.data) {
        setError(json?.error || 'No se pudo guardar. Probá de nuevo.');
        setErrorKind('commit');
        setPhaseSafe('error');
        return;
      }

      const result = json.data as NarrativeCommitResult;

      // Persist any attached media blobs into IndexedDB under their storageKeys
      if (mediaBlobsForCommitRef.current.size > 0) {
        const storageKeysToSave = new Set<string>();
        current.proposedPlan.manifestations.forEach((m) => {
          if (m.mediaAttachment?.storageKey) storageKeysToSave.add(m.mediaAttachment.storageKey);
        });
        current.proposedPlan.progressLogs.forEach((p) => {
          if (p.mediaAttachment?.storageKey) storageKeysToSave.add(p.mediaAttachment.storageKey);
        });
        current.proposedPlan.affirmations.forEach((a) => {
          if (a.mediaAttachment?.storageKey) storageKeysToSave.add(a.mediaAttachment.storageKey);
        });
        await Promise.all(
          Array.from(storageKeysToSave).map((key) => {
            const blob = mediaBlobsForCommitRef.current.get(key);
            return blob ? putMedia(key, blob) : Promise.resolve(false);
          })
        );
      }

      useAppStore.getState().applyNarrativeCommit(result);

      // Background auto-analysis for newly created manifestations that have media without aiSummary
      if (Array.isArray(result.manifestations) && result.manifestations.length > 0) {
        const storeActions = useAppStore.getState();
        result.manifestations.forEach((created) => {
          if (created.mediaAttachment && !created.mediaAttachment.aiSummary) {
            const blob = mediaBlobsForCommitRef.current.get(created.mediaAttachment.storageKey);
            void analyzeMediaAttachment({
              mediaAttachment: created.mediaAttachment,
              blob: blob ?? null,
              title: created.title,
              description: created.description,
              sandbox: isSandboxRef.current,
            }).then((res) => {
              if (res?.aiSummary) {
                void storeActions.updateManifestationMediaSummary(
                  created.id,
                  res.aiSummary,
                  res.aiSummaryAt
                );
              }
            });
          }
        });
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([20, 40, 20]);
        } catch {
          // ignore
        }
      }

      setPhaseSafe('success');
      callbacksRef.current.onCommitted?.(result, saveRampage, current);

      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        closeOverlay();
      }, 650);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar. Comprobá tu conexión.'
      );
      setErrorKind('commit');
      setPhaseSafe('error');
    }
  }, [closeOverlay, setPhaseSafe]);

  /* ----------------------------- long press ----------------------------- */

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      try {
        void audioEngine?.unlock('record');
      } catch {
        // ignore
      }
      pointerStartYRef.current = event.clientY;
      isLongPressActiveRef.current = false;
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        isLongPressActiveRef.current = true;
        open();
      }, 300);
    },
    [open]
  );

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (pointerStartYRef.current === null) return;
    if (Math.abs(event.clientY - pointerStartYRef.current) > 8) {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressActiveRef.current) {
      callbacksRef.current.onOpenManualCreate();
    }
    isLongPressActiveRef.current = false;
  }, []);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /* --------------------------- keyboard space --------------------------- */

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();

      if (event.repeat) return;
      if (isSpaceHoldingRef.current || isOpenRef.current) return;
      isSpaceHoldingRef.current = true;
      spacePressTimerRef.current = window.setTimeout(() => {
        ignoreSubmitUntilRef.current = Date.now() + 600;
        open();
      }, 300);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      isSpaceHoldingRef.current = false;
      if (spacePressTimerRef.current !== null) {
        window.clearTimeout(spacePressTimerRef.current);
        spacePressTimerRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open]);

  /* ------------------------------ lifecycle ------------------------------ */

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortInFlight();
      cleanupAudio();
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (spacePressTimerRef.current !== null) window.clearTimeout(spacePressTimerRef.current);
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    };
  }, [abortInFlight, cleanupAudio]);

  // Switching profile must never leak a draft into the wrong profile.
  useEffect(() => {
    cancelAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
    };
  }, [isOpen]);

  const toggleItemAction = useCallback(
    (kind: 'manifestation' | 'affirmation', tempId: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        if (kind === 'manifestation') {
          const manifestations = prev.proposedPlan.manifestations.map((m) => {
            if (m.tempId !== tempId) return m;
            const nextAction: 'repeat' | 'create_new' =
              m.action === 'create_new' ? 'repeat' : 'create_new';
            return { ...m, action: nextAction };
          });
          const nextDraft = {
            ...prev,
            proposedPlan: { ...prev.proposedPlan, manifestations },
          };
          draftRef.current = nextDraft;
          return nextDraft;
        } else {
          const affirmations = prev.proposedPlan.affirmations.map((a) => {
            if (a.tempId !== tempId) return a;
            const nextAction: 'repeat' | 'create_new' =
              a.action === 'create_new' ? 'repeat' : 'create_new';
            return { ...a, action: nextAction };
          });
          const nextDraft = {
            ...prev,
            proposedPlan: { ...prev.proposedPlan, affirmations },
          };
          draftRef.current = nextDraft;
          return nextDraft;
        }
      });
    },
    []
  );

  /* ------------------------------- derived -------------------------------- */

  const itemCount = draft ? countProposedItems(draft.proposedPlan) : 0;
  const canConfirm = itemCount > 0 && phase === 'review';
  const canRetryCommit = Boolean(draft) && itemCount > 0 && errorKind === 'commit';

  return {
    isOpen,
    phase,
    draft,
    messages,
    pendingAttachments,
    sessionAttachmentsCount,
    isProcessingAttachment,
    attachmentError,
    transcript: draft?.userTranscript || '',
    siriResponse: draft?.siriResponse || '',
    error,
    errorKind,
    analyserNode,
    holdProgress,
    itemCount,
    canConfirm,
    canRetryCommit,
    open,
    reRecord,
    pauseListening,
    finishAndSubmit,
    sendChatMessage,
    addAttachments,
    removeAttachment,
    confirm,
    cancelAll,
    toggleItemAction,
    buttonGestureProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    },
  };
}
