import { describe, it, expect } from 'vitest';
import { computeNewTrophies } from '../services/trophyService';
import type { UserProgress } from '../services/progressService';

function makeProgress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    sessionCount: 0,
    sessionDates: [],
    practiceClearedCount: 0,
    latestSession: null,
    ...overrides,
  };
}

describe('computeNewTrophies', () => {
  it('awards first_read on first session', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('first_read');
  });

  it('does not re-award already earned trophies', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const result = computeNewTrophies(progress, new Set(['first_read']));
    expect(result).not.toContain('first_read');
  });

  it('awards session milestones', () => {
    const progress = makeProgress({ sessionCount: 10 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('first_read');
    expect(result).toContain('five_sessions');
    expect(result).toContain('ten_sessions');
    expect(result).not.toContain('twenty_five_sessions');
  });

  it('awards score-based trophies from latest session', () => {
    const progress = makeProgress({
      sessionCount: 1,
      latestSession: {
        id: 'test', date: '', title: '', score: 95, stars: 5,
        accuracy: 95, wordCount: 10, hardWordCount: 2, hardWordCorrect: 1,
        wordsNeedPractice: [],
      },
    });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('score_90');
    expect(result).toContain('score_75');
    expect(result).toContain('five_stars');
    expect(result).not.toContain('score_100');
  });

  it('awards streak trophies based on unique days', () => {
    const progress = makeProgress({
      sessionCount: 3,
      sessionDates: ['2024-01-01', '2024-01-02', '2024-01-03'],
    });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('streak_3');
    expect(result).not.toContain('streak_7');
  });

  it('awards practice_cleared when practice count > 0', () => {
    const progress = makeProgress({ sessionCount: 1, practiceClearedCount: 2 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('practice_cleared');
  });
});
