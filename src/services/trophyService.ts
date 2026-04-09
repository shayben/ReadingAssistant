/**
 * Trophy definitions and award logic.
 *
 * Trophies are awarded after a reading session based on cumulative stats.
 * Each trophy can only be earned once per user.
 */

import type { UserProgress } from './progressService';
import type { StoryStats } from './storyLibraryService';
import { readingLevels } from '../data/demoParagraphs';

export interface Trophy {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** Optional grouping for UI display. */
  category: 'reading' | 'score' | 'words' | 'streak' | 'story' | 'mastery';
}

export const ALL_TROPHIES: Trophy[] = [
  // ── Reading session milestones ──
  { id: 'first_read',           emoji: '📖', name: 'First Read',          description: 'Complete your first reading session', category: 'reading' },
  { id: 'five_sessions',        emoji: '🔖', name: 'Bookmarked',          description: 'Complete 5 reading sessions', category: 'reading' },
  { id: 'ten_sessions',         emoji: '📚', name: 'Bookworm',            description: 'Complete 10 reading sessions', category: 'reading' },
  { id: 'twenty_five_sessions', emoji: '🦉', name: 'Wise Reader',         description: 'Complete 25 reading sessions', category: 'reading' },
  { id: 'fifty_sessions',       emoji: '🏛️', name: 'Library Hero',        description: 'Complete 50 reading sessions', category: 'reading' },

  // ── Score milestones ──
  { id: 'score_50',             emoji: '🌱', name: 'Growing Strong',      description: 'Score 50 or higher in a session', category: 'score' },
  { id: 'score_75',             emoji: '⭐', name: 'Rising Star',         description: 'Score 75 or higher in a session', category: 'score' },
  { id: 'score_90',             emoji: '🏆', name: 'Champion Reader',     description: 'Score 90 or higher in a session', category: 'score' },
  { id: 'score_100',            emoji: '💎', name: 'Perfect Read',        description: 'Score 100 in a session', category: 'score' },
  { id: 'perfect_accuracy',     emoji: '🎯', name: 'Sharpshooter',       description: 'Achieve 100% word accuracy in a session', category: 'score' },
  { id: 'five_stars',           emoji: '🌟', name: 'Five Star Reader',    description: 'Earn 5 stars in a single session', category: 'score' },

  // ── Hard words & vocabulary ──
  { id: 'hard_words_3',         emoji: '💪', name: 'Word Warrior',        description: 'Correctly read 3+ tricky words in one session', category: 'words' },
  { id: 'hard_words_10',        emoji: '🧠', name: 'Vocabulary Master',   description: 'Correctly read 10+ tricky words in one session', category: 'words' },
  { id: 'practice_cleared',     emoji: '✅', name: 'Practice Pays Off',   description: 'Clear a word from your practice list', category: 'words' },
  { id: 'ten_cleared',          emoji: '🧹', name: 'Word Cleaner',        description: 'Clear 10 words from your practice list', category: 'words' },
  { id: 'twenty_five_cleared',  emoji: '🏅', name: 'Word Conqueror',      description: 'Clear 25 words from your practice list', category: 'words' },

  // ── Reading volume ──
  { id: 'words_500',            emoji: '📜', name: 'Word Explorer',       description: 'Read 500 words total', category: 'reading' },
  { id: 'words_1000',           emoji: '📖', name: 'Word Scholar',        description: 'Read 1,000 words total', category: 'reading' },
  { id: 'words_5000',           emoji: '🏰', name: 'Word Kingdom',        description: 'Read 5,000 words total', category: 'reading' },
  { id: 'big_session',          emoji: '🔍', name: 'Deep Reader',         description: 'Score 80+ on a passage with 50+ words', category: 'reading' },

  // ── Streaks & consistency ──
  { id: 'streak_3',             emoji: '🔥', name: 'On Fire',             description: 'Read on 3 different days', category: 'streak' },
  { id: 'streak_7',             emoji: '⚡', name: 'Lightning Streak',    description: 'Read on 7 different days', category: 'streak' },
  { id: 'streak_14',            emoji: '✨', name: 'Two-Week Champion',   description: 'Read on 14 different days', category: 'streak' },
  { id: 'streak_30',            emoji: '🌈', name: 'Monthly Champion',    description: 'Read on 30 different days', category: 'streak' },
  { id: 'weeks_2',              emoji: '📅', name: 'Two-Week Streak',     description: 'Read for 2 consecutive weeks', category: 'streak' },
  { id: 'weeks_4',              emoji: '🗓️', name: 'Monthly Dedication',  description: 'Read for 4 consecutive weeks', category: 'streak' },
  { id: 'weeks_8',              emoji: '💫', name: 'Unstoppable',         description: 'Read for 8 consecutive weeks', category: 'streak' },

  // ── Story / Adventure ──
  { id: 'first_story',          emoji: '📝', name: 'First Story',         description: 'Create your first adventure story', category: 'story' },
  { id: 'five_stories',         emoji: '✍️', name: 'Storyteller',         description: 'Create 5 adventure stories', category: 'story' },
  { id: 'ten_stories',          emoji: '🖊️', name: 'Story Weaver',        description: 'Create 10 adventure stories', category: 'story' },
  { id: 'story_finisher',       emoji: '🏁', name: 'Story Finisher',      description: 'Complete an entire adventure', category: 'story' },
  { id: 'five_complete',        emoji: '🌟', name: 'Adventure Master',    description: 'Complete 5 full adventures', category: 'story' },
  { id: 'long_adventure',       emoji: '📕', name: 'Epic Journey',        description: 'Complete an adventure with 5+ chapters', category: 'story' },

  // ── Reading level exploration ──
  { id: 'level_explorer',       emoji: '🗺️', name: 'Level Explorer',      description: 'Try stories at 3 different reading levels', category: 'mastery' },
  { id: 'level_master',         emoji: '🎓', name: 'Level Master',        description: 'Try stories at every reading level', category: 'mastery' },
];

