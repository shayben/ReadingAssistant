import { describe, it, expect } from 'vitest';
import {
  serializeRegistry,
  deserializeRegistry,
  type StickerRegistry,
  type StickerRegistryEntry,
} from '../services/stickerService';

describe('serializeRegistry', () => {
  it('returns empty array for empty registry', () => {
    const registry: StickerRegistry = new Map();
    expect(serializeRegistry(registry)).toEqual([]);
  });

  it('serializes all entries', () => {
    const registry: StickerRegistry = new Map();
    registry.set('brave knight', {
      label: 'Brave Knight',
      url: 'https://example.com/knight.png',
      source: 'generated',
      stickerPrompt: 'a brave knight',
    });
    registry.set('enchanted forest', {
      label: 'Enchanted Forest',
      emoji: '🌲',
      source: 'emoji',
    });

    const result = serializeRegistry(registry);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Brave Knight');
    expect(result[1].label).toBe('Enchanted Forest');
  });
});

describe('deserializeRegistry', () => {
  it('returns empty map for empty array', () => {
    const registry = deserializeRegistry([]);
    expect(registry.size).toBe(0);
  });

  it('normalizes keys to lowercase trimmed', () => {
    const entries: StickerRegistryEntry[] = [
      { label: '  Brave Knight  ', url: 'https://example.com/knight.png', source: 'generated' },
      { label: 'ENCHANTED FOREST', emoji: '🌲', source: 'emoji' },
    ];
    const registry = deserializeRegistry(entries);
    expect(registry.has('brave knight')).toBe(true);
    expect(registry.has('enchanted forest')).toBe(true);
    expect(registry.has('Brave Knight')).toBe(false);
  });

  it('preserves all entry fields', () => {
    const entries: StickerRegistryEntry[] = [
      { label: 'dragon', url: 'https://img.com/d.png', source: 'wikipedia', stickerPrompt: 'a dragon' },
    ];
    const registry = deserializeRegistry(entries);
    const entry = registry.get('dragon')!;
    expect(entry.label).toBe('dragon');
    expect(entry.url).toBe('https://img.com/d.png');
    expect(entry.source).toBe('wikipedia');
    expect(entry.stickerPrompt).toBe('a dragon');
  });

  it('roundtrips with serializeRegistry', () => {
    const original: StickerRegistryEntry[] = [
      { label: 'Cat', url: 'cat.png', source: 'bundled' },
      { label: 'Dog', emoji: '🐕', source: 'emoji' },
    ];
    const registry = deserializeRegistry(original);
    const serialized = serializeRegistry(registry);

    expect(serialized).toHaveLength(2);
    expect(serialized.find((e) => e.label === 'Cat')?.url).toBe('cat.png');
    expect(serialized.find((e) => e.label === 'Dog')?.emoji).toBe('🐕');
  });
});
