'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ExternalLink,
  Play,
  Instagram,
  Youtube,
  Globe,
  Eye,
  EyeOff,
  Video,
} from 'lucide-react';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { extractUrlMetadataHints, cleanDisplayUrl, type SupportedProvider } from '@/utils/urlParser';
import { EMIL_EASE_OUT } from '@/lib/iosSprings';

export interface RichLinkPreviewProps {
  url: string;
  className?: string;
  compact?: boolean;
  allowEmbed?: boolean;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]{1,7});/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function BrandIcon({ provider, size = 16 }: { provider: SupportedProvider; size?: number }) {
  switch (provider) {
    case 'instagram':
      return <Instagram size={size} aria-hidden="true" />;
    case 'youtube':
      return <Youtube size={size} aria-hidden="true" />;
    case 'tiktok':
      return <Video size={size} aria-hidden="true" />;
    default:
      return <Globe size={size} aria-hidden="true" />;
  }
}

function BrandFallbackAvatar({
  provider,
  providerLabel,
  isVideoOrReel,
}: {
  provider: SupportedProvider;
  providerLabel: string;
  isVideoOrReel: boolean;
}) {
  let bgClasses = 'bg-stone-300 text-stone-700 dark:bg-stone-800 dark:text-stone-300';

  if (provider === 'instagram') {
    bgClasses = 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white';
  } else if (provider === 'youtube') {
    bgClasses = 'bg-red-600 text-white';
  } else if (provider === 'tiktok') {
    bgClasses = 'bg-stone-900 text-teal-300 dark:bg-black dark:text-teal-400';
  } else if (provider === 'facebook') {
    bgClasses = 'bg-blue-600 text-white';
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center ${bgClasses}`}
      title={providerLabel}
    >
      <BrandIcon provider={provider} size={22} />
      {isVideoOrReel && (
        <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] text-white backdrop-blur-xs">
          ▶
        </span>
      )}
    </div>
  );
}

export function RichLinkPreview({
  url,
  className = '',
  compact = false,
  allowEmbed = true,
}: RichLinkPreviewProps) {
  const { preview, isLoading, error } = useLinkPreview(url);
  const [imageFailed, setImageFailed] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const hints = extractUrlMetadataHints(url);
  const provider = preview?.provider || hints.provider;
  const providerLabel = preview?.providerLabel || hints.providerLabel;
  const isVideoOrReel = preview?.isVideoOrReel ?? hints.isVideoOrReel;
  const title = decodeHtmlEntities(preview?.title || hints.providerLabel);
  const shortcode = preview?.shortcode || hints.shortcode;
  const displayHost = cleanDisplayUrl(url, 28);
  const targetUrl = preview?.cleanUrl || hints.cleanUrl;

  const canEmbed =
    allowEmbed &&
    Boolean(shortcode) &&
    (provider === 'instagram' || provider === 'youtube');

  // Skeleton state
  if (isLoading && !preview) {
    return (
      <div
        className={`relative my-2.5 flex items-center gap-3 overflow-hidden rounded-2xl border border-[#E2DDD2] bg-[#F4F1EA]/80 p-2.5 shadow-xs transition-opacity dark:border-stone-800 dark:bg-stone-900/60 ${className}`}
        aria-busy="true"
        aria-label="Cargando vista previa del enlace"
      >
        <div className="relative h-16 w-16 shrink-0 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800 sm:h-20 sm:w-20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-stone-200 dark:bg-stone-800" />
          <div className="h-3.5 w-4/5 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
          <div className="h-3 w-1/3 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>
    );
  }

  // Graceful fallback if fetching preview completely fails: render clean link pill
  if (error && !preview) {
    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`group my-2 flex items-center justify-between gap-2.5 rounded-xl border border-[#E2DDD2] bg-[#F4F1EA]/90 px-3.5 py-2 text-xs font-medium text-swiss-ink transition-all hover:bg-white dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="shrink-0 text-stone-500">
            <BrandIcon provider={provider} size={15} />
          </span>
          <span className="truncate">{displayHost}</span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-200/80 px-2 py-0.5 text-[11px] font-semibold text-stone-700 transition-colors group-hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-300">
          Abrir <ExternalLink size={11} aria-hidden="true" />
        </span>
      </a>
    );
  }

  const imageSrc = !imageFailed && preview?.thumbnailUrl ? preview.thumbnailUrl : null;

  return (
    <div
      className={`group/preview relative my-2.5 overflow-hidden rounded-2xl border border-[#E2DDD2] bg-[#F4F1EA]/95 p-2.5 shadow-xs transition-all hover:border-[#D6CEBF] hover:shadow-sm dark:border-stone-800 dark:bg-stone-900/80 sm:p-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Left Thumbnail Box (WhatsApp/iOS Square) */}
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-200 shadow-2xs dark:bg-stone-800 sm:h-20 sm:w-20"
          aria-label={`Abrir ${title} en ${providerLabel}`}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover/preview:scale-105"
            />
          ) : (
            <BrandFallbackAvatar
              provider={provider}
              providerLabel={providerLabel}
              isVideoOrReel={isVideoOrReel}
            />
          )}

          {/* Overlaid Play Badge for Video/Reels when image is present */}
          {imageSrc && isVideoOrReel && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity group-hover/preview:bg-black/15">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow-xs backdrop-blur-xs">
                <Play size={11} className="ml-0.5 fill-white text-white" aria-hidden="true" />
              </span>
            </div>
          )}
        </a>

        {/* Central Information */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-stone-500 dark:text-stone-400">
            <span className="shrink-0 text-stone-600 dark:text-stone-300">
              <BrandIcon provider={provider} size={12} />
            </span>
            <span className="truncate">{providerLabel}</span>
          </div>

          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block focus:outline-hidden"
          >
            <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-swiss-ink transition-colors hover:text-stone-600 dark:text-stone-100 sm:text-sm">
              {title}
            </h4>
          </a>

          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-[11px] text-swiss-ink-muted">
              {displayHost}
            </span>

            {canEmbed && !compact && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmbed((prev) => !prev);
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-stone-600 transition-colors hover:bg-stone-200/80 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                aria-expanded={showEmbed}
              >
                {showEmbed ? (
                  <>
                    <EyeOff size={11} aria-hidden="true" />
                    <span>Cerrar</span>
                  </>
                ) : (
                  <>
                    <Eye size={11} aria-hidden="true" />
                    <span>Ver aquí</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Direct Action Pill Button (Right side) */}
        <div className="shrink-0 self-center">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:border-stone-400 hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-750 sm:px-3 sm:py-1.5"
            aria-label={`Abrir ${providerLabel} en pestaña nueva`}
          >
            <span>Abrir</span>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Embedded Player Accordion (Smooth unfold) */}
      <AnimatePresence>
        {showEmbed && canEmbed && shortcode && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EMIL_EASE_OUT }}
            className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-black/5 p-2 dark:border-stone-800 dark:bg-black/30"
          >
            {provider === 'instagram' ? (
              <div className="flex justify-center">
                <iframe
                  src={`https://www.instagram.com/reel/${shortcode}/embed/`}
                  className="w-full max-w-[360px] rounded-lg border-0 shadow-sm"
                  height="460"
                  allow="encrypted-media"
                  title={`Reproductor Reel de Instagram ${shortcode}`}
                />
              </div>
            ) : provider === 'youtube' ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${shortcode}?autoplay=1`}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`Reproductor YouTube ${shortcode}`}
                />
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