const TROPHY_MAP = new Map(ALL_TROPHIES.map((t) => [t.id, t]));

export function getTrophy(id: string): Trophy | undefined {
  return TROPHY_MAP.get(id);
}

/**
 * Returns the IDs of trophies newly earned after this session.
 * Already-earned trophies (from `earnedIds`) are excluded.
 *
 * @param storyStats Optional story library stats for story-related trophies.
 */
export function computeNewTrophies(
  progress: UserProgress,
  earnedIds: Set<string>,
  storyStats?: StoryStats,
): string[] {
  const newIds: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !earnedIds.has(id)) newIds.push(id);
  };

  const sessionCount = progress.sessionCount;
  const latestSession = progress.latestSession;

  // ── Session count milestones ──
  check('first_read',           sessionCount >= 1);
  check('five_sessions',        sessionCount >= 5);
  check('ten_sessions',         sessionCount >= 10);
  check('twenty_five_sessions', sessionCount >= 25);
  check('fifty_sessions',       sessionCount >= 50);

  // ── Score-based (latest session) ──
  if (latestSession) {
    check('score_50',          latestSession.score >= 50);
    check('score_75',          latestSession.score >= 75);
    check('score_90',          latestSession.score >= 90);
    check('score_100',         latestSession.score === 100);
    check('perfect_accuracy',  latestSession.accuracy === 100);
    check('five_stars',        latestSession.stars === 5);
    check('hard_words_3',      latestSession.hardWordCorrect >= 3);
    check('hard_words_10',     latestSession.hardWordCorrect >= 10);
    check('big_session',       latestSession.wordCount >= 50 && latestSession.score >= 80);
  }

  // ── Practice word milestones ──
  if (progress.practiceClearedCount > 0) {
    check('practice_cleared', true);
  }
  check('ten_cleared',          progress.practiceClearedCount >= 10);
  check('twenty_five_cleared',  progress.practiceClearedCount >= 25);

  // ── Reading volume ──
  check('words_500',  progress.totalWordsRead >= 500);
  check('words_1000', progress.totalWordsRead >= 1000);
  check('words_5000', progress.totalWordsRead >= 5000);

  // ── Unique reading days ──
  const uniqueDays = new Set(progress.sessionDates).size;
  check('streak_3',  uniqueDays >= 3);
  check('streak_7',  uniqueDays >= 7);
  check('streak_14', uniqueDays >= 14);
  check('streak_30', uniqueDays >= 30);

  // ── Consecutive weeks ──
  check('weeks_2', progress.consecutiveWeeks >= 2);
  check('weeks_4', progress.consecutiveWeeks >= 4);
  check('weeks_8', progress.consecutiveWeeks >= 8);

  // ── Story / Adventure trophies ──
  if (storyStats) {
    check('first_story',    storyStats.storiesCreated >= 1);
    check('five_stories',   storyStats.storiesCreated >= 5);
    check('ten_stories',    storyStats.storiesCreated >= 10);
    check('story_finisher', storyStats.storiesCompleted >= 1);
    check('five_complete',  storyStats.storiesCompleted >= 5);
    check('long_adventure', storyStats.longestAdventure >= 5);

    // Reading level exploration
    check('level_explorer', storyStats.readingLevelsUsed.length >= 3);
    check('level_master',   storyStats.readingLevelsUsed.length >= readingLevels.length);
  }

  return newIds;
}
