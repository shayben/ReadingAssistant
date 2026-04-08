import React, { useEffect, useState, useCallback } from 'react';
import { splitSyllables } from '../services/syllableService';
import { translateToHebrew } from '../services/translationService';
import { speakWord } from '../services/speechService';

interface WordPopupProps {
  word: string;
  onClose: () => void;
}

const WordPopup: React.FC<WordPopupProps> = ({ word, onClose }) => {
  const cleanWord = word.replace(/[^a-zA-Z']/g, '');
  const syllables = splitSyllables(cleanWord);
  const [hebrew, setHebrew] = useState<string | null>(null);
  const [translating, setTranslating] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    translateToHebrew(cleanWord)
      .then((r) => {
        if (!cancelled) setHebrew(r.hebrew);
      })
      .catch(() => {
        if (!cancelled) setHebrew(null);
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => { cancelled = true; };
  }, [cleanWord]);

  const handleSoundOut = useCallback(() => {
    // Play each syllable sequentially with a short gap
    let i = 0;
    const playNext = () => {
      if (i >= syllables.length) {
        setPlayingIndex(null);
        return;
      }
      setPlayingIndex(i);
      speakWord(syllables[i]);
      i++;
      setTimeout(playNext, 700);
    };
    playNext();
  }, [syllables]);

  const handlePlayFull = useCallback(() => {
    speakWord(cleanWord);
  }, [cleanWord]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl p-5 pb-8">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

          {/* Word */}
          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-indigo-700">{cleanWord}</span>
          </div>

          {/* Syllable breakdown */}
          <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
            {syllables.map((syl, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-300 text-xl mx-0.5">·</span>}
                <span
                  className={`text-2xl font-semibold px-2 py-1 rounded-lg transition-colors duration-200 ${
                    playingIndex === i
                      ? 'bg-indigo-100 text-indigo-700 scale-110'
                      : 'text-gray-700'
                  }`}
                >
                  {syl}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Hebrew translation */}
          <div className="text-center mb-5 min-h-8">
            {translating ? (
              <span className="text-gray-400 text-sm">Translating…</span>
            ) : hebrew ? (
              <span className="text-2xl font-medium text-gray-600" dir="rtl">{hebrew}</span>
            ) : null}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSoundOut}
              className="flex-1 py-3 rounded-2xl bg-amber-400 text-amber-900 font-bold text-lg
                         active:bg-amber-500 transition-colors shadow-sm"
            >
              🔤 Sound it Out
            </button>
            <button
              type="button"
              onClick={handlePlayFull}
              className="flex-1 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-lg
                         active:bg-indigo-600 transition-colors shadow-sm"
            >
              🔊 Hear it
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-2 text-gray-400 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default WordPopup;
