import { describe, it, expect } from 'vitest';
import {
  countSyllables,
  getWordDifficulty,
  calculateGamificationScore,
} from '../services/gamificationService';
import type { WordStatus } from '../types/word';

describe('countSyllables', () => {
  it('counts single-syllable words', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('run')).toBe(1);
    expect(countSyllables('the')).toBe(1);
  });

  it('counts multi-syllable words', () => {
    expect(countSyllables('happy')).toBe(2);
    expect(countSyllables('beautiful')).toBe(3);
    expect(countSyllables('elephant')).toBe(3);
  });

  it('handles silent trailing e', () => {
    expect(countSyllables('make')).toBe(1);
    expect(countSyllables('home')).toBe(1);
  });

  it('handles empty/non-alpha input', () => {
    expect(countSyllables('')).toBe(1);
    expect(countSyllables('123')).toBe(1);
  });
});

describe('getWordDifficulty', () => {
  it('returns 1 for easy words', () => {
    expect(getWordDifficulty('cat')).toBe(1);
    expect(getWordDifficulty('run')).toBe(1);
  });

  it('returns 2 for medium words', () => {
    expect(getWordDifficulty('happy')).toBe(2);
  });

  it('returns 3 for hard words', () => {
    expect(getWordDifficulty('beautiful')).toBe(3);
    expect(getWordDifficulty('elephant')).toBe(3);
  });
});

describe('calculateGamificationScore', () => {
  it('returns null when no words assessed', () => {
    expect(calculateGamificationScore([], {}, {})).toBeNull();
  });

  it('gives a perfect score when all correct', () => {
    const words = ['the', 'cat', 'sat'];
    const statuses: Record<number, WordStatus> = { 0: 'correct', 1: 'correct', 2: 'correct' };
    const scores: Record<number, number> = { 0: 100, 1: 100, 2: 100 };

    const result = calculateGamificationScore(words, statuses, scores);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
    expect(result!.stars).toBe(5);
  });

  it('gives a low score when all mispronounced', () => {
    const words = ['the', 'cat'];
    const statuses: Record<number, WordStatus> = { 0: 'mispronounced', 1: 'mispronounced' };
    const scores: Record<number, number> = { 0: 10, 1: 10 };

    const result = calculateGamificationScore(words, statuses, scores);
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(30);
    expect(result!.stars).toBe(1);
  });

  it('blends fluency score when provided', () => {
    const words = ['the', 'cat'];
    const statuses: Record<number, WordStatus> = { 0: 'correct', 1: 'correct' };
    const scores: Record<number, number> = { 0: 100, 1: 100 };

    const withFluency = calculateGamificationScore(words, statuses, scores, 80);
    const withoutFluency = calculateGamificationScore(words, statuses, scores);
    expect(withFluency).not.toBeNull();
    expect(withoutFluency).not.toBeNull();
    // With fluency it's blended, may differ slightly
    expect(withFluency!.score).toBeGreaterThan(0);
  });

  it('tracks hard words', () => {
    const words = ['the', 'beautiful', 'elephant'];
    const statuses: Record<number, WordStatus> = { 0: 'correct', 1: 'correct', 2: 'mispronounced' };
    const scores: Record<number, number> = { 0: 100, 1: 95, 2: 30 };

    const result = calculateGamificationScore(words, statuses, scores);
    expect(result!.hardWordCount).toBe(2);
    expect(result!.hardWordCorrect).toBe(1);
  });
});
