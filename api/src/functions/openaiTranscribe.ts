/**
 * POST /api/openai/transcribe
 *
 * Audio transcription via Azure OpenAI Whisper. Used by the home-screen
 * "Ask" helper so a child can speak a word in either English or their
 * account language (or even code-switch within one utterance, e.g.
 * "how do you spell elephant in Hebrew") and get a single transcript
 * back without specifying the locale up front.
 *
 * Request:  { audioBase64: string, mimeType?: string, filename?: string }
 * Response: { text: string }
 */

import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { config, requireConfig } from '../lib/config.js';
import { guard } from '../lib/guard.js';
import { badRequest, ok, upstreamError } from '../lib/http.js';

interface TranscribeBody {
  audioBase64?: string;
  mimeType?: string;
  filename?: string;
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB upper bound — short clips only.

function buildMultipart(audio: Buffer, filename: string, mimeType: string): { body: Buffer; contentType: string } {
  const boundary = `----wizbit-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const CRLF = '\r\n';
  const head = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`,
  );
  const between = Buffer.from(
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-1`,
  );
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  return {
    body: Buffer.concat([head, audio, between, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

app.http('openai-transcribe', {
  route: 'openai/transcribe',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: guard(
    { purpose: 'transcribe' },
    async (request: HttpRequest, _ctx: InvocationContext, { refundCharge }) => {
      const body = (await request.json().catch(() => null)) as TranscribeBody | null;
      if (!body?.audioBase64) {
        await refundCharge();
        return badRequest('audioBase64 is required');
      }

      const audio = Buffer.from(body.audioBase64, 'base64');
      if (audio.length === 0) {
        await refundCharge();
        return badRequest('audioBase64 decoded to empty payload');
      }
      if (audio.length > MAX_AUDIO_BYTES) {
        await refundCharge();
        return badRequest('Audio exceeds 8 MB');
      }

      const endpoint = requireConfig(
        config.openai.whisperEndpoint ?? config.openai.endpoint,
        'AZURE_OPENAI_WHISPER_ENDPOINT or AZURE_OPENAI_ENDPOINT',
      );
      const key = requireConfig(
        config.openai.whisperKey ?? config.openai.key,
        'AZURE_OPENAI_WHISPER_KEY or AZURE_OPENAI_KEY',
      );
      const deployment = requireConfig(
        config.openai.whisperDeployment,
        'AZURE_OPENAI_WHISPER_DEPLOYMENT',
      );

      const mimeType = body.mimeType ?? 'audio/webm';
      const filename = body.filename ?? `clip.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`;
      const { body: multipartBody, contentType } = buildMultipart(audio, filename, mimeType);

      // No `language` parameter so Whisper auto-detects, including
      // code-switched audio (e.g. English + Hebrew in one utterance).
      const url = `${endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=2024-06-01`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'api-key': key, 'Content-Type': contentType },
        body: multipartBody,
      });

      if (!res.ok) {
        await refundCharge();
        return upstreamError(res.status, await res.text());
      }

      const data = (await res.json()) as { text?: string };
      return ok({ text: data.text ?? '' });
    },
  ),
});
