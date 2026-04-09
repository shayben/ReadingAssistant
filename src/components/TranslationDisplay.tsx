/**
 * TranslationDisplay — shows the translated word with loading state.
 */

import React from 'react';
import type { WordTranslationMap } from '../services/translationService';

interface TranslationDisplayProps {
  word: string;
  translationMap?: WordTranslationMap;
  textDir?: 'ltr' | 'rtl';
}

const TranslationDisplay: React.FC<TranslationDisplayProps> = ({ word, translationMap, textDir = 'rtl' }) => {
  const cleanWord = word.replace(/[^a-zA-Z']/g, '');
  const translated = translationMap?.get(cleanWord.toLowerCase()) ?? null;
  const translating = translationMap !== undefined && translationMap.size === 0;

  return (
    <div className="mb-3 md:mb-4 min-h-7">
      {translating ? (
        <span className="text-gray-400 text-sm md:text-base">Translating…</span>
      ) : translated ? (
        <span className="text-xl md:text-2xl font-medium text-gray-600" dir={textDir}>{translated}</span>
      ) : null}
    </div>
  );
};

export default TranslationDisplay;
