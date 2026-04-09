import React, { useState } from 'react';

interface StoryPromptScreenProps {
  readingLevel: string;
  levelEmoji: string;
  levelLabel: string;
  onStart: (prompt: string) => void;
  onBack: () => void;
}

const THEMES = [
  { emoji: '🏴‍☠️', label: 'Pirates', prompt: 'A brave young pirate searching for hidden treasure' },
  { emoji: '🚀', label: 'Space', prompt: 'An astronaut kid exploring a mysterious planet' },
  { emoji: '🧙', label: 'Magic', prompt: 'A young wizard discovering a secret spell book' },
  { emoji: '🦕', label: 'Dinosaurs', prompt: 'A time traveler who lands in the age of dinosaurs' },
  { emoji: '🧜‍♀️', label: 'Ocean', prompt: 'A mermaid who finds a secret underwater city' },
  { emoji: '🐉', label: 'Dragons', prompt: 'A kid who befriends a baby dragon' },
  { emoji: '🕵️', label: 'Mystery', prompt: 'A young detective solving a puzzle in a spooky mansion' },
  { emoji: '🦸', label: 'Superheroes', prompt: 'A kid who discovers they have a secret superpower' },
];

const StoryPromptScreen: React.FC<StoryPromptScreenProps> = ({
  readingLevel,
  levelEmoji,
  levelLabel,
  onStart,
  onBack,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleTheme = (themePrompt: string) => {
    setPrompt(themePrompt);
  };

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (trimmed) onStart(trimmed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-6 md:p-10 pt-8">
      <div className="max-w-lg md:max-w-2xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="text-indigo-500 font-medium text-sm md:text-base mb-4"
        >
          ← Back
        </button>

        <h2 className="text-2xl md:text-3xl font-bold text-purple-700 mb-1">
          🗺️ Create Your Own Story
        </h2>
        <p className="text-gray-400 text-sm md:text-base mb-2">
          Reading level: {levelEmoji} {levelLabel} (Grade {readingLevel})
        </p>
        <p className="text-gray-500 text-sm md:text-base mb-5">
          Pick a theme or type your own adventure idea!
        </p>

        {/* Theme quick-picks */}
        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-5">
          {THEMES.map((theme) => (
            <button
              key={theme.label}
              type="button"
              onClick={() => handleTheme(theme.prompt)}
              className={`flex flex-col items-center gap-1 py-3 md:py-4 px-1 rounded-2xl border transition-colors
                ${prompt === theme.prompt
                  ? 'bg-purple-100 border-purple-300 shadow-sm'
                  : 'bg-white border-gray-100 shadow-sm active:bg-purple-50 active:border-purple-200'
                }`}
            >
              <span className="text-2xl md:text-3xl">{theme.emoji}</span>
              <span className="text-xs md:text-sm font-semibold text-gray-600">{theme.label}</span>
            </button>
          ))}
        </div>

        {/* Custom prompt input */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A dog who learns to fly and saves the day..."
          rows={3}
          className="w-full rounded-2xl border border-gray-200 p-4 md:p-5 text-base md:text-lg
                     focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300
                     placeholder:text-gray-300 resize-none mb-4"
        />

        {/* Start button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className={`w-full py-4 md:py-5 rounded-2xl font-bold text-xl md:text-2xl transition-all shadow-md
            ${prompt.trim()
              ? 'bg-purple-600 text-white active:bg-purple-700 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          🗺️ Begin Adventure!
        </button>
      </div>
    </div>
  );
};

export default StoryPromptScreen;
