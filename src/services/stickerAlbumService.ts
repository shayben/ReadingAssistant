/**
 * Sticker album service — persists collected stickers in localStorage.
 * Stickers are "collected" when they trigger during reading sessions.
 * Deduplication is by normalised stickerLabel.
 */

import type { StickerSource } from './stickerService';

const STORAGE_KEY = 'wizbit:sticker-album';

export interface CollectedSticker {
  id: string;
  label: string;
  stickerUrl?: string;
  stickerEmoji?: string;
  stickerSource: StickerSource;
  caption: string;
  storyTitle?: string;
  collectedAt: string;
}

function loadAll(): CollectedSticker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CollectedSticker[]) : [];
  } catch {
    return [];
  }
}

function saveAll(stickers: CollectedSticker[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
  } catch { /* quota exceeded — silently fail */ }
}

/** Load all collected stickers, newest first. */
export function loadCollectedStickers(): CollectedSticker[] {
  return loadAll().sort(
    (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
  );
}

/**
 * Collect a sticker (deduplicated by label).
 * If the label already exists, upgrades the image if the existing one was emoji-only.
 */
export function collectSticker(
  sticker: Omit<CollectedSticker, 'id' | 'collectedAt'>,
): CollectedSticker {
  const all = loadAll();
  const normalizedLabel = sticker.label.toLowerCase().trim();
  const existing = all.find(
    (s) => s.label.toLowerCase().trim() === normalizedLabel,
  );

  if (existing) {
    // Upgrade if we now have a real image where before we only had emoji
    if (!existing.stickerUrl && sticker.stickerUrl) {
      existing.stickerUrl = sticker.stickerUrl;
      existing.stickerSource = sticker.stickerSource;
    }
    existing.collectedAt = new Date().toISOString();
    saveAll(all);
    return existing;
  }

  const collected: CollectedSticker = {
    ...sticker,
    id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    collectedAt: new Date().toISOString(),
  };
  all.push(collected);
  saveAll(all);
  return collected;
}

/** Get count of unique collected stickers. */
export function getStickerCount(): number {
  return loadAll().length;
}
