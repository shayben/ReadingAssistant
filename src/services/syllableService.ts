/**
 * Syllable-splitting utility.
 *
 * Splits an English word into an array of syllable strings using a
 * vowel-group heuristic. Not linguistically perfect, but good enough
 * for an educational "sound-it-out" display for young readers.
 */

const VOWELS = /[aeiouy]/i;
const VOWEL_GROUP = /[aeiouy]+/gi;

/**
 * Split a word into approximate syllable strings.
 *
 * Examples:
 *   "cat"        → ["cat"]
 *   "happen"     → ["hap", "pen"]
 *   "beautiful"  → ["beau", "ti", "ful"]
 *   "smile"      → ["smile"]
 */
export function splitSyllables(raw: string): string[] {
  const word = raw.replace(/[^a-zA-Z]/g, '');
  if (word.length === 0) return [raw];

  const lower = word.toLowerCase();

  // Find vowel-group positions
  const groups: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VOWEL_GROUP.source, 'gi');
  while ((m = re.exec(lower)) !== null) {
    groups.push({ start: m.index, end: m.index + m[0].length });
  }

  if (groups.length <= 1) return [word];

  // Handle silent trailing 'e'
  if (
    groups.length >= 2 &&
    lower.endsWith('e') &&
    groups[groups.length - 1].end === lower.length &&
    groups[groups.length - 1].end - groups[groups.length - 1].start === 1 &&
    !VOWELS.test(lower.charAt(lower.length - 2))
  ) {
    groups.pop();
    if (groups.length <= 1) return [word];
  }

  // Split between vowel groups — put the split at the midpoint of consonants
  const syllables: string[] = [];
  let cursor = 0;

  for (let i = 0; i < groups.length - 1; i++) {
    const gapStart = groups[i].end;
    const gapEnd = groups[i + 1].start;
    const gapLen = gapEnd - gapStart;

    let splitAt: number;
    if (gapLen <= 1) {
      // Single consonant → goes with next syllable
      splitAt = gapStart;
    } else {
      // Multiple consonants → split in the middle (attach first to prior syllable)
      splitAt = gapStart + Math.ceil(gapLen / 2);
    }

    syllables.push(word.slice(cursor, splitAt));
    cursor = splitAt;
  }

  syllables.push(word.slice(cursor));

  return syllables.filter(Boolean);
}
