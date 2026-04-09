/**
 * SyllableBreakdown — displays syllable-by-syllable accuracy scores.
 */

import React, { useMemo } from 'react';
import { splitSyllables } from '../services/syllableService';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function scoreEmoji(score: number): string {
  if (score >= 80) return '✅';
  if (score >= 50) return '🔶';
  return '❌';
}

/**
 * Distribute phoneme scores across syllables proportionally by character count.
 */
function syllableScores(syllables: string[], phonemeScores: number[]): number[] {
  if (phonemeScores.length === 0) return [];

  const totalChars = syllables.reduce((s, syl) => s + syl.length, 0);
  const scores: number[] = [];
  let phonemeIdx = 0;

  for (const syl of syllables) {
    const share = (syl.length / totalChars) * phonemeScores.length;
    const count = Math.max(1, Math.round(share));
    const slice = phonemeScores.slice(phonemeIdx, phonemeIdx + count);
    phonemeIdx += count;
    const avg = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    scores.push(Math.round(avg));
  }

  if (phonemeIdx < phonemeScores.length) {
    const remaining = phonemeScores.slice(phonemeIdx);
    const last = scores[scores.length - 1];
    const combined = [...remaining, last];
    scores[scores.length - 1] = Math.round(combined.reduce((a, b) => a + b, 0) / combined.length);
  }

  return scores;
}

interface SyllableBreakdownProps {
  word: string;
  phonemeScores: number[];
}

const SyllableBreakdown: React.FC<SyllableBreakdownProps> = ({ word, phonemeScores }) => {
  const cleanWord = word.replace(/[^a-zA-Z']/g, '');
  const syllables = splitSyllables(cleanWord);

  const sylScores = useMemo(
    () => syllableScores(syllables, phonemeScores),
    [syllables, phonemeScores],
  );
  const hasAssessment = sylScores.length > 0;

  return (
    <div className="mb-3 md:mb-4">
      <div className="flex items-center gap-1 md:gap-2 flex-wrap">
        {syllables.map((syl, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-300 text-lg md:text-xl mx-0.5">·</span>}
            <span
              className={`text-xl md:text-2xl font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                hasAssessment ? scoreColor(sylScores[i]) : 'text-gray-700'
              }`}
            >
              {syl}
            </span>
          </React.Fragment>
        ))}
      </div>

      {hasAssessment && (
        <div className="flex items-center gap-1 md:gap-2 mt-1.5 flex-wrap">
          {syllables.map((_syl, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="w-4" />}
              <span className="text-xs md:text-sm font-medium text-gray-500 text-center min-w-7">
                {scoreEmoji(sylScores[i])} {sylScores[i]}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyllableBreakdown;
