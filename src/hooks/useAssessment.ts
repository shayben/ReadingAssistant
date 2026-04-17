/**
 * Hook: manages pronunciation assessment via the Speech SDK.
 * Tracks per-word statuses, scores, timings, and the assessment lifecycle.
 * Detects alignment loss and can auto-realign the cursor.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { WordStatus } from '../types/word';
import { startWindowedPronunciationAssessment } from '../services/speechService';
import type { WordResult, AssessmentResult, RecognizingCallback, InsertionCallback } from '../services/speechService';
import { findBestReferenceMatch, decideRealignment } from '../services/alignmentService';

export interface WordTiming {
  offsetSec: number;
  durationSec: number;
  phonemeScores: number[];
}

export interface RealignEvent {
  fromIdx: number;
  toIdx: number;
  direction: 'forward' | 'backward';
  reason: string;
  confidence: number;
  at: number;
}

interface UseAssessmentOptions {
  words: string[];
  /** Sentence-aligned word groups — each group becomes one recognition window. */
  wordGroups: string[][];
  onSessionDone?: () => void;
}

// Thresholds / tunables for alignment-loss detection. See plan.md.
const OMISSION_STREAK_THRESHOLD = 3;
const LOW_ACC_STREAK_THRESHOLD = 4;
const LOW_ACC_CUTOFF = 40;
const INSERTION_STREAK_THRESHOLD = 2;
const DRIFT_THRESHOLD = 8;
const DRIFT_STALE_FINAL_MS = 1500;
const REALIGN_DEBOUNCE_MS = 2000;
const MIN_RESULTS_BEFORE_DETECTION = 3;
const INTERIM_TAIL_MAX_WORDS = 16;
const INTERIM_MATCH_INTERVAL_MS = 400;

