/**
 * Azure Computer Vision OCR service.
 * Sends an image (base64 data URL or Blob) to the Azure Read API and
 * returns the recognised text as a single string.
 *
 * An optional LLM postprocessing pass (GPT-4o-mini) cleans OCR noise
 * using layout context (position, size, confidence) from the vision API.
 */

const VISION_ENDPOINT = import.meta.env.VITE_AZURE_VISION_ENDPOINT as string;
const VISION_KEY = import.meta.env.VITE_AZURE_VISION_KEY as string;

const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string;
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY as string;
const OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string;

/** Max dimension (px) for the longest side before sending to Azure. */
const MAX_IMAGE_DIMENSION = 2048;
/** Target JPEG quality for recompression. */
const JPEG_QUALITY = 0.85;

export interface OcrResult {
  text: string;
  lines: string[];
}

// ---------------------------------------------------------------------------
// Layout types — extracted from Azure Vision bounding polygons
// ---------------------------------------------------------------------------

interface LayoutLine {
  text: string;
  /** Vertical centre as % of page height (0 = top, 100 = bottom). */
  yPct: number;
  /** Line height as % of page height (larger ⇒ heading). */
  heightPct: number;
  /** Horizontal left edge as % of page width. */
  xPct: number;
  /** Line width as % of page width. */
  widthPct: number;
  /** Mean word-level OCR confidence (0–1). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Image preparation
// ---------------------------------------------------------------------------

/**
 * Resize and re-encode an image data-URL so that:
 *  - The longest side is at most MAX_IMAGE_DIMENSION px.
 *  - The blob stays well under the Azure 4 MB limit.
 *  - EXIF orientation is baked in (browsers apply it when drawing to canvas).
 */
async function prepareImage(dataUrl: string): Promise<Blob> {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());

  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  img.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}

// ---------------------------------------------------------------------------
// Layout extraction — bounding polygons → normalised percentages
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractLayoutLines(
  readResult: any,
  imgWidth: number,
  imgHeight: number,
): LayoutLine[] {
  const lines: LayoutLine[] = [];

  for (const block of readResult?.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const text: string = (line.text ?? line.content ?? '').trim();
      if (!text) continue;

      const poly: Array<{ x: number; y: number }> = line.boundingPolygon ?? [];

      if (poly.length >= 4 && imgWidth > 0 && imgHeight > 0) {
        const xs = poly.map((p) => p.x);
        const ys = poly.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const words: any[] = line.words ?? [];
        const confidence =
          words.length > 0
            ? words.reduce((sum: number, w: any) => sum + (w.confidence ?? 0.5), 0) / words.length
            : 0.5;

        lines.push({
          text,
          yPct: ((minY + maxY) / 2 / imgHeight) * 100,
          heightPct: ((maxY - minY) / imgHeight) * 100,
          xPct: (minX / imgWidth) * 100,
          widthPct: ((maxX - minX) / imgWidth) * 100,
          confidence,
        });
      } else {
        // No polygon data — fallback without spatial info
        lines.push({ text, yPct: 50, heightPct: 2, xPct: 0, widthPct: 100, confidence: 0.5 });
      }
    }
  }

  return lines;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Format layout-annotated lines for the LLM
// ---------------------------------------------------------------------------

