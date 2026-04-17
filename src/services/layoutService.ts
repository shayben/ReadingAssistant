/**
 * Parse reading text into a structured layout while preserving the flat word
 * stream used by pronunciation assessment.
 *
 * - Blocks are separated by blank lines (one or more `\n` with only whitespace).
 * - Within a block, source lines are joined with a space so OCR line breaks
 *   don't break the visual flow; paragraph breaks still come from blank lines.
 * - The first block is treated as a heading if it is a single source line of
 *   at most `maxHeadingWords` words.
 */

export interface LayoutToken {
  text: string;
  /** Flat index into the returned `words` array — matches assessment indexing. */
  index: number;
}

export type BlockKind = 'heading' | 'paragraph';

export interface LayoutBlock {
  kind: BlockKind;
  tokens: LayoutToken[];
}

export interface ParsedLayout {
  words: string[];
  blocks: LayoutBlock[];
}

const MAX_HEADING_WORDS = 12;

export function parseReadingLayout(text: string, maxHeadingWords = MAX_HEADING_WORDS): ParsedLayout {
  const words: string[] = [];
  const blocks: LayoutBlock[] = [];

  if (!text) return { words, blocks };

  // Normalise Windows line endings; split into blocks on blank lines.
  const normalised = text.replace(/\r\n?/g, '\n');
  const rawBlocks = normalised.split(/\n[ \t]*\n+/);

  for (const rawBlock of rawBlocks) {
    const sourceLines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean);
    if (sourceLines.length === 0) continue;

    const tokens: LayoutToken[] = [];
    for (const line of sourceLines) {
      for (const w of line.match(/\S+/g) ?? []) {
        const idx = words.length;
        words.push(w);
        tokens.push({ text: w, index: idx });
      }
    }
    if (tokens.length === 0) continue;

    // Heading heuristic: only the very first block, single source line, short,
    // and doesn't end with sentence-ending punctuation (titles rarely do).
    const isFirstBlock = blocks.length === 0;
    const isSingleLine = sourceLines.length === 1;
    const lineText = sourceLines[0] ?? '';
    const endsWithSentence = /[.!?]["'"\u201D\u2019)\]]*$/.test(lineText);
    const kind: BlockKind =
      isFirstBlock && isSingleLine && tokens.length <= maxHeadingWords && !endsWithSentence
        ? 'heading'
        : 'paragraph';

    blocks.push({ kind, tokens });
  }

  return { words, blocks };
}