export function useAssessment({ words, wordGroups, onSessionDone }: UseAssessmentOptions) {
  const [statuses, setStatuses] = useState<Record<number, WordStatus>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [wordTimings, setWordTimings] = useState<Record<number, WordTiming>>({});
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fluencyScore, setFluencyScore] = useState<number | undefined>(undefined);
  const [nextWordIndex, setNextWordIndex] = useState(0);
  /** Approximate spoken position from interim (recognizing) events. */
  const [spokenCursor, setSpokenCursor] = useState(0);
  const [alignmentLost, setAlignmentLost] = useState(false);
  const [lastRealign, setLastRealign] = useState<RealignEvent | null>(null);

  const nextWordRef = useRef(0);
  const spokenCursorRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const pausingRef = useRef(false);

  // Alignment detection state
  const generationRef = useRef(0);
  const resultsSeenRef = useRef(0);
  const omissionStreakRef = useRef(0);
  const lowAccStreakRef = useRef(0);
  const insertionStreakRef = useRef(0);
  const lastFinalAtRef = useRef(0);
  const interimTailRef = useRef<string>('');
  const lastInterimMatchAtRef = useRef(0);
  const lastRealignAtRef = useRef(0);
  const manualIndicesRef = useRef<Set<number>>(new Set());
  // Ref-trampoline to break the maybeRealign ↔ realignTo cycle.
  const realignToRef = useRef<(
    newIdx: number,
    direction: 'forward' | 'backward',
    reason: string,
    confidence: number,
  ) => void>(() => {});

  const handleWordResult = useCallback((result: WordResult) => {
    const idx = nextWordRef.current;
    if (idx >= words.length) return;

    const status: WordStatus =
      result.errorType === 'Omission'
        ? 'skipped'
        : result.accuracyScore >= 80
          ? 'correct'
          : result.accuracyScore >= 50
            ? 'average'
            : 'mispronounced';

    setStatuses((prev) => ({ ...prev, [idx]: status }));
    setScores((prev) => ({ ...prev, [idx]: result.accuracyScore }));
    setWordTimings((prev) => ({
      ...prev,
      [idx]: {
        offsetSec: result.offsetSec,
        durationSec: result.durationSec,
        phonemeScores: result.phonemeScores,
      },
    }));

    nextWordRef.current = idx + 1;
    setNextWordIndex(idx + 1);

    // Update detection state
    resultsSeenRef.current += 1;
    lastFinalAtRef.current = Date.now();
    if (result.errorType === 'Omission') {
      omissionStreakRef.current += 1;
    } else {
      omissionStreakRef.current = 0;
    }
    if (result.accuracyScore < LOW_ACC_CUTOFF && result.errorType !== 'Omission') {
      lowAccStreakRef.current += 1;
    } else if (result.errorType !== 'Omission') {
      lowAccStreakRef.current = 0;
    }
  }, [words.length]);

  const handleDoneFactory = useCallback((gen: number) => (result: AssessmentResult) => {
    if (gen !== generationRef.current) return;
    // When pausing, the speech session ends but we don't want to finalize
    if (pausingRef.current) {
      pausingRef.current = false;
      if (result.fluencyScore > 0) setFluencyScore(result.fluencyScore);
      return;
    }
    setFluencyScore(result.fluencyScore > 0 ? result.fluencyScore : undefined);
    setListening(false);
    setSessionDone(true);
    onSessionDone?.();
  }, [onSessionDone]);

  const handleErrorFactory = useCallback((gen: number) => (err: string) => {
    if (gen !== generationRef.current) return;
    setError(err);
    setListening(false);
  }, []);

  /**
   * Tries to detect alignment loss and jump the cursor if confident.
   * Called on interim (recognizing) events.
   */
  const maybeRealign = useCallback(() => {
    const now = Date.now();
    if (resultsSeenRef.current < MIN_RESULTS_BEFORE_DETECTION) return;
    if (now - lastRealignAtRef.current < REALIGN_DEBOUNCE_MS) return;
    if (now - lastInterimMatchAtRef.current < INTERIM_MATCH_INTERVAL_MS) return;
    lastInterimMatchAtRef.current = now;

    const drift = spokenCursorRef.current - nextWordRef.current;
    const staleFinal = now - lastFinalAtRef.current > DRIFT_STALE_FINAL_MS;
    const driftSuspect = drift >= DRIFT_THRESHOLD && staleFinal;
    const omissionSuspect = omissionStreakRef.current >= OMISSION_STREAK_THRESHOLD;
    const lowAccSuspect = lowAccStreakRef.current >= LOW_ACC_STREAK_THRESHOLD;
    const insertionSuspect = insertionStreakRef.current >= INSERTION_STREAK_THRESHOLD;

    const suspectSignal = omissionSuspect || lowAccSuspect || insertionSuspect || driftSuspect;
    const suspectReason = omissionSuspect
      ? 'omission-streak'
      : lowAccSuspect
        ? 'low-accuracy-streak'
        : insertionSuspect
          ? 'insertion-streak'
          : driftSuspect
            ? 'cursor-drift'
            : undefined;

    const match = findBestReferenceMatch(
      interimTailRef.current,
      words,
      nextWordRef.current,
    );

    const decision = decideRealignment({
      match,
      currentIdx: nextWordRef.current,
      suspectSignal,
      suspectReason,
    });

    if (suspectSignal) setAlignmentLost(true);

    if (!decision.shouldRealign || !decision.direction) return;

    // Clamp target to valid range.
    const target = Math.max(0, Math.min(words.length, decision.targetIndex));
    if (target === nextWordRef.current) return;

    realignToRef.current(target, decision.direction, decision.reason ?? 'matcher', decision.confidence);
  }, [words]);

  const handleRecognizingFactory = useCallback((gen: number): RecognizingCallback => (absCount, interimText) => {
    if (gen !== generationRef.current) return;
    const next = Math.max(spokenCursorRef.current, absCount);
    if (next !== spokenCursorRef.current) {
      spokenCursorRef.current = next;
      setSpokenCursor(next);
    }
    // Keep a rolling tail of interim text (bounded).
    if (interimText) {
      const toks = interimText.trim().split(/\s+/).filter(Boolean);
      const tail = toks.slice(-INTERIM_TAIL_MAX_WORDS).join(' ');
      interimTailRef.current = tail;
    }
    maybeRealign();
  }, [maybeRealign]);

  const handleInsertionFactory = useCallback((gen: number): InsertionCallback => () => {
    if (gen !== generationRef.current) return;
    insertionStreakRef.current += 1;
    // Insertions naturally reset after a realign (see realignTo).
  }, []);

  /**
   * Start (or restart) the windowed recognizer at an absolute word index.
   * All live recognizers must be launched via this helper so the generation
   * guard is honoured and `baseWordOffset` is threaded correctly.
   */
  const startAtIndex = useCallback((startIdx: number) => {
    // Determine which group contains startIdx and slice accordingly.
    let wordOffset = 0;
    let resumeGroupIdx = 0;
    for (let i = 0; i < wordGroups.length; i++) {
      if (wordOffset + wordGroups[i].length > startIdx) {
        resumeGroupIdx = i;
        break;
      }
      wordOffset += wordGroups[i].length;
    }

    const remaining = wordGroups.slice(resumeGroupIdx).map((g) => g.slice());
    const posInGroup = startIdx - wordOffset;
    if (posInGroup > 0 && remaining.length > 0) {
      remaining[0] = remaining[0].slice(posInGroup);
    }

    // Stop any existing recognizer before starting a new one.
    stopRef.current?.();
    stopRef.current = null;

    // Bump generation so stale callbacks are ignored.
    generationRef.current += 1;
    const gen = generationRef.current;

    try {
      const stop = startWindowedPronunciationAssessment(
        remaining,
        handleWordResult,
        handleDoneFactory(gen),
        handleErrorFactory(gen),
        undefined,
        handleRecognizingFactory(gen),
        startIdx,
        handleInsertionFactory(gen),
      );
      stopRef.current = stop;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [wordGroups, handleWordResult, handleDoneFactory, handleErrorFactory, handleRecognizingFactory, handleInsertionFactory]);

  /**
   * Jump the cursor to a new position mid-session and restart the recognizer.
   * Forward jumps mark intermediate unscored words as 'skipped'.
   * Backward jumps clear live-stream statuses/scores/timings in the range
   * (but preserve any entries set by `updateWordResult`).
   */
  const realignTo = useCallback((
    newIdx: number,
    direction: 'forward' | 'backward',
    reason: string,
    confidence: number,
  ) => {
    const oldIdx = nextWordRef.current;
    lastRealignAtRef.current = Date.now();

    if (direction === 'forward') {
      setStatuses((prev) => {
        const next = { ...prev };
        for (let i = oldIdx; i < newIdx; i++) {
          if (next[i] === undefined) next[i] = 'skipped';
        }
        return next;
      });
    } else {
      setStatuses((prev) => {
        const next = { ...prev };
        for (let i = newIdx; i < oldIdx; i++) {
          if (!manualIndicesRef.current.has(i)) delete next[i];
        }
        return next;
      });
      setScores((prev) => {
        const next = { ...prev };
        for (let i = newIdx; i < oldIdx; i++) {
          if (!manualIndicesRef.current.has(i)) delete next[i];
        }
        return next;
      });
      setWordTimings((prev) => {
        const next = { ...prev };
        for (let i = newIdx; i < oldIdx; i++) {
          if (!manualIndicesRef.current.has(i)) delete next[i];
        }
        return next;
      });
    }

    nextWordRef.current = newIdx;
    setNextWordIndex(newIdx);
    spokenCursorRef.current = newIdx;
    setSpokenCursor(newIdx);

    omissionStreakRef.current = 0;
    lowAccStreakRef.current = 0;
    insertionStreakRef.current = 0;
    interimTailRef.current = '';
    setAlignmentLost(false);
    setLastRealign({
      fromIdx: oldIdx,
      toIdx: newIdx,
      direction,
      reason,
      confidence,
      at: Date.now(),
    });

    if (newIdx >= words.length) {
      setListening(false);
      setSessionDone(true);
      onSessionDone?.();
      return;
    }

    startAtIndex(newIdx);
  }, [words.length, startAtIndex, onSessionDone]);

  useEffect(() => {
    realignToRef.current = realignTo;
  }, [realignTo]);

  const startListening = useCallback(() => {
    setError(null);
    setSessionDone(false);
    setPaused(false);
    setStatuses({});
    setScores({});
    setFluencyScore(undefined);
    setWordTimings({});
    nextWordRef.current = 0;
    setNextWordIndex(0);
    spokenCursorRef.current = 0;
    setSpokenCursor(0);

    resultsSeenRef.current = 0;
    omissionStreakRef.current = 0;
    lowAccStreakRef.current = 0;
    insertionStreakRef.current = 0;
    interimTailRef.current = '';
    lastInterimMatchAtRef.current = 0;
    lastRealignAtRef.current = 0;
    lastFinalAtRef.current = Date.now();
    manualIndicesRef.current = new Set();
    setAlignmentLost(false);
    setLastRealign(null);

    setListening(true);
    startAtIndex(0);
  }, [startAtIndex]);

  const pauseListening = useCallback(() => {
    pausingRef.current = true;
    stopRef.current?.();
    stopRef.current = null;
    setPaused(true);
  }, []);

  const resumeListening = useCallback(() => {
    // Use the furthest known position — the spoken cursor may be ahead of scored words
    const currentIdx = Math.max(nextWordRef.current, spokenCursorRef.current);
    if (currentIdx >= words.length) {
      setPaused(false);
      setSessionDone(true);
      onSessionDone?.();
      return;
    }

    nextWordRef.current = currentIdx;
    setNextWordIndex(currentIdx);
    spokenCursorRef.current = currentIdx;
    setSpokenCursor(currentIdx);

    setPaused(false);
    startAtIndex(currentIdx);
  }, [words.length, onSessionDone, startAtIndex]);

  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setPaused(false);
  }, []);

  const updateWordResult = useCallback((index: number, result: WordResult) => {
    const status: WordStatus =
      result.errorType === 'None' && result.accuracyScore >= 80 ? 'correct'
        : result.accuracyScore >= 50 ? 'average' : 'mispronounced';
    setStatuses((prev) => ({ ...prev, [index]: status }));
    setScores((prev) => ({ ...prev, [index]: result.accuracyScore }));
    setWordTimings((prev) => ({
      ...prev,
      [index]: {
        offsetSec: 0,
        durationSec: 0,
        phonemeScores: result.phonemeScores,
      },
    }));
    manualIndicesRef.current.add(index);
  }, []);

  useEffect(() => {
    return () => { stopRef.current?.(); };
  }, []);

  return {
    statuses,
    scores,
    wordTimings,
    listening,
    paused,
    sessionDone,
    error,
    fluencyScore,
    nextWordIndex,
    spokenCursor,
    alignmentLost,
    lastRealign,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    updateWordResult,
    setError,
  };
}

