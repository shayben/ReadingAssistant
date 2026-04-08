import React from 'react';

export type WordStatus = 'pending' | 'correct' | 'mispronounced' | 'skipped';

interface WordCardProps {
  word: string;
  status: WordStatus;
  /** Accuracy score 0–100, displayed as a tooltip. */
  score?: number;
  onClick: (word: string) => void;
}

const statusClasses: Record<WordStatus, string> = {
  pending: 'bg-white text-gray-800 border-gray-200',
  correct: 'bg-green-100 text-green-800 border-green-300',
  mispronounced: 'bg-red-100 text-red-800 border-red-300',
  skipped: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const WordCard: React.FC<WordCardProps> = ({ word, status, score, onClick }) => {
  return (
    <button
      type="button"
      title={score !== undefined ? `Score: ${Math.round(score)}` : 'Tap to hear pronunciation'}
      onClick={() => onClick(word)}
      className={`
        m-1 px-3 py-1 rounded-lg border-2 text-base font-medium
        transition-colors duration-200 cursor-pointer select-none
        active:scale-95 touch-manipulation
        ${statusClasses[status]}
      `}
    >
      {word}
    </button>
  );
};

export default WordCard;
