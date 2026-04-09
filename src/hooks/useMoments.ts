/**
 * Hook: loads and preloads immersive moments for the reading text.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { analyzeTextForMoments } from '../services/momentsService';
import { preloadMoments } from '../services/mediaService';
import type { PreloadedMoment } from '../services/mediaService';
import { momentCache } from '../data/momentCache';

interface UseMomentsOptions {
  words: string[];
  momentCacheKey?: string;
  enabled: boolean;
}

export function useMoments({ words, momentCacheKey, enabled }: UseMomentsOptions) {
  const [moments, setMoments] = useState<PreloadedMoment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;

    const momentsPromise = momentCacheKey && momentCache[momentCacheKey]
      ? Promise.resolve(momentCache[momentCacheKey])
      : analyzeTextForMoments(words);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state reset before async load
    setLoading(true);
    setError(null);

    momentsPromise
      .then((raw) => (!cancelledRef.current ? preloadMoments(raw) : []))
      .then((loaded) => { if (!cancelledRef.current) setMoments(loaded); })
      .catch((err) => {
        if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to load moments');
      })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
    return () => { cancelledRef.current = true; };
  }, [words, enabled, momentCacheKey]);

  const momentIndices = useMemo(
    () => new Set(enabled ? moments.map((m) => m.wordIndex) : []),
    [moments, enabled],
  );

  return { moments, momentIndices, loading, error };
}
