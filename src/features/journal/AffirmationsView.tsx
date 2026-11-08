'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Headphones,
  Pin,
  Plus,
  Quote,
  Repeat,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { Affirmation, AmbientSoundType } from '@/types';
import { AffirmationQuickAdd } from '@/components/journal/AffirmationQuickAdd';
import { PinnedRampageModal } from '@/components/journal/PinnedRampageModal';
import { sortAffirmations } from '@/lib/affirmationEngine';
import {
  EMIL_CARD_TAP,
  POSITION_CHANGE_TRANSITION,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  TRANSITIONS_SMOOTH_OUT,
} from '@/lib/iosSprings';

interface AffirmationsViewProps {
  onOpenNewAffirmation: () => void;
  onOpenRampage: () => void;
  onStartPinnedRampage?: (affirmations: string[], ambientSound?: AmbientSoundType) => void;
  isQuickAddOpen?: boolean;
  onQuickAddOpen?: (trigger: HTMLElement) => void;
  onQuickAddClose?: (restoreFocus?: boolean) => void;
}

interface SpotlightDragSession {
  id: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  startScrollY: number;
  startOffsetLeft: number;
  startOffsetTop: number;
  width: number;
  height: number;
  rawDx: number;
  rawDy: number;
}

const ThreeLinesGripIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M2.5 4.25H13.5M2.5 8H13.5M2.5 11.75H13.5"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
  </svg>
);

