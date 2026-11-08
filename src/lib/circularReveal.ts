import { flushSync } from 'react-dom';

/**
 * Circular theme reveal.
 *
 * The destination theme is captured as a View Transition snapshot and revealed
 * through a circle that grows from the control the user activated. The previous
 * theme stays visible outside the circle, so the change reads as a sweep instead
 * of a cross-fade.
 *
 * The circle crosses the whole viewport, so it uses --duration-medium (350ms)
 * with a curve that starts gently; the usual front-loaded smooth-out would make
 * the edge reach the corners too early and read as a flash.
 */
const REVEAL_DURATION_MS = 350;
const REVEAL_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

type CircularRevealOptions = {
  /** Element (or rect) the circle grows from. Falls back to the viewport center. */
  origin: Element | DOMRect | null;
  /** Applies the new theme. Runs inside the View Transition callback. */
  update: () => void;
  /** Runs before the old snapshot is taken, e.g. to hide a closing menu. */
  prepare?: () => void;
  onFinish?: () => void;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const supportsViewTransitions = () =>
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function';

let revealToken = 0;

export const runCircularReveal = ({
  origin,
  update,
  prepare,
  onFinish,
}: CircularRevealOptions) => {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    update();
    onFinish?.();
    return;
  }

  const rect = origin
    ? origin instanceof Element
      ? origin.getBoundingClientRect()
      : origin
    : null;

  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const radius =
    Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY)
    ) + 24;

  prepare?.();

  const root = document.documentElement;
  const token = ++revealToken;
  root.dataset.circularReveal = 'active';

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });

  transition.ready
    .then(() => {
      const animation = root.animate(
        {
          clipPath: [
            `circle(0px at ${centerX}px ${centerY}px)`,
            `circle(${radius}px at ${centerX}px ${centerY}px)`,
          ],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      );
      return animation.finished.then(() => transition.finished);
    })
    .catch(() => {
      // The new theme is already applied; let the transition settle on its own.
    })
    .finally(() => {
      if (token === revealToken) {
        delete root.dataset.circularReveal;
      }
      onFinish?.();
    });
};
