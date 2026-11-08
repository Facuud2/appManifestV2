'use client';

import { useEffect, useState } from 'react';
import { getMedia } from '@/lib/mediaStorage';

export function useMediaBlob(storageKey?: string | null, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    if (!storageKey || !enabled) {
      setUrl(null);
      setIsLoading(false);
      setIsMissing(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setIsMissing(false);
    setUrl(null);

    void getMedia(storageKey).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setIsLoading(false);
        setIsMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [storageKey, enabled]);

  return { url, isLoading, isMissing };
}