export const AffirmationsView: React.FC<AffirmationsViewProps> = ({
  onOpenNewAffirmation,
  onOpenRampage,
  onStartPinnedRampage,
  isQuickAddOpen: controlledIsQuickAddOpen,
  onQuickAddOpen,
  onQuickAddClose,
}) => {
  const {
    activeScope,
    affirmations: allAffirmations,
    togglePinAffirmation,
    moveAffirmation,
    incrementAffirmationRepeat,
    deleteAffirmation,
  } = useAppStore();

  const affirmations = useMemo(
    () => allAffirmations.filter((item) => item.userId === activeScope),
    [allAffirmations, activeScope]
  );

  const prefersReducedMotion = useReducedMotion();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [internalQuickAddOpen, setInternalQuickAddOpen] = useState(false);
  const isQuickAddOpen = controlledIsQuickAddOpen ?? internalQuickAddOpen;
  const [isPinnedRampageOpen, setIsPinnedRampageOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [draggingSpotlightId, setDraggingSpotlightId] = useState<string | null>(
    null
  );
  const [openMenuSpotlightId, setOpenMenuSpotlightId] = useState<string | null>(
    null
  );

  const quickAddCtaRef = useRef<HTMLButtonElement>(null);
  const spotlightGridRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const activeDragSessionRef = useRef<SpotlightDragSession | null>(null);

  /**
   * Sección superior ("Decretos fijados en foco"):
   * Ordenada según `order` personalizable mediante las 3 rayitas.
   */
  const pinnedAffirmations = useMemo(
    () => sortAffirmations(affirmations).filter((item) => item.pinned),
    [affirmations]
  );

  /**
   * Sección inferior ("la lista de abajo"):
   * Mantiene siempre primero a todas las afirmaciones fijadas (`En foco`),
   * pero con un orden estable (por fecha de creación / ID) para que al mover
   * las tarjetas arriba en "Decretos fijados en foco" la lista inferior no
   * salte ni se vea afectada.
   */
  const [settledBottomAffirmations, setSettledBottomAffirmations] = useState<
    Affirmation[]
  >(() =>
    [...affirmations].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinDiff !== 0) return pinDiff;
      const timeA = Date.parse(a.createdAt);
      const timeB = Date.parse(b.createdAt);
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeB !== timeA) {
        return timeB - timeA;
      }
      return a.id.localeCompare(b.id);
    })
  );

  useEffect(() => {
    if (draggingSpotlightId) return;
    setSettledBottomAffirmations(
      [...affirmations].sort((a, b) => {
        const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinDiff !== 0) return pinDiff;
        const timeA = Date.parse(a.createdAt);
        const timeB = Date.parse(b.createdAt);
        if (
          Number.isFinite(timeA) &&
          Number.isFinite(timeB) &&
          timeB !== timeA
        ) {
          return timeB - timeA;
        }
        return a.id.localeCompare(b.id);
      })
    );
  }, [affirmations, draggingSpotlightId]);

  const bottomListAffirmations = settledBottomAffirmations;

  const handleOpenQuickAdd = useCallback(
    (trigger: HTMLElement) => {
      if (onQuickAddOpen) {
        onQuickAddOpen(trigger);
      } else {
        setInternalQuickAddOpen(true);
      }
    },
    [onQuickAddOpen]
  );

  const handleCloseQuickAdd = useCallback(
    (restoreFocus = true) => {
      if (onQuickAddClose) {
        onQuickAddClose(restoreFocus);
      } else {
        setInternalQuickAddOpen(false);
        if (restoreFocus) {
          window.requestAnimationFrame(() =>
            quickAddCtaRef.current?.focus({ preventScroll: true })
          );
        }
      }
    },
    [onQuickAddClose]
  );

  const handleQuickAddSaved = useCallback(() => {
    window.requestAnimationFrame(() => {
      const current = useAppStore.getState().affirmations;
      const newest = current.find((item) => !item.pinned) ?? current[0];
      if (!newest) return;

      setFlashId(newest.id);
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = window.setTimeout(() => setFlashId(null), 650);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
      }
      if (typeof document !== 'undefined') {
        delete document.documentElement.dataset.affirmationDragging;
      }
    };
  }, []);

  useEffect(() => {
    if (!openMenuSpotlightId) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-reorder-menu-zone="true"]')) return;
      setOpenMenuSpotlightId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuSpotlightId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuSpotlightId]);

  const applyDraggedCardTransform = useCallback((session: SpotlightDragSession) => {
    const slotDeltaX = session.el.offsetLeft - session.startOffsetLeft;
    const slotDeltaY = session.el.offsetTop - session.startOffsetTop;
    const tx = session.rawDx - slotDeltaX;
    const ty = session.rawDy - slotDeltaY;
    session.el.style.transition = 'none';
    session.el.style.transform = `translate3d(${tx}px, ${ty}px, 0px) scale(1.015)`;
  }, []);

  /**
   * Compensación síncrona antes del pintado del navegador:
   * Cuando `pinnedAffirmations` intercambia dos tarjetas en el DOM, el `offsetTop`/`offsetLeft`
   * de la tarjeta arrastrada cambia a su nueva celda. Recalculamos `tx` y `ty` en `useLayoutEffect`
   * para que la tarjeta permanezca exactamente bajo el cursor/dedo sin saltar ni un píxel.
   */
  useLayoutEffect(() => {
    const session = activeDragSessionRef.current;
    if (!session || !draggingSpotlightId) return;
    applyDraggedCardTransform(session);
  }, [pinnedAffirmations, draggingSpotlightId, applyDraggedCardTransform]);

  const handleSpotlightDragPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, pinned: Affirmation) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      if (dragCleanupRef.current) {
        dragCleanupRef.current();
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      const cardEl = event.currentTarget.closest<HTMLElement>(
        '[data-spotlight-id]'
      );
      const gridEl = spotlightGridRef.current;
      if (!cardEl || !gridEl) return;

      cardEl.style.transition = '';
      cardEl.style.transform = '';

      const session: SpotlightDragSession = {
        id: pinned.id,
        el: cardEl,
        startX: event.clientX,
        startY: event.clientY,
        startScrollY: window.scrollY,
        startOffsetLeft: cardEl.offsetLeft,
        startOffsetTop: cardEl.offsetTop,
        width: cardEl.offsetWidth,
        height: cardEl.offsetHeight,
        rawDx: 0,
        rawDy: 0,
      };

      let hasMoved = false;
      let lastSwapTime = 0;

      const evaluateSpotlightSwap = () => {
        const container = spotlightGridRef.current;
        if (!container) return;

        const now = Date.now();
        if (now - lastSwapTime < 140) return;

        const cardNodes = Array.from(
          container.querySelectorAll<HTMLElement>('[data-spotlight-id]')
        );
        const fromIndex = cardNodes.findIndex(
          (node) => node.getAttribute('data-spotlight-id') === session.id
        );
        if (fromIndex === -1) return;

        const currentNode = cardNodes[fromIndex];
        const currentTop = currentNode.offsetTop;

        const visualLeft = session.startOffsetLeft + session.rawDx;
        const visualTop = session.startOffsetTop + session.rawDy;
        const visualCenterX = visualLeft + session.width / 2;
        const visualCenterY = visualTop + session.height / 2;

        for (let toIndex = 0; toIndex < cardNodes.length; toIndex += 1) {
          if (toIndex === fromIndex) continue;

          const overNode = cardNodes[toIndex];
          const overId = overNode.getAttribute('data-spotlight-id');
          if (!overId) continue;

          const overLeft = overNode.offsetLeft;
          const overTop = overNode.offsetTop;
          const overWidth = overNode.offsetWidth;
          const overHeight = overNode.offsetHeight;
          const overCenterX = overLeft + overWidth / 2;
          const overCenterY = overTop + overHeight / 2;

          const withinX =
            visualCenterX >= overLeft - 12 &&
            visualCenterX <= overLeft + overWidth + 12;
          const withinY =
            visualCenterY >= overTop - 12 &&
            visualCenterY <= overTop + overHeight + 12;

          if (!withinX || !withinY) continue;

          const isSameRow = Math.abs(overTop - currentTop) < 24;

          if (isSameRow) {
            const crossedCenterX =
              fromIndex < toIndex
                ? visualCenterX > overCenterX
                : visualCenterX < overCenterX;

            if (crossedCenterX) {
              lastSwapTime = now;
              useAppStore.getState().reorderAffirmations(session.id, overId);
              break;
            }
          } else {
            const crossedCenterY =
              fromIndex < toIndex
                ? visualCenterY > overCenterY
                : visualCenterY < overCenterY;

            if (crossedCenterY) {
              lastSwapTime = now;
              useAppStore.getState().reorderAffirmations(session.id, overId);
              break;
            }
          }
        }
      };

      const handleWindowPointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - session.startX;
        const dy =
          moveEvent.clientY -
          session.startY +
          (window.scrollY - session.startScrollY);

        if (!hasMoved && Math.hypot(dx, dy) >= 3) {
          hasMoved = true;
          activeDragSessionRef.current = session;
          setOpenMenuSpotlightId(null);
          setDraggingSpotlightId(session.id);
          document.documentElement.dataset.affirmationDragging = 'true';
        }

        if (!hasMoved) return;

        if (moveEvent.cancelable) {
          moveEvent.preventDefault();
        }

        session.rawDx = dx;
        session.rawDy = dy;

        evaluateSpotlightSwap();
        applyDraggedCardTransform(session);
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        window.removeEventListener('pointercancel', handleWindowPointerUp);
        dragCleanupRef.current = null;
      };

      const handleWindowPointerUp = () => {
        cleanup();
        delete document.documentElement.dataset.affirmationDragging;

        if (hasMoved) {
          activeDragSessionRef.current = null;
          session.el.style.transition =
            'transform var(--duration-fast) var(--ease-smooth-out), box-shadow var(--duration-fast) var(--ease-smooth-out)';
          session.el.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';

          settleTimerRef.current = window.setTimeout(() => {
            session.el.style.transition = '';
            session.el.style.transform = '';
            setDraggingSpotlightId(null);
            settleTimerRef.current = null;
          }, 250);

          void useAppStore.getState().commitAffirmationOrder();
        } else {
          setOpenMenuSpotlightId((prev) =>
            prev === pinned.id ? null : pinned.id
          );
        }
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handleWindowPointerMove, {
        passive: false,
      });
      window.addEventListener('pointerup', handleWindowPointerUp);
      window.addEventListener('pointercancel', handleWindowPointerUp);
    },
    [applyDraggedCardTransform]
  );

  const handleSpotlightKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, item: Affirmation) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        void moveAffirmation(item.id, 'up');
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        void moveAffirmation(item.id, 'down');
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpenMenuSpotlightId((prev) => (prev === item.id ? null : item.id));
      }
    },
    [moveAffirmation]
  );

  const shouldStaggerCards = bottomListAffirmations.length <= 6;

  const handleSpeakPreview = (item: Affirmation) => {
    setSpeakingId(item.id);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'es-AR';
      utterance.rate = 0.96;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingId(null), 1500);
    }
  };

  return (
    <div className="quick-add-page space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Asunción en primera persona</p>
          <h1 className="display-title mt-1.5 text-swiss-ink">Afirmaciones</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-swiss-ink-muted">
            Frases directas, naturales y en presente. Sin metáforas poéticas, listas para repetir o llevar a tu Rampage de voz.
          </p>
        </div>

        <button
          ref={quickAddCtaRef}
          type="button"
          data-quick-add-trigger="true"
          onClick={(event) =>
            isQuickAddOpen
              ? handleCloseQuickAdd()
              : handleOpenQuickAdd(event.currentTarget)
          }
          className={
            isQuickAddOpen
              ? 'swiss-btn-secondary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] font-semibold text-swiss-ink focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto'
              : 'swiss-btn-primary inline-flex min-h-11 items-center gap-2 self-start px-5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto'
          }
        >
          {isQuickAddOpen ? (
            <>
              <Check size={16} aria-hidden="true" />
              Listo
            </>
          ) : (
            <>
              <Plus size={16} aria-hidden="true" />
              Nueva afirmación
            </>
          )}
        </button>
      </header>

      <AffirmationQuickAdd
        isOpen={isQuickAddOpen}
        onClose={() => handleCloseQuickAdd()}
        onDismiss={() => handleCloseQuickAdd(false)}
        onSaved={handleQuickAddSaved}
        onOpenAdvanced={() => {
          handleCloseQuickAdd(false);
          onOpenNewAffirmation();
        }}
      />

      <PinnedRampageModal
        isOpen={isPinnedRampageOpen}
        onClose={() => setIsPinnedRampageOpen(false)}
        pinnedAffirmations={pinnedAffirmations}
        onStartPractice={(selectedTexts, ambientSound) => {
          setIsPinnedRampageOpen(false);
          if (onStartPinnedRampage) {
            onStartPinnedRampage(selectedTexts, ambientSound);
          } else {
            onOpenRampage();
          }
        }}
      />

      {/* Spotlight de Decretos Fijados (Única sección con acceso de 3 rayitas para moverlas) */}
      {pinnedAffirmations.length > 0 && (
        <section
          aria-labelledby="pinned-affirmations-heading"
          className="swiss-card surface-peri p-5 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]"
              >
                <Pin size={15} />
              </span>
              <div>
                <h2
                  id="pinned-affirmations-heading"
                  className="text-sm font-semibold text-swiss-ink"
                >
                  Decretos fijados en foco ({pinnedAffirmations.length})
                </h2>
                <p className="text-xs text-swiss-ink-muted">
                  Tus afirmaciones ancla listas para repetir o escuchar con tu voz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPinnedRampageOpen(true)}
              className="swiss-btn-secondary inline-flex min-h-9 items-center gap-2 self-start px-3.5 text-xs font-semibold text-[color:var(--pastel-peri-ink)] focus-visible:ring-2 focus-visible:ring-swiss-focus sm:self-auto"
            >
              <Headphones size={14} aria-hidden="true" />
              <span>Practicar en Rampage</span>
            </button>
          </div>

          <div
            ref={spotlightGridRef}
            className="relative mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence initial={false}>
              {pinnedAffirmations.map((pinned, index) => {
                const isDraggingThis = draggingSpotlightId === pinned.id;
                const isMenuOpen = openMenuSpotlightId === pinned.id;
                const canMoveUp = index > 0;
                const canMoveDown = index < pinnedAffirmations.length - 1;

                return (
                  <motion.div
                    key={pinned.id}
                    layout={
                      prefersReducedMotion || isDraggingThis ? false : 'position'
                    }
                    transition={{ layout: POSITION_CHANGE_TRANSITION }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      transition: {
                        duration: 0.15,
                        ease: TRANSITIONS_SMOOTH_OUT,
                      },
                    }}
                    data-spotlight-id={pinned.id}
                    className={`glass-panel flex flex-col justify-between rounded-[16px] p-3.5 ${
                      isDraggingThis ? 'affirmation-card-dragging' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-swiss-ink">
                        “{pinned.text}”
                      </p>

                      <div className="relative -mr-1 -mt-1 flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void togglePinAffirmation(pinned.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          aria-label={`Desfijar de foco: ${pinned.text}`}
                          title="Desfijar de foco"
                          data-testid={`spotlight-unpin-${pinned.id}`}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)] transition-colors hover:bg-swiss-control hover:text-swiss-ink active:scale-95 focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            isDraggingThis ? 'pointer-events-none' : ''
                          }`}
                        >
                          <Pin size={14} aria-hidden="true" />
                        </button>

                        {pinnedAffirmations.length > 1 && (
                          <div
                            data-reorder-menu-zone="true"
                            className="relative inline-flex shrink-0 items-center"
                          >
                            <button
                              type="button"
                              onPointerDown={(event) =>
                                handleSpotlightDragPointerDown(event, pinned)
                              }
                              onKeyDown={(event) =>
                                handleSpotlightKeyDown(event, pinned)
                              }
                              aria-label={`Reacomodar decreto fijado (${index + 1} de ${pinnedAffirmations.length}): ${pinned.text}`}
                              aria-expanded={isMenuOpen}
                              title="Arrastrar para reacomodar"
                              data-testid={`spotlight-drag-handle-${pinned.id}`}
                              className={`drag-handle affirmation-drag-handle inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                                isDraggingThis || isMenuOpen
                                  ? 'bg-swiss-control text-swiss-ink'
                                  : 'text-swiss-ink-light hover:bg-swiss-control hover:text-swiss-ink'
                              }`}
                            >
                              <ThreeLinesGripIcon />
                            </button>

                            <AnimatePresence>
                              {isMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.97, y: 4 }}
                                  animate={{
                                    opacity: 1,
                                    scale: 1,
                                    y: 0,
                                    transition: {
                                      duration: 0.25,
                                      ease: TRANSITIONS_SMOOTH_OUT,
                                    },
                                  }}
                                  exit={{
                                    opacity: 0,
                                    scale: 0.99,
                                    y: 0,
                                    transition: {
                                      duration: 0.15,
                                      ease: TRANSITIONS_SMOOTH_OUT,
                                    },
                                  }}
                                  role="group"
                                  aria-label={`Mover decreto fijado: ${pinned.text}`}
                                  className="swiss-card absolute right-0 top-full z-30 mt-1.5 flex items-center gap-1 rounded-full border border-swiss-borderStrong bg-swiss-card p-1 shadow-elevated"
                                >
                                  <button
                                    type="button"
                                    disabled={!canMoveUp}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void moveAffirmation(pinned.id, 'up');
                                    }}
                                    aria-label={`Subir posición: ${pinned.text}`}
                                    title="Mover antes"
                                    className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-swiss-ink transition-colors hover:bg-swiss-control disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-swiss-focus"
                                  >
                                    <ArrowUp size={13} aria-hidden="true" />
                                    <span>Subir</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveDown}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void moveAffirmation(pinned.id, 'down');
                                    }}
                                    aria-label={`Bajar posición: ${pinned.text}`}
                                    title="Mover después"
                                    className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-swiss-ink transition-colors hover:bg-swiss-control disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-swiss-focus"
                                  >
                                    <ArrowDown size={13} aria-hidden="true" />
                                    <span>Bajar</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-swiss-ink-light">
                        Por {pinned.author}
                      </span>
                      <button
                        type="button"
                        onClick={() => void incrementAffirmationRepeat(pinned.id)}
                        aria-label={`Repetir decreto fijado. Repetido ${pinned.repeatCount} veces`}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-swiss-control px-2.5 py-1 text-xs font-semibold text-swiss-accentText transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-swiss-focus"
                      >
                        <Repeat size={12} aria-hidden="true" />
                        <motion.span
                          key={pinned.repeatCount}
                          initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          transition={{
                            duration: 0.15,
                            ease: TRANSITIONS_SMOOTH_OUT,
                          }}
                          className="inline-block tabular-nums"
                        >
                          {pinned.repeatCount}
                        </motion.span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      {bottomListAffirmations.length === 0 ? (
        <div className="swiss-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--pastel-peach)] text-[color:var(--pastel-peach-ink)]">
            <Quote size={24} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 className="section-heading mt-4">Todavía no hay afirmaciones</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-swiss-ink-muted">
            Creá frases cortas y directas en primera persona, como hechos que ya son parte de tu realidad.
          </p>
          {!isQuickAddOpen && (
            <button
              type="button"
              onClick={(event) => handleOpenQuickAdd(event.currentTarget)}
              className="swiss-btn-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5 text-[0.8125rem]"
            >
              <Plus size={16} aria-hidden="true" />
              Crear afirmación
            </button>
          )}
        </div>
      ) : (
        <motion.div
          variants={shouldStaggerCards ? STAGGER_CONTAINER : undefined}
          initial={shouldStaggerCards ? 'hidden' : false}
          animate={shouldStaggerCards ? 'show' : undefined}
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        >
          <AnimatePresence initial={false}>
            {bottomListAffirmations.map((item) => {
              const isSpeaking = speakingId === item.id;
              return (
                <motion.article
                  key={item.id}
                  layout={
                    prefersReducedMotion || Boolean(draggingSpotlightId)
                      ? false
                      : 'position'
                  }
                  transition={{ layout: POSITION_CHANGE_TRANSITION }}
                  variants={shouldStaggerCards ? STAGGER_ITEM : undefined}
                  whileTap={EMIL_CARD_TAP}
                  exit={{
                    opacity: 0,
                    scale: 0.98,
                    transition: {
                      duration: 0.15,
                      ease: TRANSITIONS_SMOOTH_OUT,
                    },
                  }}
                  data-flash-tone={flashId === item.id ? 'rose' : undefined}
                  className={`swiss-card swiss-card-hover flex flex-col justify-between p-5 ${
                    flashId === item.id ? 'quick-add-card-flash' : ''
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                          item.pinned
                            ? 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]'
                            : 'bg-swiss-control text-swiss-ink-muted'
                        }`}
                      >
                        <span className="pastel-dot" aria-hidden="true" />
                        {item.pinned ? 'En foco' : 'Decreto'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSpeakPreview(item)}
                          aria-label={`Escuchar afirmación: ${item.text}`}
                          title="Escuchar con voz"
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            isSpeaking
                              ? 'bg-swiss-accent text-swiss-accentFg'
                              : 'text-swiss-ink-light hover:bg-swiss-control hover:text-swiss-ink'
                          }`}
                        >
                          <Volume2 size={14} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void togglePinAffirmation(item.id)}
                          aria-pressed={Boolean(item.pinned)}
                          aria-label={
                            item.pinned
                              ? `Quitar de foco: ${item.text}`
                              : `Fijar en foco: ${item.text}`
                          }
                          title={item.pinned ? 'Fijada en foco' : 'Fijar en foco'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-swiss-focus ${
                            item.pinned
                              ? 'bg-[color:var(--pastel-peri)] text-[color:var(--pastel-peri-ink)]'
                              : 'text-swiss-ink-light hover:bg-swiss-control hover:text-swiss-ink'
                          }`}
                        >
                          <Pin size={14} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteAffirmation(item.id)}
                          aria-label={`Eliminar afirmación: ${item.text}`}
                          title="Eliminar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-swiss-ink-light transition-colors hover:bg-swiss-control hover:text-swiss-red focus-visible:ring-2 focus-visible:ring-swiss-focus"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.018em] text-swiss-ink">
                      “{item.text}”
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-swiss-border pt-3.5">
                    <span className="text-xs text-swiss-ink-light">
                      Por {item.author}
                    </span>

                    <button
                      type="button"
                      onClick={() => void incrementAffirmationRepeat(item.id)}
                      aria-label={`Repetir afirmación. Repetida ${item.repeatCount} veces`}
                      className="swiss-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3.5 text-xs font-semibold text-swiss-accentText focus-visible:ring-2 focus-visible:ring-swiss-focus"
                    >
                      <Repeat size={13} aria-hidden="true" />
                      <span>Repetida</span>
                      <motion.span
                        key={item.repeatCount}
                        initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{
                          duration: 0.15,
                          ease: TRANSITIONS_SMOOTH_OUT,
                        }}
                        className="inline-block tabular-nums"
                      >
                        {item.repeatCount}
                      </motion.span>
                      <span>veces</span>
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
