/**
 * Hybrid sticker image service.
 *
 * Resolution order:
 *  1. Pre-bundled transparent PNG from /public/stickers/ (instant, zero cost)
 *  2. Azure OpenAI DALL-E generated sticker (transparent PNG, ~$0.02-0.04 each)
 *  3. Wikipedia thumbnail styled as a sticker (free, good coverage)
 *  4. Emoji fallback (always available, animated)
 *
 * To add pre-bundled stickers, drop transparent PNGs into /public/stickers/
 * and add the filename to STICKER_CATALOG keyed by imageQuery keyword.
 */

const DALLE_DEPLOYMENT = import.meta.env.VITE_AZURE_DALLE_DEPLOYMENT as string | undefined;
const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY as string | undefined;

export type StickerSource = 'bundled' | 'generated' | 'wikipedia' | 'emoji';

export interface StickerResult {
  source: StickerSource;
  /** Image URL (transparent PNG, Wikipedia thumbnail, or data URI). */
  url?: string;
  /** Emoji character used as a sticker when no image is available. */
  emoji?: string;
}

// ---------------------------------------------------------------------------
// Story sticker registry — enables cross-chapter sticker reuse
// ---------------------------------------------------------------------------

export interface StickerRegistryEntry {
  label: string;
  url?: string;
  emoji?: string;
  source: StickerSource;
  stickerPrompt?: string;
}

/** Map from normalised stickerLabel → resolved sticker data. */
export type StickerRegistry = Map<string, StickerRegistryEntry>;

/** Serialize a StickerRegistry for JSON storage (e.g. in SavedStory). */
export function serializeRegistry(registry: StickerRegistry): StickerRegistryEntry[] {
  return Array.from(registry.values());
}

/** Deserialize a StickerRegistry from a stored array. */
export function deserializeRegistry(entries: StickerRegistryEntry[]): StickerRegistry {
  const map: StickerRegistry = new Map();
  for (const e of entries) {
    map.set(e.label.toLowerCase().trim(), e);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Pre-bundled sticker catalog
// ---------------------------------------------------------------------------

/**
 * Maps lowercase imageQuery keywords to filenames in /public/stickers/.
 * Add entries here as transparent PNG stickers are designed.
 */
const STICKER_CATALOG: Record<string, string> = {
  // Example: 'cat': 'cat.png',
  // Populate as sticker assets are added to /public/stickers/
};

async function tryBundledSticker(imageQuery: string): Promise<string | undefined> {
  const key = imageQuery.toLowerCase().replace(/_/g, ' ');
  const filename = STICKER_CATALOG[key];
  if (!filename) return undefined;
  const url = `/stickers/${filename}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok ? url : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Azure OpenAI DALL-E generation
// ---------------------------------------------------------------------------

const isDalleConfigured = Boolean(DALLE_DEPLOYMENT && OPENAI_ENDPOINT && OPENAI_KEY);

async function generateStickerImage(prompt: string): Promise<string | undefined> {
  if (!isDalleConfigured) return undefined;

  const url = `${OPENAI_ENDPOINT}/openai/deployments/${DALLE_DEPLOYMENT}/images/generations?api-version=2025-04-01-preview`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': OPENAI_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `Cute cartoon sticker for a children's reading app, flat design, simple shapes, bold outlines, vibrant colors, child-friendly: ${prompt}`,
        n: 1,
        size: '1024x1024',
        quality: 'low',
        background: 'transparent',
        output_format: 'png',
      }),
    });

    if (!res.ok) return undefined;
    const data = await res.json();
    const item = data?.data?.[0];
    if (item?.url) return item.url;
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Wikipedia fallback
// ---------------------------------------------------------------------------

async function fetchWikipediaImage(query: string): Promise<string | undefined> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.thumbnail?.source ?? data?.originalimage?.source;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const stickerCache = new Map<string, StickerResult>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a sticker for a moment. Tries each source in priority order.
 *
 * @param imageQuery   Wikipedia article title / catalog keyword.
 * @param stickerPrompt  Descriptive prompt for AI image generation.
 * @param stickerEmoji   Fallback emoji from the AI analysis.
 */
export async function fetchSticker(
  imageQuery?: string,
  stickerPrompt?: string,
  stickerEmoji?: string,
): Promise<StickerResult> {
  const cacheKey = `${imageQuery ?? ''}|${stickerPrompt ?? ''}`;
  const cached = stickerCache.get(cacheKey);
  if (cached) return cached;

  const store = (result: StickerResult): StickerResult => {
    stickerCache.set(cacheKey, result);
    return result;
  };

  // 1. Pre-bundled sticker
  if (imageQuery) {
    const bundled = await tryBundledSticker(imageQuery);
    if (bundled) return store({ source: 'bundled', url: bundled });
  }

  // 2. AI-generated sticker (transparent PNG)
  if (stickerPrompt) {
    const generated = await generateStickerImage(stickerPrompt);
    if (generated) return store({ source: 'generated', url: generated });
  }

  // 3. Wikipedia image
  if (imageQuery) {
    const wikiUrl = await fetchWikipediaImage(imageQuery);
    if (wikiUrl) return store({ source: 'wikipedia', url: wikiUrl });
  }

  // 4. Emoji fallback
  if (stickerEmoji) return store({ source: 'emoji', emoji: stickerEmoji });

  return store({ source: 'emoji' });
}
