/**
 * Hook: loads and preloads immersive moments for the reading text.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { analyzeTextForMoments } from '../services/momentsService';
import { preloadMoments, deriveStoryTheme } from '../services/mediaService';
import type { PreloadedMoment } from '../services/mediaService';
import type { AmbientCategory } from '../services/audioService';
import type { StickerRegistry } from '../services/stickerService';
import { momentCache } from '../data/momentCache';

interface UseMomentsOptions {
  words: string[];
  momentCacheKey?: string;
  enabled: boolean;
  /** Story sticker registry for cross-chapter reuse (mutated in-place). */
  stickerRegistry?: StickerRegistry;
  /** Labels known from previous chapters — tells the AI to reuse them. */
  knownStickerLabels?: string[];
}

export function useMoments({ words, momentCacheKey, enabled, stickerRegistry, knownStickerLabels }: UseMomentsOptions) {
  const [moments, setMoments] = useState<PreloadedMoment[]>([]);
  const [storyTheme, setStoryTheme] = useState<AmbientCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;

    const momentsPromise = momentCacheKey && momentCache[momentCacheKey]
      ? Promise.resolve(momentCache[momentCacheKey])
      : analyzeTextForMoments(words, knownStickerLabels);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state reset before async load
    setLoading(true);
    setError(null);

    momentsPromise
      .then((raw) => {
        if (cancelledRef.current) return [];
        setStoryTheme(deriveStoryTheme(raw));
        return preloadMoments(raw, stickerRegistry);
      })
      .then((loaded) => { if (!cancelledRef.current) setMoments(loaded); })
      .catch((err) => {
        if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to load moments');
      })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
    return () => { cancelledRef.current = true; };
  }, [words, enabled, momentCacheKey, stickerRegistry, knownStickerLabels]);

  const momentIndices = useMemo(
    () => {
      if (!enabled) return new Set<number>();
      const indices = new Set<number>();
      for (const m of moments) {
        for (let i = m.wordIndex; i <= m.fadeWordIndex; i++) {
          indices.add(i);
        }
      }
      return indices;
    },
    [moments, enabled],
  );

  return { moments, momentIndices, storyTheme, loading, error };
}
