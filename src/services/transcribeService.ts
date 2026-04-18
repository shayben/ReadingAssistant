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
 * Start recording from the default microphone. Caller is responsible for
 * calling {@link AudioRecorder.stop} when the user releases the mic button.
 *
 * Throws if the browser denies microphone access. The microphone track is
 * always released, even on cancel.
 */
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

  return {
    stopped,
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state !== 'inactive') recorder.stop();
      else micStream.getTracks().forEach((t) => t.stop());
    },
  };
}
