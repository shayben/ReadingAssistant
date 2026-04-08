import React, { useEffect, useState, useCallback, useRef } from 'react';
import { splitSyllables } from '../services/syllableService';
import { translateToHebrew } from '../services/translationService';
import { speakWord } from '../services/speechService';
import type { WordTiming } from './ReadingSession';

interface WordPopupProps {
  word: string;
  recordingBlob: Blob | null;
  timing?: WordTiming;
  onClose: () => void;
}

const WordPopup: React.FC<WordPopupProps> = ({ word, recordingBlob, timing, onClose }) => {
  const cleanWord = word.replace(/[^a-zA-Z']/g, '');
  const syllables = splitSyllables(cleanWord);
  const [hebrew, setHebrew] = useState<string | null>(null);
  const [translating, setTranslating] = useState(true);
  const [playingBack, setPlayingBack] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

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

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasRecording = !!recordingBlob && !!timing && timing.durationSec > 0;

  const handlePlayRecording = useCallback(() => {
    if (!recordingBlob || !timing) return;

    // Clean up previous playback
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const url = URL.createObjectURL(recordingBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingBack(true);

    // Add a small buffer around the word for natural-sounding playback
    const buffer = 0.15;
    const startTime = Math.max(0, timing.offsetSec - buffer);
    const playDuration = timing.durationSec + buffer * 2;

    audio.currentTime = startTime;
    audio.play().catch(() => setPlayingBack(false));

    timerRef.current = window.setTimeout(() => {
      audio.pause();
      setPlayingBack(false);
      URL.revokeObjectURL(url);
    }, playDuration * 1000);

    audio.onended = () => {
      setPlayingBack(false);
      URL.revokeObjectURL(url);
    };
  }, [recordingBlob, timing]);

  const handlePlayCorrect = useCallback(() => {
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
                <span className="text-2xl font-semibold px-2 py-1 text-gray-700">
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
            {hasRecording && (
              <button
                type="button"
                onClick={handlePlayRecording}
                disabled={playingBack}
                className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-colors shadow-sm ${
                  playingBack
                    ? 'bg-amber-300 text-amber-700'
                    : 'bg-amber-400 text-amber-900 active:bg-amber-500'
                }`}
              >
                {playingBack ? '🔊 Playing…' : '🎙️ How I Said It'}
              </button>
            )}
            <button
              type="button"
              onClick={handlePlayCorrect}
              className={`${hasRecording ? 'flex-1' : 'w-full'} py-3 rounded-2xl bg-indigo-500 text-white font-bold text-lg
                         active:bg-indigo-600 transition-colors shadow-sm`}
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
