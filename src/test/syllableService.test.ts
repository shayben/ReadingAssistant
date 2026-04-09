import { describe, it, expect } from 'vitest';
import { splitSyllables } from '../services/syllableService';

describe('splitSyllables', () => {
  it('keeps single-syllable words whole', () => {
    expect(splitSyllables('cat')).toEqual(['cat']);
    expect(splitSyllables('run')).toEqual(['run']);
  });

  it('splits multi-syllable words', () => {
    expect(splitSyllables('happen')).toEqual(['hap', 'pen']);
  });

  it('handles silent trailing e', () => {
    expect(splitSyllables('smile')).toEqual(['smile']);
    expect(splitSyllables('make')).toEqual(['make']);
  });

  it('returns raw input for non-alpha strings', () => {
    expect(splitSyllables('123')).toEqual(['123']);
    expect(splitSyllables('')).toEqual(['']);
  });

  it('handles words with apostrophes', () => {
    const result = splitSyllables("can't");
    expect(result.length).toBeGreaterThan(0);
  });

  it('uses exception dictionary for common words', () => {
    expect(splitSyllables('beautiful')).toEqual(['beau', 'ti', 'ful']);
    expect(splitSyllables('people')).toEqual(['peo', 'ple']);
    expect(splitSyllables('every')).toEqual(['ev', 'ery']);
    expect(splitSyllables('children')).toEqual(['chil', 'dren']);
  });

  it('handles single-syllable exception words', () => {
    expect(splitSyllables('the')).toEqual(['the']);
    expect(splitSyllables('come')).toEqual(['come']);
    expect(splitSyllables('some')).toEqual(['some']);
    expect(splitSyllables('love')).toEqual(['love']);
  });

  it('is case-insensitive for exception lookups', () => {
    expect(splitSyllables('Beautiful')).toEqual(['beau', 'ti', 'ful']);
  });
});
