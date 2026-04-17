import { describe, it, expect } from 'vitest';
import {
  normalizeTokens,
  findBestReferenceMatch,
  decideRealignment,
} from '../services/alignmentService';

const REF = 'The quick brown fox jumps over the lazy dog and then runs into the forest to find some tasty berries before sundown'
  .split(' ');

describe('normalizeTokens', () => {
  it('lowercases, strips punctuation, and splits', () => {
    expect(normalizeTokens('Hello, WORLD! It\'s fine.')).toEqual([
      'hello', 'world', "it's", 'fine',
    ]);
  });

  it('handles unicode letters', () => {
    expect(normalizeTokens('Café résumé')).toEqual(['café', 'résumé']);
  });

  it('collapses whitespace', () => {
    expect(normalizeTokens('  a   b\tc\n d ')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('findBestReferenceMatch', () => {
  it('returns null when the interim tail is too short', () => {
    const m = findBestReferenceMatch('quick brown', REF, 0);
    expect(m).toBeNull();
  });

  it('locates an exact contiguous match near the current cursor', () => {
    // Child has read through "the lazy dog" (currentIdx ~= 8).
    // Interim: last words they said.
    const m = findBestReferenceMatch('brown fox jumps over the lazy dog', REF, 8);
    expect(m).not.toBeNull();
    // Next word after "dog" (index 8) is index 9.
    expect(m!.index).toBe(9);
    expect(m!.confidence).toBeGreaterThan(0.9);
    expect(m!.hasDistinctiveMatch).toBe(true);
    expect(m!.margin).toBeGreaterThan(0.1);
  });

  it('detects forward skip (child read ahead of the tracked cursor)', () => {
    // Tracked cursor thinks child is at word 3, but they actually read the
    // forest/berries segment further down the reference text.
    const m = findBestReferenceMatch(
      'runs into the forest to find some tasty berries',
      REF,
      3,
      40,
    );
    expect(m).not.toBeNull();
    // Last matching ref word: "berries" → next index after it.
    // "The quick brown fox jumps over the lazy dog and then runs into
    //  the forest to find some tasty berries before sundown"
    //   0    1     2   3    4    5    6   7    8   9   10    11   12
    //   13    14  15   16    17     18     19
    // berries is 19 → next 20.
    expect(m!.index).toBe(20);
    expect(m!.confidence).toBeGreaterThan(0.8);
    expect(m!.hasDistinctiveMatch).toBe(true);
  });

  it('detects backward jump (child re-read earlier text)', () => {
    // Tracked cursor is at 18, but child went back and is re-reading.
    const m = findBestReferenceMatch('quick brown fox jumps over the lazy', REF, 18);
    expect(m).not.toBeNull();
    expect(m!.index).toBeLessThan(10);
    expect(m!.hasDistinctiveMatch).toBe(true);
  });

  it('ignores matches without at least one distinctive token', () => {
    // All tokens are stopwords or short — no distinctive match.
    const ref = 'the a an and or but if to of in on at'.split(' ');
    const m = findBestReferenceMatch('the and or but', ref, 0);
    // It may still compute a score, but hasDistinctiveMatch must be false
    // so downstream decideRealignment will reject it.
    expect(m?.hasDistinctiveMatch ?? false).toBe(false);
  });

  it('respects the search radius', () => {
    // "berries" is at index 19. Current cursor at 0 with radius 5 won't reach it.
    const m = findBestReferenceMatch(
      'runs into the forest to find some tasty berries',
      REF,
      0,
      5,
    );
    // Either null or an unrelated low-confidence match — must not be index 20.
    expect(m?.index ?? 0).not.toBe(20);
  });
});

describe('decideRealignment', () => {
  const baseMatch = {
    index: 20,
    confidence: 0.95,
    margin: 0.4,
    hasDistinctiveMatch: true,
  };

  it('jumps on high confidence with no suspect signal', () => {
    const d = decideRealignment({
      match: baseMatch,
      currentIdx: 3,
      suspectSignal: false,
    });
    expect(d.shouldRealign).toBe(true);
    expect(d.targetIndex).toBe(20);
    expect(d.direction).toBe('forward');
  });

  it('refuses low confidence without suspect signal', () => {
    const d = decideRealignment({
      match: { ...baseMatch, confidence: 0.6, margin: 0.16 },
      currentIdx: 3,
      suspectSignal: false,
    });
    expect(d.shouldRealign).toBe(false);
  });

  it('accepts medium confidence when a suspect signal is active', () => {
    const d = decideRealignment({
      match: { ...baseMatch, confidence: 0.6, margin: 0.16 },
      currentIdx: 3,
      suspectSignal: true,
      suspectReason: 'omission-streak',
    });
    expect(d.shouldRealign).toBe(true);
    expect(d.reason).toContain('omission-streak');
  });

  it('rejects matches without a distinctive token even at high confidence', () => {
    const d = decideRealignment({
      match: { ...baseMatch, hasDistinctiveMatch: false },
      currentIdx: 3,
      suspectSignal: true,
    });
    expect(d.shouldRealign).toBe(false);
  });

  it('rejects jumps smaller than minJump', () => {
    const d = decideRealignment({
      match: { ...baseMatch, index: 4 },
      currentIdx: 3,
      suspectSignal: true,
    });
    expect(d.shouldRealign).toBe(false);
  });

  it('detects backward direction', () => {
    const d = decideRealignment({
      match: { ...baseMatch, index: 2 },
      currentIdx: 18,
      suspectSignal: false,
    });
    expect(d.shouldRealign).toBe(true);
    expect(d.direction).toBe('backward');
  });
});
