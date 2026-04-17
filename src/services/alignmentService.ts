/**
 * Alignment utilities — detect and recover from drift between what Azure
 * Speech is hearing (interim text) and where our reference-text cursor is.
 *
 * Pure helpers: no React / no SDK dependency so they can be unit-tested.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'to', 'of', 'in', 'on', 'at',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its',
  'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my', 'his', 'her', 'their',
  'them', 'this', 'that', 'these', 'those', 'for', 'with', 'as', 'by',
  'from', 'so', 'not', 'no', 'yes', 'do', 'does', 'did', 'has', 'have',
  'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might',
]);

/** Strip punctuation / lowercase / split on whitespace. */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function isDistinctive(token: string): boolean {
  return token.length >= 4 && !STOPWORDS.has(token);
}

export interface AlignmentMatch {
  /** Reference-word index where the match starts. */
  index: number;
  /** Confidence in [0, 1] — weighted token-overlap score of the best candidate. */
  confidence: number;
  /** Gap between the best and second-best candidate scores. */
  margin: number;
  /** True when the best candidate shares at least one distinctive (non-stopword, ≥4-char) token with the reference window. */
  hasDistinctiveMatch: boolean;
}

/**
 * Find the reference-word position that best matches the tail of the interim
 * transcript the speech engine has produced so far.
 *
 * @param interimTail  Raw interim text (unnormalized is fine).
 * @param refWords     The original reference words (with punctuation).
 * @param currentIdx   The cursor position we currently believe the reader is at.
 * @param searchRadius How far on either side of currentIdx to consider.
 * @param minTail      Minimum number of normalized interim tokens required.
 *                     Below this we return no-match — too little signal.
 */
export function findBestReferenceMatch(
  interimTail: string,
  refWords: string[],
  currentIdx: number,
  searchRadius = 40,
  minTail = 4,
): AlignmentMatch | null {
  const interim = normalizeTokens(interimTail);
  if (interim.length < minTail) return null;

  const refNorm = refWords.map((w) => normalizeTokens(w).join(' '));
  if (refNorm.length === 0) return null;

  // Use the last N interim tokens where N == min(interim.length, 10).
  const tailLen = Math.min(interim.length, 10);
  const tail = interim.slice(-tailLen);

  const lo = Math.max(0, currentIdx - searchRadius);
  const hi = Math.min(refNorm.length, currentIdx + searchRadius);

  let best: { index: number; score: number; distinctive: boolean } | null = null;
  let second: { index: number; score: number } | null = null;

  // Each candidate "index" represents the reference position that should align
  // with the LAST interim token. We score the preceding tailLen reference tokens
  // against the interim tail, with recency weighting.
  for (let endIdx = lo; endIdx < hi; endIdx++) {
    const startIdx = endIdx - tailLen + 1;
    if (startIdx < 0) continue;

    let weighted = 0;
    let weightSum = 0;
    let distinctive = false;

    for (let t = 0; t < tailLen; t++) {
      // Weight: more recent (larger t) → higher weight.
      const weight = 1 + t * 0.15;
      weightSum += weight;
      const interimTok = tail[t];
      const refTok = refNorm[startIdx + t];
      if (!interimTok || !refTok) continue;
      if (interimTok === refTok) {
        weighted += weight;
        if (isDistinctive(interimTok)) distinctive = true;
      }
    }

    const score = weightSum > 0 ? weighted / weightSum : 0;
    // The "match index" reported is the position of the LAST interim token +1,
    // i.e. where the reader should read NEXT. This matches how `nextWordIndex`
    // is used throughout the hook.
    const matchNext = endIdx + 1;

    if (!best || score > best.score) {
      if (best) second = { index: best.index, score: best.score };
      best = { index: matchNext, score, distinctive };
    } else if (!second || score > second.score) {
      second = { index: matchNext, score };
    }
  }

  if (!best) return null;

  return {
    index: best.index,
    confidence: best.score,
    margin: best.score - (second?.score ?? 0),
    hasDistinctiveMatch: best.distinctive,
  };
}

export interface RealignDecision {
  /** Whether to actually jump the cursor. */
  shouldRealign: boolean;
  /** The target next-word index if realigning. */
  targetIndex: number;
  /** Direction of the jump (undefined when not realigning). */
  direction?: 'forward' | 'backward';
  /** Why we decided to realign (for diagnostics / `lastRealign`). */
  reason?: string;
  /** Confidence of the matching position (0 when not realigning). */
  confidence: number;
}

export interface RealignInputs {
  match: AlignmentMatch | null;
  currentIdx: number;
  /** One or more suspect signals active? (e.g. omission / low-accuracy / insertion / drift streaks). */
  suspectSignal: boolean;
  /** Optional short reason label from whichever suspect signal fired. */
  suspectReason?: string;
  /** Minimum jump distance to avoid noisy nudges. */
  minJump?: number;
}

const HIGH_CONF = 0.75;
const MED_CONF = 0.55;
const HIGH_MARGIN = 0.2;
const MED_MARGIN = 0.15;

/**
 * Decide whether a match justifies a cursor jump.
 * See plan.md → "Jump thresholds" — matcher confirmation is always required;
 * suspect signals only lower the bar from HIGH to MED.
 */
export function decideRealignment({
  match,
  currentIdx,
  suspectSignal,
  suspectReason,
  minJump = 2,
}: RealignInputs): RealignDecision {
  if (!match || !match.hasDistinctiveMatch) {
    return { shouldRealign: false, targetIndex: currentIdx, confidence: 0 };
  }
  const delta = match.index - currentIdx;
  if (Math.abs(delta) < minJump) {
    return { shouldRealign: false, targetIndex: currentIdx, confidence: match.confidence };
  }

  const highOk = match.confidence >= HIGH_CONF && match.margin >= HIGH_MARGIN;
  const medOk = suspectSignal && match.confidence >= MED_CONF && match.margin >= MED_MARGIN;

  if (!highOk && !medOk) {
    return { shouldRealign: false, targetIndex: currentIdx, confidence: match.confidence };
  }

  return {
    shouldRealign: true,
    targetIndex: match.index,
    direction: delta > 0 ? 'forward' : 'backward',
    reason: highOk ? 'high-confidence match' : `suspect:${suspectReason ?? 'unknown'}`,
    confidence: match.confidence,
  };
}
