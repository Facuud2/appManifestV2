import type { Transition, TargetAndTransition, Variants } from 'framer-motion';

/**
 * Emil Kowalski Animation Philosophy & Apple WWDC Spring Presets
 * Strict rules:
 * - Never scale(0) -> scale(0.95..0.97) + opacity: 0
 * - Strong ease-out: cubic-bezier(0.23, 1, 0.32, 1)
 * - UI animations <= 300ms
 * - Stagger 30-60ms
 */

export const EMIL_EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EMIL_EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const EMIL_MODAL_SPRING: Transition = {
  type: 'spring',
  duration: 0.35,
  bounce: 0.1,
};

export const EMIL_SHEET_SPRING: Transition = {
  type: 'spring',
  duration: 0.32,
  bounce: 0.12,
};

export const EMIL_TAP: TargetAndTransition = {
  scale: 0.97,
  transition: {
    duration: 0.16,
    ease: EMIL_EASE_OUT,
  },
};

export const EMIL_CARD_TAP: TargetAndTransition = {
  scale: 0.985,
  transition: {
    duration: 0.16,
    ease: EMIL_EASE_OUT,
  },
};

export const VIEW_TRANSITION: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: EMIL_EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12, ease: EMIL_EASE_OUT },
  },
};

export const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
      ease: EMIL_EASE_OUT,
    },
  },
};

export const MODAL_TRANSITION: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: EMIL_EASE_OUT,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 2,
    transition: {
      duration: 0.15,
      ease: EMIL_EASE_OUT,
    },
  },
};

export const BACKDROP_TRANSITION: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: EMIL_EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: EMIL_EASE_OUT },
  },
};

export const IOS_TAP_SPRING = EMIL_TAP;
export const IOS_CARD_TAP_SPRING = EMIL_CARD_TAP;
export const IOS_VIEW_SPRING = EMIL_MODAL_SPRING;
export const IOS_SHEET_SPRING = EMIL_SHEET_SPRING;
