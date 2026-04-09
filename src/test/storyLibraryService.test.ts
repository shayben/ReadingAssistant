import { describe, it, expect, beforeEach } from 'vitest';
import {
  createStory,
  updateStory,
  getStories,
  getStory,
  deleteStory,
  getStoryStats,
} from '../services/storyLibraryService';
import type { StickerRegistryEntry } from '../services/stickerService';

const STORAGE_KEY = 'wizbit:story-library';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('createStory', () => {
  it('creates a story with generated id and timestamps', () => {
    const story = createStory({
      prompt: 'A brave knight',
      readingLevel: '3',
      levelEmoji: '⚔️',
      chapters: [],
      storyContext: { prompt: 'A brave knight', readingLevel: '3', chapters: [] },
      completed: false,
    });

    expect(story.id).toMatch(/^story_/);
    expect(story.createdAt).toBeTruthy();
    expect(story.updatedAt).toBeTruthy();
    expect(story.prompt).toBe('A brave knight');
  });

  it('persists to localStorage', () => {
    createStory({
      prompt: 'Dragon story',
      readingLevel: '4',
      levelEmoji: '🐉',
      chapters: [],
      storyContext: { prompt: 'Dragon story', readingLevel: '4', chapters: [] },
      completed: false,
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].prompt).toBe('Dragon story');
  });
});

describe('updateStory', () => {
  it('updates chapters and storyContext', () => {
    const story = createStory({
      prompt: 'Test',
      readingLevel: '2',
      levelEmoji: '📖',
      chapters: [],
      storyContext: { prompt: 'Test', readingLevel: '2', chapters: [] },
      completed: false,
    });

    updateStory(story.id, {
      chapters: [{ number: 1, title: 'Ch 1', text: 'Once upon a time...', choiceMade: 'Go left' }],
      completed: false,
    });

    const updated = getStory(story.id);
    expect(updated?.chapters).toHaveLength(1);
    expect(updated?.chapters[0].title).toBe('Ch 1');
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(story.updatedAt).getTime());
  });

  it('persists stickerRegistry', () => {
    const story = createStory({
      prompt: 'Sticker test',
      readingLevel: '3',
      levelEmoji: '🖼️',
      chapters: [],
      storyContext: { prompt: 'Sticker test', readingLevel: '3', chapters: [] },
      completed: false,
    });

    const registry: StickerRegistryEntry[] = [
      { label: 'brave knight', url: 'knight.png', source: 'generated', stickerPrompt: 'a brave knight' },
      { label: 'enchanted forest', emoji: '🌲', source: 'emoji' },
    ];

    updateStory(story.id, { stickerRegistry: registry });

    const updated = getStory(story.id);
    expect(updated?.stickerRegistry).toHaveLength(2);
    expect(updated?.stickerRegistry?.[0].label).toBe('brave knight');
    expect(updated?.stickerRegistry?.[1].source).toBe('emoji');
  });

  it('ignores update for non-existent story', () => {
    updateStory('nonexistent', { completed: true });
    expect(getStories()).toHaveLength(0);
  });
});

describe('getStories', () => {
  it('returns stories sorted newest first', () => {
    // Insert directly with controlled timestamps for deterministic ordering
    const raw = [
      {
        id: 'story_old', prompt: 'First', readingLevel: '1', levelEmoji: '🔤',
        chapters: [], storyContext: { prompt: 'First', readingLevel: '1', chapters: [] },
        completed: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'story_new', prompt: 'Second', readingLevel: '2', levelEmoji: '📖',
        chapters: [], storyContext: { prompt: 'Second', readingLevel: '2', chapters: [] },
        completed: false, createdAt: '2024-06-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z',
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const stories = getStories();
    expect(stories).toHaveLength(2);
    expect(stories[0].id).toBe('story_new');
    expect(stories[1].id).toBe('story_old');
  });

  it('returns empty array when none exist', () => {
    expect(getStories()).toEqual([]);
  });
});

describe('deleteStory', () => {
  it('removes the story by id', () => {
    const story = createStory({
      prompt: 'Delete me',
      readingLevel: '1',
      levelEmoji: '🗑️',
      chapters: [],
      storyContext: { prompt: 'Delete me', readingLevel: '1', chapters: [] },
      completed: true,
    });

    deleteStory(story.id);
    expect(getStory(story.id)).toBeUndefined();
    expect(getStories()).toHaveLength(0);
  });

  it('does nothing for non-existent id', () => {
    createStory({
      prompt: 'Keep me',
      readingLevel: '1',
      levelEmoji: '✅',
      chapters: [],
      storyContext: { prompt: 'Keep me', readingLevel: '1', chapters: [] },
      completed: false,
    });

    deleteStory('nonexistent');
    expect(getStories()).toHaveLength(1);
  });
});

describe('getStoryStats', () => {
  it('returns zeroes when no stories', () => {
    const stats = getStoryStats();
    expect(stats.storiesCreated).toBe(0);
    expect(stats.storiesCompleted).toBe(0);
    expect(stats.readingLevelsUsed).toEqual([]);
    expect(stats.longestAdventure).toBe(0);
  });

  it('counts created and completed stories', () => {
    createStory({
      prompt: 'A',
      readingLevel: '3',
      levelEmoji: '📕',
      chapters: [{ number: 1, title: 'Ch1', text: 'text', choiceMade: '' }],
      storyContext: { prompt: 'A', readingLevel: '3', chapters: [] },
      completed: true,
    });
    createStory({
      prompt: 'B',
      readingLevel: '4',
      levelEmoji: '📗',
      chapters: [],
      storyContext: { prompt: 'B', readingLevel: '4', chapters: [] },
      completed: false,
    });

    const stats = getStoryStats();
    expect(stats.storiesCreated).toBe(2);
    expect(stats.storiesCompleted).toBe(1);
    expect(stats.readingLevelsUsed).toContain('3');
    expect(stats.readingLevelsUsed).toContain('4');
  });

  it('tracks longest adventure from completed stories', () => {
    createStory({
      prompt: 'Long',
      readingLevel: '3',
      levelEmoji: '📖',
      chapters: [
        { number: 1, title: 'Ch1', text: 'a', choiceMade: 'go' },
        { number: 2, title: 'Ch2', text: 'b', choiceMade: 'run' },
        { number: 3, title: 'Ch3', text: 'c', choiceMade: '(ending)' },
      ],
      storyContext: { prompt: 'Long', readingLevel: '3', chapters: [] },
      completed: true,
    });

    expect(getStoryStats().longestAdventure).toBe(3);
  });
});