function formatLayoutForLLM(layoutLines: LayoutLine[]): string {
  if (layoutLines.length === 0) return '';

  // Compute median line height to identify relatively larger text
  const heights = layoutLines.map((l) => l.heightPct).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)];

  // Compute vertical gaps between consecutive lines
  const gaps: number[] = [];
  for (let i = 1; i < layoutLines.length; i++) {
    gaps.push(layoutLines[i].yPct - layoutLines[i - 1].yPct);
  }
  const medianGap = gaps.length > 0
    ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : 0;

  return layoutLines
    .map((line, i) => {
      const tags: string[] = [];

      // Positional tags
      if (line.yPct < 8) tags.push('TOP');
      if (line.yPct > 92) tags.push('BOTTOM');
      if (line.heightPct > medianHeight * 1.4) tags.push('LARGE');

      // Horizontal alignment: centred if midpoint is near page centre
      const midX = line.xPct + line.widthPct / 2;
      if (midX > 35 && midX < 65 && line.widthPct < 60) tags.push('CENTER');

      // Indent detection: significantly offset from the left margin
      const leftEdges = layoutLines.map((l) => l.xPct);
      const typicalLeft = leftEdges.sort((a, b) => a - b)[Math.floor(leftEdges.length * 0.25)];
      if (line.xPct > typicalLeft + 4) tags.push('INDENT');

      // Low confidence
      if (line.confidence < 0.7) tags.push('LOW-CONF');

      // Paragraph gap: preceding vertical gap is noticeably larger than normal
      if (i > 0 && medianGap > 0) {
        const gap = layoutLines[i].yPct - layoutLines[i - 1].yPct;
        if (gap > medianGap * 1.8) tags.push('GAP');
      }

      const tagStr = tags.length > 0 ? ` [${tags.join(',')}]` : '';
      return `${i + 1}. (y:${line.yPct.toFixed(0)}% h:${line.heightPct.toFixed(1)}% conf:${line.confidence.toFixed(2)})${tagStr} "${line.text}"`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// LLM postprocessing
// ---------------------------------------------------------------------------

const CLEAN_PROMPT_WITH_LAYOUT = `You are an OCR postprocessor for a children's reading app.
Given OCR lines with layout metadata from a scanned page, return ONLY the main readable text.

Each input line has: line number, (y%, h%, conf), optional [TAGS], then "text".
- y%: vertical position (0%=top, 100%=bottom of page)
- h%: text height relative to page (larger = heading/title font)
- conf: OCR confidence 0–1 (lower = noisier)
- Tags explain spatial context:
  [TOP] near top edge — likely header/running title
  [BOTTOM] near bottom edge — likely footer/page number
  [LARGE] text is bigger than body text — likely title or heading
  [CENTER] horizontally centred — often titles, page numbers, captions
  [INDENT] indented from the left margin — often a new paragraph
  [GAP] preceded by a large vertical gap — paragraph or section break
  [LOW-CONF] low OCR confidence — likely noise, watermark, or artefact

Rules:
- Remove lines that are headers, footers, or page numbers (use [TOP], [BOTTOM], [CENTER] + short text)
- Remove [LOW-CONF] text that looks like noise, watermarks, or artefacts
- Use [LARGE] / [CENTER] to identify titles — place on their own line with a blank line after
- Insert blank lines at [GAP] or [INDENT] boundaries to mark paragraph breaks
- Fix obvious OCR errors (e.g. "rn" → "m", "l" → "I" based on context)
- Do NOT add, rephrase, or summarise — keep the original wording
- Return the cleaned text only, no commentary or annotations`;

/** Plain-text fallback when no layout data is available. */
const CLEAN_PROMPT_PLAIN = `You are an OCR postprocessor for a children's reading app.
Given raw OCR lines from a scanned page, return ONLY the main readable text.

Rules:
- Remove page numbers, headers, footers, watermarks, URLs, copyright notices
- Remove stray symbols, OCR artifacts, and partial/garbled words
- If there is a title or heading, put it on its own line followed by a blank line
- Separate paragraphs with a blank line
- Fix obvious OCR errors (e.g. "rn" → "m", "l" → "I" in context)
- Do NOT add, rephrase, or summarise — keep the original wording
- Return the cleaned text only, no commentary`;

const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt === retries) return res;
    const retryAfter = Number(res.headers.get('Retry-After') || 0);
    const delay = Math.max(retryAfter * 1000, 2000 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, delay));
  }
  return fetch(url, init);
}

/**
 * Use GPT-4o-mini to clean OCR output.
 * When layout data is available, sends annotated lines with spatial context.
 * Falls back to plain text lines when layout is unavailable.
 */
async function postprocessOcr(
  lines: string[],
  layoutLines?: LayoutLine[],
): Promise<string> {
  if (!OPENAI_ENDPOINT || !OPENAI_KEY || !OPENAI_DEPLOYMENT || lines.length === 0) {
    return lines.join(' ');
  }

  const hasLayout = layoutLines && layoutLines.length > 0;
  const systemPrompt = hasLayout ? CLEAN_PROMPT_WITH_LAYOUT : CLEAN_PROMPT_PLAIN;
  const userContent = hasLayout ? formatLayoutForLLM(layoutLines) : lines.join('\n');

  const url = `${OPENAI_ENDPOINT}/openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`;

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'api-key': OPENAI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) return lines.join(' ');

    const data = await res.json();
    const cleaned: string = data?.choices?.[0]?.message?.content ?? '';
    return cleaned.trim() || lines.join(' ');
  } catch {
    return lines.join(' ');
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run Azure Computer Vision Read (OCR) on the supplied image.
 * @param imageDataUrl  A base64 data-URL produced by <canvas>.toDataURL() or similar.
 */
export async function recognizeText(imageDataUrl: string): Promise<OcrResult> {
  if (!VISION_ENDPOINT || !VISION_KEY) {
    throw new Error(
      'Azure Computer Vision credentials are not configured. ' +
      'Set VITE_AZURE_VISION_ENDPOINT and VITE_AZURE_VISION_KEY in your .env file.'
    );
  }

  const blob = await prepareImage(imageDataUrl);

  const submitUrl = `${VISION_ENDPOINT.replace(/\/$/, '')}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`;
  const submitRes = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': VISION_KEY,
      'Content-Type': 'image/jpeg',
    },
    body: blob,
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Azure Vision API error ${submitRes.status}: ${errText}`);
  }

  const data = await submitRes.json();

  // Extract image dimensions from response metadata
  const imgWidth: number = data?.metadata?.width ?? 0;
  const imgHeight: number = data?.metadata?.height ?? 0;
  const readResult = data?.readResult;

  // Extract layout-annotated lines (with bounding boxes + confidence)
  const layoutLines = extractLayoutLines(readResult, imgWidth, imgHeight);

  // Plain text lines for the OcrResult.lines field
  const lines = layoutLines.map((l) => l.text);

  const text = await postprocessOcr(lines, layoutLines);
  return { text, lines };
}
