import { describe, it, expect } from 'vitest';
import { computeNewTrophies } from '../services/trophyService';
import type { UserProgress } from '../services/progressService';
import type { StoryStats } from '../services/storyLibraryService';

function makeProgress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    sessionCount: 0,
    sessionDates: [],
    practiceClearedCount: 0,
    latestSession: null,
    totalWordsRead: 0,
    consecutiveWeeks: 0,
    ...overrides,
  };
}

function makeStoryStats(overrides: Partial<StoryStats> = {}): StoryStats {
  return {
    storiesCreated: 0,
    storiesCompleted: 0,
    readingLevelsUsed: [],
    longestAdventure: 0,
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

  // ── New trophy tests ──

  it('awards perfect_accuracy on 100% accuracy', () => {
    const progress = makeProgress({
      sessionCount: 1,
      latestSession: {
        id: 't', date: '', title: '', score: 85, stars: 4,
        accuracy: 100, wordCount: 20, hardWordCount: 0, hardWordCorrect: 0,
        wordsNeedPractice: [],
      },
    });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('perfect_accuracy');
  });

  it('awards big_session for 50+ words and 80+ score', () => {
    const progress = makeProgress({
      sessionCount: 1,
      latestSession: {
        id: 't', date: '', title: '', score: 85, stars: 4,
        accuracy: 85, wordCount: 60, hardWordCount: 2, hardWordCorrect: 1,
        wordsNeedPractice: [],
      },
    });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('big_session');
  });

  it('does not award big_session for short passages', () => {
    const progress = makeProgress({
      sessionCount: 1,
      latestSession: {
        id: 't', date: '', title: '', score: 95, stars: 5,
        accuracy: 95, wordCount: 20, hardWordCount: 0, hardWordCorrect: 0,
        wordsNeedPractice: [],
      },
    });
    const result = computeNewTrophies(progress, new Set());
    expect(result).not.toContain('big_session');
  });

  it('awards practice clearing milestones', () => {
    const progress = makeProgress({ sessionCount: 5, practiceClearedCount: 12 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('practice_cleared');
    expect(result).toContain('ten_cleared');
    expect(result).not.toContain('twenty_five_cleared');
  });

  it('awards reading volume milestones', () => {
    const progress = makeProgress({ sessionCount: 20, totalWordsRead: 1200 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('words_500');
    expect(result).toContain('words_1000');
    expect(result).not.toContain('words_5000');
  });

  it('awards extended streak milestones', () => {
    const dates: string[] = [];
    for (let i = 0; i < 16; i++) dates.push(`2024-01-${String(i + 1).padStart(2, '0')}`);
    const progress = makeProgress({ sessionCount: 16, sessionDates: dates });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('streak_14');
    expect(result).not.toContain('streak_30');
  });

  it('awards consecutive week milestones', () => {
    const progress = makeProgress({ sessionCount: 10, consecutiveWeeks: 3 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).toContain('weeks_2');
    expect(result).not.toContain('weeks_4');
  });

  it('awards story creation trophies', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const stats = makeStoryStats({ storiesCreated: 2, storiesCompleted: 1 });
    const result = computeNewTrophies(progress, new Set(), stats);
    expect(result).toContain('first_story');
    expect(result).toContain('story_finisher');
    expect(result).not.toContain('five_stories');
  });

  it('awards adventure length trophies', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const stats = makeStoryStats({ storiesCreated: 1, storiesCompleted: 1, longestAdventure: 6 });
    const result = computeNewTrophies(progress, new Set(), stats);
    expect(result).toContain('long_adventure');
  });

  it('awards level exploration trophies', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const stats = makeStoryStats({ storiesCreated: 3, readingLevelsUsed: ['K', '1', '2'] });
    const result = computeNewTrophies(progress, new Set(), stats);
    expect(result).toContain('level_explorer');
    expect(result).not.toContain('level_master');
  });

  it('awards level_master when all levels used', () => {
    const progress = makeProgress({ sessionCount: 1 });
    const stats = makeStoryStats({
      storiesCreated: 7,
      readingLevelsUsed: ['K', '1', '2', '3', '4', '5', '6'],
    });
    const result = computeNewTrophies(progress, new Set(), stats);
    expect(result).toContain('level_master');
  });

  it('does not award story trophies without storyStats', () => {
    const progress = makeProgress({ sessionCount: 5 });
    const result = computeNewTrophies(progress, new Set());
    expect(result).not.toContain('first_story');
    expect(result).not.toContain('story_finisher');
  });
});
