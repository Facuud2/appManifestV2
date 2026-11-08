'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Camera, Music2, Plus, Video as VideoIcon } from 'lucide-react';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export interface AttachmentMenuProps {
  onPhoto: (file: File) => void | Promise<void>;
  onVideo: (file: File) => void | Promise<void>;
  onSong: () => void;
  disabled?: boolean;
}

interface MenuPosition {
  left: number;
  bottom: number;
}

const MENU_WIDTH = 184;

export function AttachmentMenu({ onPhoto, onVideo, onSong, disabled }: AttachmentMenuProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ left: 0, bottom: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - MENU_WIDTH - 8),
    );
    setPosition({
      left,
      bottom: Math.max(8, window.innerHeight - rect.top + 8),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', handle);
    viewport?.addEventListener('scroll', handle);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      viewport?.removeEventListener('resize', handle);
      viewport?.removeEventListener('scroll', handle);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus({ preventScroll: true });
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    items[nextIndex]?.focus();
  };

  const select = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const menu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          role="menu"
          data-quick-add-portal="true"
          aria-label="Adjuntar a la manifestación"
          onKeyDown={handleMenuKeyDown}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.94 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.16, ease: EMIL_EASE_OUT }}
          style={{
            left: position.left,
            bottom: position.bottom,
            width: MENU_WIDTH,
            transformOrigin: 'bottom left',
          }}
          className="fixed z-[90] rounded-2xl border border-swiss-border bg-swiss-elevated/95 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:bg-swiss-elevated/98"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              select(() => photoInputRef.current?.click());
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-swiss-ink transition-colors hover:bg-swiss-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-swiss-control text-swiss-inkMuted" aria-hidden="true">
              <Camera size={14} strokeWidth={2} />
            </span>
            Foto
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              select(() => videoInputRef.current?.click());
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-swiss-ink transition-colors hover:bg-swiss-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-swiss-control text-swiss-inkMuted" aria-hidden="true">
              <VideoIcon size={14} strokeWidth={2} />
            </span>
            Video
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              select(onSong);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-swiss-ink transition-colors hover:bg-swiss-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-swiss-control text-swiss-inkMuted" aria-hidden="true">
              <Music2 size={14} strokeWidth={2} />
            </span>
            Canción
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onPhoto(file);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onVideo(file);
        }}
      />

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Adjuntar foto, video o canción"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-swiss-inkMuted transition-all hover:bg-swiss-control hover:text-swiss-ink active:scale-90 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swiss-focus"
      >
        <Plus
          size={20}
          strokeWidth={2}
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
        />
      </button>

      {mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
