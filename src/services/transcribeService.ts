/**
 * Audio transcription via the Wizbit backend proxy → Azure OpenAI Whisper.
 *
 * Whisper auto-detects language (no `language` param sent), so it handles
 * English, the child's account language, AND code-switched utterances
 * such as "how do you spell elephant in Hebrew" within a single request.
 *
 * Also exports a small {@link recordAudioClip} helper that wraps
 * MediaRecorder for short utterances captured by the home-screen "Ask"
 * button. Returns a promise that resolves with the recorded Blob once
 * recording stops.
 */

import { apiPost, blobToBase64 } from './apiClient';

export interface TranscriptionResult {
  text: string;
}

export async function transcribeAudio(blob: Blob): Promise<TranscriptionResult> {
  const audioBase64 = await blobToBase64(blob);
  const data = await apiPost<unknown, { text?: string }>('/openai/transcribe', {
    audioBase64,
    mimeType: blob.type || 'audio/webm',
  });
  return { text: (data.text ?? '').trim() };
}

export interface AudioRecorder {
  /** Resolves with the captured Blob once {@link stop} is called. */
  stopped: Promise<Blob>;
  /** Stop recording. Idempotent. */
  stop: () => void;
  /** Force-cancel the recording (rejects {@link stopped}). */
  cancel: () => void;
}

/**
 * Start recording from the default microphone. Recording stops automatically
 * when silence is detected (after {@link SILENCE_DURATION_MS} of quiet audio)
 * or when the caller invokes {@link AudioRecorder.stop}.  A hard cap of
 * {@link MAX_DURATION_MS} ensures the recording never runs forever.
 *
 * Throws if the browser denies microphone access. The microphone track is
 * always released, even on cancel.
 */

/** RMS amplitude (0-100 scale) below which a sample is considered silence. */
const SILENCE_RMS_THRESHOLD = 8;
/** Grace period at the start before silence detection kicks in (ms). */
const SILENCE_LEAD_IN_MS = 600;
/** Consecutive silence required before auto-stopping (ms). */
const SILENCE_DURATION_MS = 1500;
/** Absolute maximum recording length — safety cap (ms). */
const MAX_DURATION_MS = 30_000;

export async function recordAudioClip(): Promise<AudioRecorder> {
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(micStream);
  const chunks: Blob[] = [];
  let cancelled = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      micStream.getTracks().forEach((t) => t.stop());
      if (cancelled) {
        reject(new Error('cancelled'));
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      resolve(blob);
    };
    recorder.onerror = (event: Event) => {
      micStream.getTracks().forEach((t) => t.stop());
      const err = (event as Event & { error?: Error }).error;
      reject(err ?? new Error('Recorder error'));
    };
  });

  recorder.start();

  // ── Silence detection via Web Audio API ──────────────────────────────────
  let silencePollerHandle: ReturnType<typeof setInterval> | null = null;
  let maxDurationHandle: ReturnType<typeof setTimeout> | null = null;
  let audioCtx: AudioContext | null = null;

  const doStop = () => {
    if (silencePollerHandle !== null) {
      clearInterval(silencePollerHandle);
      silencePollerHandle = null;
    }
    if (maxDurationHandle !== null) {
      clearTimeout(maxDurationHandle);
      maxDurationHandle = null;
    }
    // close() may reject if the context is already closed — safe to ignore.
    audioCtx?.close().catch(() => { /* intentionally ignored */ });
    if (recorder.state !== 'inactive') recorder.stop();
  };

  try {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(micStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const startTime = Date.now();
    let silenceStart: number | null = null;

    silencePollerHandle = setInterval(() => {
      if (recorder.state !== 'recording') return;
      const elapsed = Date.now() - startTime;
      if (elapsed < SILENCE_LEAD_IN_MS) return; // ignore lead-in

      analyser.getByteTimeDomainData(dataArray);
      let sumSq = 0;
      for (const v of dataArray) {
        const s = (v - 128) / 128;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / dataArray.length) * 100;

      if (rms < SILENCE_RMS_THRESHOLD) {
        if (silenceStart === null) silenceStart = Date.now();
        else if (Date.now() - silenceStart >= SILENCE_DURATION_MS) doStop();
      } else {
        silenceStart = null;
      }
    }, 100);

    maxDurationHandle = setTimeout(doStop, MAX_DURATION_MS);
  } catch {
    // AudioContext not available (e.g. test env) — silence detection is best-effort
  }

  return {
    stopped,
    stop: doStop,
    cancel: () => {
      cancelled = true;
      doStop();
    },
  };
}
