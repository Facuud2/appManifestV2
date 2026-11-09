'use client';

import { useEffect, useState } from 'react';
import type { LinkPreviewData } from '@/app/api/link-preview/route';
import { cleanUrlTrackingParams, sanitizeUrlString } from '@/utils/urlParser';

// In-memory runtime cache across components
const memoryCache = new Map<string, LinkPreviewData>();

const LOCAL_STORAGE_PREFIX = 'lp_cache_v1_';
const MAX_LOCAL_CACHE_ITEMS = 60;

function getLocalStorageKey(cleanUrl: string): string {
  return `${LOCAL_STORAGE_PREFIX}${encodeURIComponent(cleanUrl)}`;
}

function loadFromLocal(cleanUrl: string): LinkPreviewData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getLocalStorageKey(cleanUrl));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache TTL 7 days
    if (Date.now() - (parsed._cachedAt || 0) > 7 * 24 * 3600 * 1000) {
      localStorage.removeItem(getLocalStorageKey(cleanUrl));
      return null;
    }
    return parsed.data as LinkPreviewData;
  } catch {
    return null;
  }
}

function saveToLocal(cleanUrl: string, data: LinkPreviewData) {
  if (typeof window === 'undefined') return;
  try {
    const item = {
      _cachedAt: Date.now(),
      data,
    };
    localStorage.setItem(getLocalStorageKey(cleanUrl), JSON.stringify(item));
  } catch {
    // If quota exceeded, clean up old keys
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(LOCAL_STORAGE_PREFIX));
      if (keys.length > MAX_LOCAL_CACHE_ITEMS) {
        keys.slice(0, 20).forEach((k) => localStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }
  }
}

export function useLinkPreview(rawUrl: string | null | undefined) {
  const cleanUrl = rawUrl ? cleanUrlTrackingParams(sanitizeUrlString(rawUrl)) : '';

  const [preview, setPreview] = useState<LinkPreviewData | null>(() => {
    if (!cleanUrl) return null;
    if (memoryCache.has(cleanUrl)) return memoryCache.get(cleanUrl)!;
    return loadFromLocal(cleanUrl);
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!cleanUrl) return false;
    return !memoryCache.has(cleanUrl) && !loadFromLocal(cleanUrl);
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cleanUrl) {
      setPreview(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check memory cache
    if (memoryCache.has(cleanUrl)) {
      setPreview(memoryCache.get(cleanUrl)!);
      setIsLoading(false);
      return;
    }

    // Check local storage
    const cached = loadFromLocal(cleanUrl);
    if (cached) {
      memoryCache.set(cleanUrl, cached);
      setPreview(cached);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();

    fetch(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.success && json.data) {
            memoryCache.set(cleanUrl, json.data);
            saveToLocal(cleanUrl, json.data);
            setPreview(json.data);
          } else {
            setError(json.error || 'No se pudo cargar la vista previa.');
          }
        }
      })
      .catch((err) => {
        if (isMounted && err.name !== 'AbortError') {
          setError(err.message || 'Error de conexión');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [cleanUrl]);

  return { preview, isLoading, error };
}
