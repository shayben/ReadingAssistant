import React, { useState } from 'react';
import type { StoryChoice } from '../services/storyService';

interface ChapterChoicesProps {
  chapterNumber: number;
  chapterTitle: string;
  choices: StoryChoice[];
  onChoose: (choiceText: string) => void;
}

const ChapterChoices: React.FC<ChapterChoicesProps> = ({
  chapterNumber,
  chapterTitle,
  choices,
  onChoose,
}) => {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-6 md:p-10 flex flex-col items-center justify-center">
      <div className="max-w-lg md:max-w-2xl w-full">
        {/* Chapter badge */}
        <div className="text-center mb-6">
          <span className="inline-block bg-purple-100 text-purple-700 text-sm md:text-base font-bold px-4 py-1.5 rounded-full mb-2">
            Chapter {chapterNumber} complete ✓
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-purple-700">{chapterTitle}</h2>
        </div>

        <p className="text-center text-gray-600 text-lg md:text-xl font-medium mb-6">
          What happens next? 🤔
        </p>

        {/* Choice buttons */}
        <div className="flex flex-col gap-3 md:gap-4 mb-5">
          {choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChoose(choice.text)}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm
                         p-4 md:p-5 active:bg-purple-50 active:border-purple-200 transition-colors
                         flex items-center gap-3"
            >
              <span className="text-3xl md:text-4xl shrink-0">{choice.emoji}</span>
              <span className="text-base md:text-lg font-medium text-gray-700">{choice.text}</span>
            </button>
          ))}
        </div>

        {/* Custom idea */}
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="w-full text-center text-purple-500 text-sm md:text-base font-medium py-2
                       active:text-purple-700 transition-colors"
          >
            ✏️ Or type your own idea…
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Type what happens next..."
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-base md:text-lg
                         focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300
                         placeholder:text-gray-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && custom.trim()) onChoose(custom.trim());
              }}
            />
            <button
              type="button"
              onClick={() => { if (custom.trim()) onChoose(custom.trim()); }}
              disabled={!custom.trim()}
              className={`px-5 py-3 rounded-2xl font-bold text-base transition-colors
                ${custom.trim()
                  ? 'bg-purple-600 text-white active:bg-purple-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              Go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterChoices;
