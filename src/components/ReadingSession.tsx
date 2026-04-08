import React, { useEffect, useRef, useState, useCallback } from 'react';
import WordCard from './WordCard';
import type { WordStatus } from './WordCard';
import { startPronunciationAssessment, speakWord } from '../services/speechService';
import type { WordResult } from '../services/speechService';

interface ReadingSessionProps {
  text: string;
  onReset: () => void;
}

/** Tokenise text into words, stripping punctuation for matching but keeping display form. */
function tokenise(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

/** Strip punctuation and lowercase a word for comparison. */
function normalise(word: string): string {
  return word.replace(/[^a-zA-Z0-9']/g, '').toLowerCase();
}

const ReadingSession: React.FC<ReadingSessionProps> = ({ text, onReset }) => {
  const words = tokenise(text);

  // Map from word index → status
  const [statuses, setStatuses] = useState<Record<number, WordStatus>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [listening, setListening] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopRef = useRef<(() => void) | null>(null);

  // Build a lookup: normalised word → array of indices (handles repeated words)
  const wordIndexMap = useRef<Record<string, number[]>>({});
  useEffect(() => {
    const map: Record<string, number[]> = {};
    words.forEach((w, i) => {
      const key = normalise(w);
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    wordIndexMap.current = map;
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which occurrence of each word we've matched so far
  const matchPointer = useRef<Record<string, number>>({});

  const handleWordResult = useCallback((result: WordResult) => {
    const key = normalise(result.word);
    const indices = wordIndexMap.current[key];
    if (!indices) return;

    const pointer = matchPointer.current[key] ?? 0;
    const idx = indices[pointer];
    if (idx === undefined) return;

    matchPointer.current[key] = pointer + 1;

    const status: WordStatus =
      result.errorType === 'None' || result.accuracyScore >= 70 ? 'correct' : 'mispronounced';

    setStatuses((prev) => ({ ...prev, [idx]: status }));
    setScores((prev) => ({ ...prev, [idx]: result.accuracyScore }));
  }, []);

  const handleDone = useCallback(() => {
    setListening(false);
    setSessionDone(true);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setSessionDone(false);
    setStatuses({});
    setScores({});
    matchPointer.current = {};

    try {
      const stop = startPronunciationAssessment(
        text,
        handleWordResult,
        handleDone,
        handleError,
      );
      stopRef.current = stop;
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [text, handleWordResult, handleDone, handleError]);

  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  const handleWordClick = useCallback((word: string) => {
    speakWord(normalise(word));
  }, []);

  // Summary counts
  const correctCount = Object.values(statuses).filter((s) => s === 'correct').length;
  const mispronouncedCount = Object.values(statuses).filter((s) => s === 'mispronounced').length;
  const totalScored = correctCount + mispronouncedCount;
  const overallScore = totalScored > 0 ? Math.round((correctCount / totalScored) * 100) : null;

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto p-4">
      <h2 className="text-2xl font-bold text-indigo-700 text-center">📚 Reading Session</h2>

      <p className="text-gray-500 text-xs text-center">
        Tap a word any time to hear how it's pronounced.
        Green = correct · Red = needs practice · Yellow = skipped
      </p>

      {/* Word grid */}
      <div className="flex flex-wrap justify-start bg-gray-50 rounded-2xl p-3 shadow-inner min-h-32">
        {words.map((word, i) => (
          <WordCard
            key={i}
            word={word}
            status={statuses[i] ?? 'pending'}
            score={scores[i]}
            onClick={handleWordClick}
          />
        ))}
      </div>

      {/* Score bar */}
      {overallScore !== null && (
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              overallScore >= 80 ? 'bg-green-500' : overallScore >= 50 ? 'bg-yellow-400' : 'bg-red-500'
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
      )}

      {overallScore !== null && (
        <p className="text-center text-sm text-gray-600">
          Score: <strong className="text-indigo-700">{overallScore}%</strong>
          {' '}({correctCount} correct, {mispronouncedCount} to practice)
        </p>
      )}

      {error && (
        <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl p-3">{error}</p>
      )}

      {sessionDone && !error && (
        <div className="text-center bg-indigo-50 rounded-xl p-3">
          <p className="text-indigo-700 font-semibold">
            {overallScore !== null && overallScore >= 80
              ? '🎉 Great job! Keep it up!'
              : '👍 Session complete. Keep practising!'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!listening ? (
          <button
            type="button"
            onClick={startListening}
            className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold text-lg
                       active:bg-green-600 transition-colors shadow"
          >
            🎤 {sessionDone ? 'Try Again' : 'Start Reading'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopListening}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-lg
                       active:bg-red-600 transition-colors shadow animate-pulse"
          >
            ⏹ Stop Recording
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold text-lg
                     active:bg-gray-300 transition-colors"
        >
          🔄 New Assignment
        </button>
      </div>

      <div className="text-center">
        <p className="text-gray-400 text-xs">Tap any word to hear its correct pronunciation</p>
      </div>
    </div>
  );
};

export default ReadingSession;
