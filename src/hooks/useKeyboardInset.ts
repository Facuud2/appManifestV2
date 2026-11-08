'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the number of pixels the visual viewport is inset by the mobile
 * keyboard. 0 on desktop or when the layout viewport is resized normally.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setInset(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const next =
        viewport.scale > 1.01
          ? 0
          : Math.max(
              0,
              Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
            );
      setInset(next > 40 ? next : 0);
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
    };
  }, [enabled]);

  return inset;
}
