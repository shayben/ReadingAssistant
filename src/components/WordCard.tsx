import React from 'react';

export type WordStatus = 'pending' | 'correct' | 'mispronounced' | 'skipped';

interface WordCardProps {
  word: string;
  index: number;
  status: WordStatus;
  /** True when this is the next word the child should read. */
  isNext?: boolean;
  /** Accuracy score 0–100, displayed as a tooltip. */
  score?: number;
  onClick: (word: string, index: number) => void;
}

const statusClasses: Record<WordStatus, string> = {
  pending: 'text-gray-800',
  correct: 'text-green-600 bg-green-50 rounded',
  mispronounced: 'text-red-600 bg-red-50 rounded',
  skipped: 'text-yellow-600 bg-yellow-50 rounded',
};

const WordCard: React.FC<WordCardProps> = ({ word, index, status, isNext, score, onClick }) => {
  return (
    <span
      role="button"
      tabIndex={0}
      title={score !== undefined ? `Score: ${Math.round(score)}` : 'Tap to hear pronunciation'}
      onClick={() => onClick(word, index)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(word, index); }}
      className={`
        cursor-pointer select-none transition-colors duration-200
        hover:bg-indigo-50 hover:rounded px-0.5
        ${isNext ? 'animate-next-word rounded px-1 font-semibold underline decoration-2 decoration-indigo-400' : ''}
        ${statusClasses[status]}
      `}
    >
      {word}
    </span>
  );
};

export default WordCard;

