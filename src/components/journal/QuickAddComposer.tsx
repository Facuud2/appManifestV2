'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { AlertCircle, ArrowUp, Check, Plus } from 'lucide-react';
import { VoiceDictationButton } from '@/components/ui/VoiceDictationButton';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export type QuickAddTone = 'rose' | 'butter';

export interface QuickAddAdvancedAction {
  label: string;
  onClick: () => void;
}

export interface QuickAddComposerHandle {
  submitAndClose: () => boolean;
}

export interface QuickAddComposerProps {
  /** Visible label for the group and the field. */
  label: string;
  placeholder: string;
  /** Content pigment: rose for affirmations, butter for manifestations. */
  tone: QuickAddTone;
  /** `manifestation` moves the actions into the Gemini-style bottom toolbar. */
  variant?: 'default' | 'manifestation';
  isOpen: boolean;
  onClose: () => void;
  /**
   * Pointer dismissal (tap/click outside the panel). Kept separate from
   * `onClose` so the page does not steal focus back to the opener when the
   * user taps elsewhere on purpose.
   */
  onDismiss?: () => void;
  /** Must update the store optimistically. The composer clears the field without waiting. */
  onSubmit: (text: string) => Promise<unknown> | unknown;
  /** Called right after a save is initiated, useful for the new-card flash. */
  onSaved?: () => void;
  onDraftChange?: (draft: string) => void;
  savedLabel: string;
  /** Shorter chip label used on narrow screens. */
  savedLabelShort?: string;
  submitAriaLabel: string;
  hint: string;
  /** Simpler hint for the dock, where the + button is the visible action. */
  hintMobile?: string;
  maxRows?: number;
  /** Extra controls (manifestation title / sensory anchor) rendered under the field. */
  options?: React.ReactNode;
  /** Attachment menu / add button rendered at the start of the bottom toolbar. */
  leadingAction?: React.ReactNode;
  /** Attachment chips rendered above the textarea. */
  attachments?: React.ReactNode;
  /** Disables the pointer dismissal (click outside) while a modal/sheet child is active. */
  disableDismiss?: boolean;
  /** Disables the primary submit while media is being processed. */
  submitDisabled?: boolean;
  /** Quiet escape hatch to the full editor. Desktop footer only. */
  advancedAction?: QuickAddAdvancedAction;
  /** Non-blocking inline language warning, derived from the current draft. */
  getWarning?: (text: string) => string | null;
  onWarningChange?: (warning: string | null) => void;
  dictationSample?: string;
  /**
   * Toast shown after "Listo" saves and closes the composer when nothing had
   * been saved during the current burst (the inline chip is not visible then).
   */
  savedToast?: string;
}

const MAX_LENGTH = 500;

export const QuickAddComposer = React.forwardRef<
  QuickAddComposerHandle,
  QuickAddComposerProps
