/**
 * Syllable-splitting utility.
 *
 * Splits an English word into an array of syllable strings using a
 * vowel-group heuristic improved with an exception dictionary,
 * consonant digraph awareness, and better silent-e handling.
 */

const VOWELS = /[aeiouy]/i;
const VOWEL_GROUP = /[aeiouy]+/gi;

/** Consonant clusters that should not be split. */
const DIGRAPHS = new Set(['sh', 'ch', 'th', 'ph', 'wh', 'ck', 'ng', 'nk', 'gh', 'gn', 'kn', 'wr', 'qu']);

/** Common words where the heuristic fails. */
const EXCEPTIONS: Record<string, string[]> = {
  the: ['the'], people: ['peo', 'ple'], every: ['ev', 'ery'],
  little: ['lit', 'tle'], beautiful: ['beau', 'ti', 'ful'],
  because: ['be', 'cause'], different: ['dif', 'fer', 'ent'],
  important: ['im', 'por', 'tant'], together: ['to', 'geth', 'er'],
  children: ['chil', 'dren'], another: ['an', 'oth', 'er'],
  animal: ['an', 'i', 'mal'], chocolate: ['choc', 'late'],
  comfortable: ['com', 'for', 'ta', 'ble'], interesting: ['in', 'ter', 'est', 'ing'],
  family: ['fam', 'i', 'ly'], favorite: ['fa', 'vor', 'ite'],
  elephant: ['el', 'e', 'phant'], crocodile: ['croc', 'o', 'dile'],
  dinosaur: ['di', 'no', 'saur'], butterfly: ['but', 'ter', 'fly'],
  adventure: ['ad', 'ven', 'ture'], incredible: ['in', 'cred', 'i', 'ble'],
  imagine: ['i', 'mag', 'ine'], remember: ['re', 'mem', 'ber'],
  suddenly: ['sud', 'den', 'ly'], wonderful: ['won', 'der', 'ful'],
  something: ['some', 'thing'], nothing: ['noth', 'ing'],
  outside: ['out', 'side'], inside: ['in', 'side'],
  sometimes: ['some', 'times'], everyone: ['ev', 'ery', 'one'],
  everything: ['ev', 'ery', 'thing'], somewhere: ['some', 'where'],
  before: ['be', 'fore'], after: ['af', 'ter'],
  under: ['un', 'der'], over: ['o', 'ver'],
  water: ['wa', 'ter'], river: ['riv', 'er'],
  never: ['nev', 'er'], ever: ['ev', 'er'],
  open: ['o', 'pen'], even: ['e', 'ven'],
  again: ['a', 'gain'], away: ['a', 'way'],
  about: ['a', 'bout'], above: ['a', 'bove'],
  table: ['ta', 'ble'], able: ['a', 'ble'],
  circle: ['cir', 'cle'], purple: ['pur', 'ple'],
  are: ['are'], were: ['were'], there: ['there'], where: ['where'],
  come: ['come'], some: ['some'], done: ['done'], gone: ['gone'],
  give: ['give'], live: ['live'], have: ['have'], love: ['love'],
  move: ['move'], once: ['once'], sure: ['sure'],
};

/**
 * Check if a consonant gap contains a digraph and return a split point
 * that keeps the digraph intact with the following syllable.
 */
function splitConsonantGap(word: string, gapStart: number, gapEnd: number): number {
  const gapLen = gapEnd - gapStart;

  if (gapLen <= 1) return gapStart;

  // Check for digraphs at start or end of gap
  const gapStr = word.slice(gapStart, gapEnd).toLowerCase();

  // If the gap ends with a digraph, keep it with the next syllable
  if (gapLen >= 2 && DIGRAPHS.has(gapStr.slice(-2))) {
    return gapEnd - 2;
  }
  // If the gap starts with a digraph, keep it with the previous syllable
  if (gapLen >= 2 && DIGRAPHS.has(gapStr.slice(0, 2))) {
    return gapStart + 2;
  }

  // Default: split in the middle
  return gapStart + Math.ceil(gapLen / 2);
}

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

  // Check exception dictionary first
  if (EXCEPTIONS[lower]) return EXCEPTIONS[lower];

  // Find vowel-group positions
  const groups: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VOWEL_GROUP.source, 'gi');
  while ((m = re.exec(lower)) !== null) {
    groups.push({ start: m.index, end: m.index + m[0].length });
  }

  if (groups.length <= 1) return [word];

  // Handle silent trailing 'e': drop the last vowel group if it's a lone 'e'
  // at the end preceded by a consonant (but not after another 'e')
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

  // Split between vowel groups with digraph-aware consonant splitting
  const syllables: string[] = [];
  let cursor = 0;

  for (let i = 0; i < groups.length - 1; i++) {
    const gapStart = groups[i].end;
    const gapEnd = groups[i + 1].start;
    const splitAt = splitConsonantGap(lower, gapStart, gapEnd);

    syllables.push(word.slice(cursor, splitAt));
    cursor = splitAt;
  }

  syllables.push(word.slice(cursor));

  return syllables.filter(Boolean);
}
