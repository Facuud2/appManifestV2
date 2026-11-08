'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import type { MediaAttachment } from '@/types';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';
import { useMediaBlob } from '@/hooks/useMediaBlob';

export interface MediaLightboxProps {
  media: MediaAttachment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaLightbox({ media, isOpen, onClose }: MediaLightboxProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { url, isLoading, isMissing } = useMediaBlob(media?.storageKey, isOpen && Boolean(media));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), video[controls], a[href]'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const content = (
    <AnimatePresence>
      {isOpen && media ? (
        <motion.div
          key="media-lightbox"
          data-quick-add-portal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EMIL_EASE_OUT }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label={media.kind === 'photo' ? 'Foto adjunta' : 'Video adjunto'}
        >
          <button
            type="button"
            aria-label="Cerrar visor"
            onClick={onClose}
            className="absolute inset-0"
          />

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <X size={20} aria-hidden="true" />
          </button>

          <motion.div
            ref={panelRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
            drag={prefersReducedMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110) onClose();
            }}
            className="relative z-[1] flex max-h-[88dvh] max-w-[94vw] flex-col items-center"
          >
            {isLoading ? (
              <span className="flex h-24 w-24 items-center justify-center text-white/70">
                <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              </span>
            ) : media.kind === 'photo' ? (
              <img
                src={url || media.thumbDataUrl}
                alt="Foto adjunta a la manifestación"
                className="max-h-[82dvh] max-w-[94vw] rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
              />
            ) : url ? (
              <video
                src={url}
                poster={media.thumbDataUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[82dvh] max-w-[94vw] rounded-2xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
              />
            ) : (
              <img
                src={media.thumbDataUrl}
                alt="Miniatura del video adjunto"
                className="max-h-[82dvh] max-w-[94vw] rounded-2xl object-contain opacity-80"
              />
            )}

            {isMissing ? (
              <p className="mt-3 max-w-sm text-center text-xs leading-5 text-white/65">
                {media.kind === 'video'
                  ? 'El video completo no está disponible en este dispositivo. Se muestra la portada guardada.'
                  : 'La foto completa no está disponible en este dispositivo. Se muestra la miniatura guardada.'}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
