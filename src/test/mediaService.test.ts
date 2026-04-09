import { describe, it, expect } from 'vitest';
import { deriveStoryTheme } from '../services/mediaService';
import type { KeyMoment } from '../services/momentsService';

function makeMoment(overrides: Partial<KeyMoment> = {}): KeyMoment {
  return {
    wordIndex: 0,
    triggerWord: 'test',
    type: 'both',
    caption: 'A test moment',
    ...overrides,
  };
}

describe('deriveStoryTheme', () => {
  it('returns null for empty moments array', () => {
    expect(deriveStoryTheme([])).toBeNull();
  });

  it('returns null when no moments have musicCategory', () => {
    const moments = [
      makeMoment({ type: 'image' }),
      makeMoment({ type: 'image', wordIndex: 5 }),
    ];
    expect(deriveStoryTheme(moments)).toBeNull();
  });

  it('returns the single category when only one is present', () => {
    const moments = [
      makeMoment({ musicCategory: 'adventure' }),
    ];
    expect(deriveStoryTheme(moments)).toBe('adventure');
  });

  it('returns the most frequent category', () => {
    const moments = [
      makeMoment({ musicCategory: 'nature', wordIndex: 0 }),
      makeMoment({ musicCategory: 'adventure', wordIndex: 5 }),
      makeMoment({ musicCategory: 'nature', wordIndex: 10 }),
      makeMoment({ musicCategory: 'nature', wordIndex: 15 }),
      makeMoment({ musicCategory: 'adventure', wordIndex: 20 }),
    ];
    expect(deriveStoryTheme(moments)).toBe('nature');
  });

  it('ignores empty string categories', () => {
    const moments = [
      makeMoment({ musicCategory: '', wordIndex: 0 }),
      makeMoment({ musicCategory: '', wordIndex: 5 }),
      makeMoment({ musicCategory: 'peaceful', wordIndex: 10 }),
    ];
    expect(deriveStoryTheme(moments)).toBe('peaceful');
  });

  it('picks one when categories are tied', () => {
    const moments = [
      makeMoment({ musicCategory: 'dramatic', wordIndex: 0 }),
      makeMoment({ musicCategory: 'mysterious', wordIndex: 5 }),
    ];
    const result = deriveStoryTheme(moments);
    expect(['dramatic', 'mysterious']).toContain(result);
  });
});