>(function QuickAddComposer(
  {
    label,
    placeholder,
    tone,
    variant = 'default',
    isOpen,
    onClose,
    onDismiss,
    onSubmit,
    onSaved,
    onDraftChange,
    savedLabel,
    savedLabelShort,
    submitAriaLabel,
    hint,
    hintMobile,
    maxRows = 3,
    options,
    leadingAction,
    attachments,
    disableDismiss = false,
    submitDisabled = false,
    advancedAction,
    getWarning,
    onWarningChange,
    dictationSample,
    savedToast,
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  const isManifestation = variant === 'manifestation';
  const fieldId = useId();
  const labelId = useId();
  const hintId = useId();
  const warningId = useId();

  const dockRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const submitLockRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  const [draft, setDraft] = useState('');
  const onDraftChangeRef = useRef(onDraftChange);
  const [savedCount, setSavedCount] = useState(0);
  const [justSaved, setJustSaved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [offlineNotice, setOfflineNotice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastHost, setToastHost] = useState<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  /* The toast must escape any transformed page wrapper, so it lives on <body>. */
  useEffect(() => {
    setToastHost(document.body);
  }, []);

  const showSavedToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage(null);
    }, 2600);
  }, []);

  /*
   * The mobile dock is fixed, so a filtered ancestor would become its containing
   * block and park it at the end of the page. Portal it to the body so it always
   * sits on the viewport. The 640px+ strip stays in the document flow.
   */
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639.98px)');
    const update = () => setPortalNode(mobile.matches ? document.body : null);
    update();
    mobile.addEventListener('change', update);
    return () => mobile.removeEventListener('change', update);
  }, []);

  /*
   * Outside press dismisses the composer, the way a bottom sheet behaves.
   * Listening on `click` (not pointerdown) lets React run the opener's own
   * toggle first, so clicking "Listo" or the Crear bead never closes and
   * immediately reopens the panel. The draft is cleared on close.
   */
  useEffect(() => {
    if (!isOpen || disableDismiss) return;
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // If the clicked target was unmounted during click handling (e.g. portal menu item clicked), ignore
      if (!target.isConnected) return;
      if (composerRef.current?.contains(target)) return;
      const el = target instanceof HTMLElement ? target : target.parentElement;
      if (el?.closest?.('[data-quick-add-trigger]')) return;
      if (el?.closest?.('[data-quick-add-portal]')) return;
      if (el?.closest?.('[role="menu"][aria-label*="Adjuntar"]')) return;
      if (el?.closest?.('[role="dialog"][aria-labelledby="music-search-title"]')) return;
      (onDismiss ?? onClose)();
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [isOpen, disableDismiss, onClose, onDismiss]);

  const warning = getWarning && draft.trim() ? getWarning(draft) : null;

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    onWarningChange?.(warning);
  }, [warning, onWarningChange]);

  const updateDraft = useCallback(
    (next: string) => {
      setDraft(next);
      setOfflineNotice(false);
      setSubmitError(null);
      onDraftChange?.(next);
    },
    [onDraftChange],
  );

  /* Native chrome follows the dock: hide the mobile bar and reserve space. */
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previous = root.dataset.quickAddOpen;
    root.dataset.quickAddOpen = 'true';
    return () => {
      if (previous === undefined) {
        delete root.dataset.quickAddOpen;
      } else {
        root.dataset.quickAddOpen = previous;
      }
    };
  }, [isOpen]);

  /*
   * Pin the dock to the bottom of what the user can actually see.
   *
   * iOS keeps the keyboard on top of the layout viewport and pans the visual
   * viewport as the page scrolls. A `bottom: 0` fixed dock then slides behind
   * the keyboard after the first couple of saves and the user keeps typing
   * into a field they cannot see. Deriving the offset from `visualViewport`
   * works for both models: when the layout viewport is resized the inset is 0,
   * and when it is not (or has been panned) the dock follows the visible edge.
   */
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const inset =
        viewport.scale > 1.01
          ? 0
          : Math.max(
              0,
              Math.round(
                window.innerHeight - viewport.height - viewport.offsetTop,
              ),
            );

      root.style.setProperty('--quick-add-kb-inset', `${inset}px`);
      if (inset > 40) {
        root.dataset.quickAddKeyboard = 'true';
      } else {
        delete root.dataset.quickAddKeyboard;
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('orientationchange', schedule);
      root.style.removeProperty('--quick-add-kb-inset');
      delete root.dataset.quickAddKeyboard;
    };
  }, [isOpen]);

  /* Measure the dock so the last card never hides behind it on mobile. */
  useEffect(() => {
    if (!isOpen) return;
    const dock = dockRef.current;
    if (!dock) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty(
        '--quick-add-dock-space',
        `${Math.ceil(dock.getBoundingClientRect().height + 16)}px`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);

    return () => {
      observer.disconnect();
      root.style.removeProperty('--quick-add-dock-space');
    };
  }, [isOpen]);

  /* Focus the field on open and bring the strip into view on desktop. */
  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      fieldRef.current?.focus({ preventScroll: true });
      if (window.matchMedia('(min-width: 640px)').matches) {
        composerRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, prefersReducedMotion]);

  /* Grow the field with its content, up to the row cap. */
  useEffect(() => {
    const resizeField = () => {
      const field = fieldRef.current;
      if (!field) return;
      field.style.height = 'auto';
      const styles = window.getComputedStyle(field);
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
      const maxHeight = lineHeight * maxRows;
      field.style.height = `${Math.min(field.scrollHeight, maxHeight)}px`;
      field.style.overflowY = field.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    resizeField();
    // Reflow the field when the viewport changes (rotation, split screen, the
    // mobile dock going from 390px to 320px, or the keyboard suggestions bar
    // changing height), otherwise the text can clip.
    window.addEventListener('resize', resizeField);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', resizeField);
    return () => {
      window.removeEventListener('resize', resizeField);
      viewport?.removeEventListener('resize', resizeField);
    };
  }, [draft, isOpen, maxRows]);

  /*
   * Closing resets the burst counter and clears the draft, so a composer that
   * was dismissed (tap outside, Escape, header Listo) always reopens empty
   * instead of keeping stale text.
   */
  useEffect(() => {
    if (isOpen) return;
    setSavedCount(0);
    setJustSaved(false);
    setAnnouncement('');
    setOfflineNotice(false);
    setSubmitError(null);
    setDraft('');
    onDraftChangeRef.current?.('');
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const submit = useCallback(
    (closeAfter: boolean) => {
      const text = draft.trim();
      if (!text || submitLockRef.current || submitDisabled) return;

      submitLockRef.current = true;
      window.setTimeout(() => {
        submitLockRef.current = false;
      }, 0);

      const nextCount = savedCount + 1;
      // Only the first save of a burst is silent in the UI when the composer
      // closes, because the inline "guardada" chip disappears with it.
      const isFirstSave = savedCount === 0;
      setSavedCount(nextCount);
      setJustSaved(true);
      setAnnouncement(`${savedLabel}. ${nextCount} en esta ráfaga.`);
      updateDraft('');
      setOfflineNotice(
        typeof navigator !== 'undefined' && navigator.onLine === false,
      );
      setSubmitError(null);

      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = window.setTimeout(() => {
        setJustSaved(false);
      }, 1200);

      // The store updates its list before the request settles, so the field
      // can clear immediately and keep the burst going. onSaved runs after the
      // call so the parent can find the new item at the top of the list.
      Promise.resolve(onSubmit(text)).catch(() => {
        setSubmitError('No se pudo guardar. Inténtalo de nuevo.');
      });
      onSaved?.();

      if (closeAfter) {
        if (isFirstSave && savedToast) {
          showSavedToast(savedToast);
        }
        onClose();
      } else {
        // Keep the burst going without re-focusing a field that already has
        // focus: a programmatic focus mid-typing makes iOS Safari scroll the
        // viewport and can leave the dock behind the keyboard.
        window.requestAnimationFrame(() => {
          const field = fieldRef.current;
          if (field && document.activeElement !== field) {
            field.focus({ preventScroll: true });
          }
        });
      }
    },
    [
      draft,
      onClose,
      onSaved,
      onSubmit,
      savedCount,
      savedLabel,
      savedToast,
      showSavedToast,
      submitDisabled,
      updateDraft,
    ],
  );

  const handleDone = useCallback(() => {
    if (draft.trim()) {
      submit(true);
      return true;
    }
    onClose();
    return false;
  }, [draft, submit, onClose]);

  /*
   * The Gemini-style arrow saves the manifestation and closes the composer, so
   * the user lands on the card that just appeared. Enter (form submit) keeps
   * the burst going instead.
   */
  const handleArrowSubmit = useCallback(() => {
    if (!draft.trim() || submitDisabled) return;
    submit(true);
  }, [draft, submit, submitDisabled]);

  useImperativeHandle(
    ref,
    () => ({
      submitAndClose: handleDone,
    }),
    [handleDone],
  );

  const handleFieldKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    // IME composition and key repeat must not create duplicate entries.
    if (
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      event.repeat
    ) {
      return;
    }

    event.preventDefault();
    submit(event.metaKey || event.ctrlKey);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const composerVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.18, ease: EMIL_EASE_OUT },
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -4,
      transition: { duration: 0.14, ease: EMIL_EASE_OUT },
    },
  };

  const describedBy = [hintId, warning ? warningId : null].filter(Boolean).join(' ');

  const composer = (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="quick-add"
          ref={dockRef}
          variants={composerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="quick-add-dock fixed inset-x-0 z-50 px-3 sm:static sm:z-auto sm:px-0 sm:pb-0"
        >
          <form
            ref={composerRef}
            onSubmit={(event) => {
              event.preventDefault();
              submit(false);
            }}
            onKeyDown={handleComposerKeyDown}
            role="group"
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            data-tone={tone}
            data-variant={variant}
            className="quick-add-composer mx-auto w-full px-3.5 py-3 sm:px-5 sm:py-4"
          >
            <span className="qa-refract" aria-hidden="true" />
            <span className="qa-tint" aria-hidden="true" />
            <span className="qa-sheen" aria-hidden="true" />
            <span className="qa-rim" aria-hidden="true" />

            <div className="relative z-[4]">
              <div className="flex items-center justify-between gap-3">
              <label
                id={labelId}
                htmlFor={fieldId}
                className="quick-add-label flex min-w-0 items-center gap-2 truncate"
              >
                <span className="quick-add-label-dot shrink-0" aria-hidden="true" />
                {label}
              </label>

              <div
                aria-hidden="true"
                className="flex min-h-6 shrink-0 items-center gap-2 text-xs font-medium tabular-nums text-[color:var(--color-ink-muted)]"
              >
                <AnimatePresence initial={false}>
                  {justSaved && (
                    <motion.span
                      key="saved-chip"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14, ease: EMIL_EASE_OUT }}
                      className="quick-add-chip"
                    >
                      <Check size={12} strokeWidth={2.6} aria-hidden="true" />
                      <span className="sm:hidden">{savedLabelShort ?? savedLabel}</span>
                      <span className="hidden sm:inline">{savedLabel}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
                {savedCount > 0 && (
                  <span className="whitespace-nowrap">
                    <span className="sm:hidden">{savedCount}</span>
                    <span className="hidden sm:inline">{savedCount} en esta ráfaga</span>
                  </span>
                )}
              </div>
            </div>

            {isManifestation ? (
              <>
                {attachments ? <div className="mt-2">{attachments}</div> : null}

                <textarea
                  ref={fieldRef}
                  id={fieldId}
                  value={draft}
                  rows={1}
                  maxLength={MAX_LENGTH}
                  enterKeyHint="send"
                  autoComplete="off"
                  spellCheck
                  placeholder={placeholder}
                  aria-describedby={describedBy}
                  onChange={(event) => updateDraft(event.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  className="quick-add-field mt-1.5 w-full"
                />

                {warning && (
                  <p
                    id={warningId}
                    className="quick-add-warning mt-2 flex items-start gap-1.5 text-xs leading-5"
                  >
                    <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{warning}</span>
                  </p>
                )}

                {options}

                {offlineNotice && (
                  <p role="status" className="mt-2 text-xs leading-5 text-[color:var(--color-ink-muted)]">
                    Guardada en este dispositivo. Se sincroniza cuando vuelva la conexión.
                  </p>
                )}

                {submitError && (
                  <p role="alert" className="mt-2 text-xs leading-5 text-swiss-red">
                    {submitError}
                  </p>
                )}

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {leadingAction}
                    {advancedAction && (
                      <button
                        type="button"
                        onClick={advancedAction.onClick}
                        className="quick-add-advanced hidden min-h-9 items-center rounded-full px-2 text-xs font-medium text-[color:var(--color-ink-muted)] transition-colors hover:text-swiss-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus sm:inline-flex"
                      >
                        {advancedAction.label}
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <VoiceDictationButton
                      size="md"
                      className="quick-add-mic"
                      label={`Dictar ${label.toLowerCase()}`}
                      sampleText={dictationSample}
                      onTranscript={(transcript) =>
                        updateDraft(draft ? `${draft} ${transcript}` : transcript)
                      }
                      previousTextTail={draft}
                    />
                    <button
                      type="button"
                      onClick={handleArrowSubmit}
                      disabled={!draft.trim() || submitDisabled}
                      onPointerDown={(event) => event.preventDefault()}
                      aria-label={submitAriaLabel}
                      className="quick-add-submit inline-flex h-11 w-11 items-center justify-center disabled:opacity-45"
                    >
                      <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <p id={hintId} className="sr-only">
                  {hint}
                </p>
              </>
            ) : (
              <>
                <div className="mt-1.5 flex items-end gap-2">
                  <textarea
                    ref={fieldRef}
                    id={fieldId}
                    value={draft}
                    rows={1}
                    maxLength={MAX_LENGTH}
                    enterKeyHint="send"
                    autoComplete="off"
                    spellCheck
                    placeholder={placeholder}
                    aria-describedby={describedBy}
                    onChange={(event) => updateDraft(event.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    className="quick-add-field min-w-0 flex-1"
                  />

                  <div className="flex shrink-0 items-center gap-1.5 pb-0.5 sm:hidden">
                    <VoiceDictationButton
                      size="md"
                      className="quick-add-mic"
                      label={`Dictar ${label.toLowerCase()}`}
                      sampleText={dictationSample}
                      onTranscript={(transcript) =>
                        updateDraft(draft ? `${draft} ${transcript}` : transcript)
                      }
                      previousTextTail={draft}
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      onPointerDown={(event) => event.preventDefault()}
                      aria-label={submitAriaLabel}
                      className="quick-add-submit inline-flex h-11 w-11 items-center justify-center disabled:opacity-45"
                    >
                      <Plus size={19} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {warning && (
                  <p
                    id={warningId}
                    className="quick-add-warning mt-2 flex items-start gap-1.5 text-xs leading-5"
                  >
                    <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{warning}</span>
                  </p>
                )}

                {options}

                {offlineNotice && (
                  <p role="status" className="mt-2 text-xs leading-5 text-[color:var(--color-ink-muted)]">
                    Guardada en este dispositivo. Se sincroniza cuando vuelva la conexión.
                  </p>
                )}

                {submitError && (
                  <p role="alert" className="mt-2 text-xs leading-5 text-swiss-red">
                    {submitError}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="flex w-full items-center justify-between gap-1.5 sm:order-2 sm:w-auto sm:justify-end">
                    {advancedAction && (
                      <button
                        type="button"
                        onClick={advancedAction.onClick}
                        className="quick-add-advanced inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium text-[color:var(--color-ink-muted)] transition-colors hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus sm:order-none sm:min-h-9 sm:px-2 sm:underline-offset-2 sm:hover:underline"
                      >
                        {advancedAction.label}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDone}
                      aria-label={draft.trim() ? 'Guardar y cerrar' : 'Cerrar composer y conservar lo agregado'}
                      className="quick-add-done inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold text-[color:var(--color-ink)] transition-colors hover:text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus sm:hidden"
                    >
                      Listo
                    </button>

                    <span className="hidden sm:block">
                      <VoiceDictationButton
                        size="md"
                        className="quick-add-mic"
                        label={`Dictar ${label.toLowerCase()}`}
                        sampleText={dictationSample}
                        onTranscript={(transcript) =>
                          updateDraft(draft ? `${draft} ${transcript}` : transcript)
                        }
                        previousTextTail={draft}
                      />
                    </span>

                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      aria-label={submitAriaLabel}
                      className="quick-add-submit-text hidden min-h-9 items-center justify-center px-4 text-xs font-semibold text-[color:var(--color-accent-fg)] disabled:opacity-45 disabled:shadow-none sm:inline-flex"
                    >
                      Agregar
                    </button>
                  </div>

                  <p
                    id={hintId}
                    className="quick-add-hint w-full min-w-0 text-[0.6875rem] leading-4 text-[color:var(--color-ink-muted)] sm:order-1 sm:w-auto sm:text-xs sm:leading-5"
                  >
                    <span className="sm:hidden">{hintMobile ?? hint}</span>
                    <span className="hidden sm:inline">{hint}</span>
                  </p>
                </div>
              </>
            )}

            <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {announcement}
            </span>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const savedToastNode = (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          key="saved-toast"
          aria-hidden="true"
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 10,
            scale: prefersReducedMotion ? 1 : 0.97,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 6,
            scale: prefersReducedMotion ? 1 : 0.98,
          }}
          transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-swiss-border bg-swiss-elevated px-4 py-2 text-[0.8125rem] font-semibold text-swiss-ink shadow-dropdown">
            <Check
              size={15}
              strokeWidth={2.8}
              className="text-[color:var(--color-success)]"
              aria-hidden="true"
            />
            {toastMessage}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {portalNode ? createPortal(composer, portalNode) : composer}
      {toastHost ? createPortal(savedToastNode, toastHost) : null}
    </>
  );
});
