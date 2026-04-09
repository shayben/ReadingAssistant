/**
 * Fetches and preloads media (stickers + audio) for key moments.
 *
 * Sticker images come from the hybrid stickerService (bundled → AI → Wikipedia → emoji).
 * Ambient audio and sound effects are synthesized via audioService (Web Audio API).
 */

import type { KeyMoment } from './momentsService';
import type { AmbientCategory } from './audioService';
import { fetchSticker, type StickerSource, type StickerRegistry } from './stickerService';

/** Entrance animation types for sticker display. */
export type StickerAnimation = 'pop' | 'slide-left' | 'slide-right' | 'float-up';

const ANIMATIONS: StickerAnimation[] = ['pop', 'slide-left', 'slide-right', 'float-up'];

export interface PreloadedMoment {
  wordIndex: number;
  triggerWord: string;
  /** Word index where this moment should fade out. Defaults to wordIndex. */
  fadeWordIndex: number;
  caption: string;
  /** Consistent label for this sticker entity (for reuse and collection). */
  stickerLabel?: string;
  /** Sticker image URL (transparent PNG, Wikipedia thumbnail, or data URI). */
  stickerUrl?: string;
  /** Emoji fallback when no sticker image is available. */
  stickerEmoji?: string;
  /** How the sticker was resolved. */
  stickerSource: StickerSource;
  /** Entrance animation for this sticker. */
  animation: StickerAnimation;
  /** Ambient music category for this moment. */
  musicCategory?: string;
  /** Contextual sound effect to play at this moment. */
  soundEffect?: string;
}

/** Derive the overall story theme from the moments' music categories. */
export function deriveStoryTheme(moments: KeyMoment[]): AmbientCategory | null {
  const cats = moments
    .map((m) => m.musicCategory)
    .filter((c): c is string => !!c);
  if (cats.length === 0) return null;
  // Most frequent category wins
  const freq: Record<string, number> = {};
  for (const c of cats) freq[c] = (freq[c] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] as AmbientCategory;
}

/**
 * Preload all media for an array of key moments.
 * When a stickerRegistry is provided, known labels are reused for visual
 * consistency across chapters; newly resolved stickers are added to it.
 */
export async function preloadMoments(
  moments: KeyMoment[],
  stickerRegistry?: StickerRegistry,
): Promise<PreloadedMoment[]> {
  const results = await Promise.all(
    moments.map(async (m, index): Promise<PreloadedMoment> => {
      const out: PreloadedMoment = {
        wordIndex: m.wordIndex,
        triggerWord: m.triggerWord,
        fadeWordIndex: m.fadeWordIndex ?? m.wordIndex,
        caption: m.caption,
        stickerLabel: m.stickerLabel,
        stickerSource: 'emoji',
        animation: ANIMATIONS[index % ANIMATIONS.length],
      };

      // Resolve sticker — check registry first for cross-chapter reuse
      if (m.type === 'image' || m.type === 'both') {
        const registryKey = m.stickerLabel?.toLowerCase().trim();
        const registryHit = registryKey ? stickerRegistry?.get(registryKey) : undefined;

        if (registryHit) {
          out.stickerSource = registryHit.source;
          if (registryHit.url) {
            out.stickerUrl = registryHit.url;
            const img = new Image();
            img.src = registryHit.url;
          } else if (registryHit.emoji) {
            out.stickerEmoji = registryHit.emoji;
          }
        } else {
          const sticker = await fetchSticker(m.imageQuery, m.stickerPrompt, m.stickerEmoji);
          out.stickerSource = sticker.source;
          if (sticker.url) {
            out.stickerUrl = sticker.url;
            const img = new Image();
            img.src = sticker.url;
          } else if (sticker.emoji) {
            out.stickerEmoji = sticker.emoji;
          }
          // Store in registry for future chapter reuse
          if (registryKey && stickerRegistry) {
            stickerRegistry.set(registryKey, {
              label: m.stickerLabel!,
              url: sticker.url,
              emoji: sticker.emoji,
              source: sticker.source,
              stickerPrompt: m.stickerPrompt,
            });
          }
        }
      } else if (m.stickerEmoji) {
        out.stickerEmoji = m.stickerEmoji;
      }

      // Ambient music category (used by audioService at runtime)
      if ((m.type === 'music' || m.type === 'both') && m.musicCategory) {
        out.musicCategory = m.musicCategory;
      }

      // Contextual sound effect
      if (m.soundEffect) {
        out.soundEffect = m.soundEffect;
      }

      return out;
    }),
  );

  return results.filter((m) => m.stickerUrl || m.stickerEmoji || m.musicCategory || m.soundEffect);
}
