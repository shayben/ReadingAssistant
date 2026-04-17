import { describe, it, expect } from 'vitest';
import { parseReadingLayout } from '../services/layoutService';

describe('parseReadingLayout', () => {
  it('returns empty for empty input', () => {
    const r = parseReadingLayout('');
    expect(r.words).toEqual([]);
    expect(r.blocks).toEqual([]);
  });

  it('treats a single line with terminal punctuation as a paragraph', () => {
    const r = parseReadingLayout('The cat sat on a mat.');
    expect(r.words).toEqual(['The', 'cat', 'sat', 'on', 'a', 'mat.']);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].kind).toBe('paragraph');
  });

  it('treats a title-like first line (no sentence punctuation) as a heading', () => {
    const r = parseReadingLayout('The Big Cat');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].kind).toBe('heading');
  });

  it('detects a leading heading when followed by a paragraph', () => {
    const text = 'The Big Cat\n\nThe cat sat on a mat. The cat is red.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0].kind).toBe('heading');
    expect(r.blocks[0].tokens.map((t) => t.text)).toEqual(['The', 'Big', 'Cat']);
    expect(r.blocks[1].kind).toBe('paragraph');
  });

  it('does NOT treat a long first line as a heading', () => {
    const longFirst =
      'This is a rather long opening sentence that goes beyond the twelve word cap used for headings here.\n\nSecond paragraph follows.';
    const r = parseReadingLayout(longFirst);
    expect(r.blocks[0].kind).toBe('paragraph');
  });

  it('does not treat a non-first short block as a heading', () => {
    const text = 'Intro paragraph is here and it is long enough.\n\nShort line.\n\nMore text.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(3);
    expect(r.blocks[0].kind).toBe('paragraph');
    expect(r.blocks[1].kind).toBe('paragraph'); // not heading
    expect(r.blocks[2].kind).toBe('paragraph');
  });

  it('preserves paragraph breaks', () => {
    const text = 'First paragraph first sentence.\n\nSecond paragraph begins here.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0].tokens.map((t) => t.text).join(' ')).toBe('First paragraph first sentence.');
    expect(r.blocks[1].tokens.map((t) => t.text).join(' ')).toBe('Second paragraph begins here.');
  });

  it('joins soft-wrapped OCR lines within a single block with spaces', () => {
    // OCR often breaks a single paragraph across lines mid-sentence.
    const text = 'The quick brown fox\njumps over the lazy\ndog in the meadow.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].kind).toBe('paragraph');
    expect(r.words).toEqual([
      'The', 'quick', 'brown', 'fox',
      'jumps', 'over', 'the', 'lazy',
      'dog', 'in', 'the', 'meadow.',
    ]);
  });

  it('gives each token a sequential flat index matching the words array', () => {
    const text = 'Title\n\nHello world.\n\nSecond paragraph here.';
    const r = parseReadingLayout(text);
    const allTokens = r.blocks.flatMap((b) => b.tokens);
    expect(allTokens.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(allTokens.map((t) => t.text)).toEqual(r.words);
  });

  it('normalises Windows line endings', () => {
    const text = 'Title\r\n\r\nBody line one.\r\nBody line two.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0].kind).toBe('heading');
    expect(r.blocks[1].tokens.map((t) => t.text).join(' ')).toBe('Body line one. Body line two.');
  });

  it('collapses multiple blank lines between blocks', () => {
    const text = 'One\n\n\n\nTwo paragraph here is longer.\n\n\nThree paragraph here.';
    const r = parseReadingLayout(text);
    expect(r.blocks).toHaveLength(3);
  });
});
