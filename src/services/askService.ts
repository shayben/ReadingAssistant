/**
 * "Ask" helper service — turns a transcript into a structured intent for
 * the home-screen voice assistant.
 *
 * Two-step pipeline:
 *   1. {@link classifyIntent}  — primary path. A tiny Azure OpenAI call
 *      classifies the transcript into spell / translate / unknown,
 *      identifies the target word, and detects the relevant languages.
 *      The transcript may be in English, the account language, or even
 *      code-switched ("how do you spell elephant in Hebrew").
 *   2. {@link heuristicIntent} — pure-function fallback used when the LLM
 *      call fails. Single-token transcripts → spell. Otherwise we make a
 *      best-effort guess: extract the longest alphabetic token and assume
 *      the child wants it translated to the *opposite* language.
 *
 * Output `intent` is one of:
 *   - 'spell'      → render `word` as big letter tiles (in `sourceLang`)
 *   - 'translate'  → translate `word` from `sourceLang` to `targetLang`
 *   - 'unknown'    → show a friendly "didn't catch that" message
 */

import { z } from 'zod';
import { apiPost, QuotaExceededError } from './apiClient';

export type AskIntent = 'spell' | 'translate' | 'unknown';

export interface AskClassification {
  intent: AskIntent;
  /** The target word (lowercase, punctuation stripped). */
  word: string;
  /** BCP-47-ish language code of `word` (e.g. 'en', 'he'). */
  sourceLang: string;
  /** For 'translate', the language to translate INTO. Same as sourceLang otherwise. */
  targetLang: string;
}

const SCHEMA = z.object({
  intent: z.enum(['spell', 'translate', 'unknown']),
  word: z.string(),
  sourceLang: z.string(),
  targetLang: z.string(),
});

/**
 * Pure heuristic fallback. No network calls. Always returns *something* —
 * tests rely on this being deterministic.
 */
export function heuristicIntent(transcript: string, accountLang: string): AskClassification {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { intent: 'unknown', word: '', sourceLang: 'en', targetLang: accountLang };
  }

  // Tokenise on whitespace; preserve unicode letters for non-Latin scripts.
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  // Detect script of the longest token: Latin → 'en', otherwise assume the
  // account language (Whisper most often code-switches between English and
  // the child's account language).
  const longest = tokens.reduce((a, b) => (b.length > a.length ? b : a), '');
  const sourceLang = /^[A-Za-z']+$/.test(longest) ? 'en' : accountLang;

  // Single-token utterance → assume the child just said the word and wants
  // to see it spelled out.
  if (tokens.length === 1) {
    return {
      intent: 'spell',
      word: longest.toLowerCase().replace(/[^\p{L}']/gu, ''),
      sourceLang,
      targetLang: sourceLang,
    };
  }

  // Multi-token: assume translation request to the opposite language.
  const targetLang = sourceLang === 'en' ? accountLang : 'en';
  return {
    intent: 'translate',
    word: longest.toLowerCase().replace(/[^\p{L}']/gu, ''),
    sourceLang,
    targetLang,
  };
}

/**
 * Classify a (possibly code-switched) transcript into a structured intent.
 * Falls back to {@link heuristicIntent} on any failure other than quota.
 */
export async function classifyIntent(
  transcript: string,
  accountLang: string,
  accountLangLabel: string,
): Promise<AskClassification> {
  const cleaned = transcript.trim();
  if (!cleaned) {
    return { intent: 'unknown', word: '', sourceLang: 'en', targetLang: accountLang };
  }

  try {
    const data = await apiPost<unknown, { content: string }>('/openai/chat', {
      purpose: 'word-helper',
      response_format: 'json_object',
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            `You parse short voice requests from a child using a reading app. ` +
            `The child's account language is ${accountLangLabel} (${accountLang}); ` +
            `they may speak in English, ${accountLangLabel}, or mix both in one sentence. ` +
            `Classify the request and output ONLY a JSON object with these fields:\n` +
            `  intent: "spell" | "translate" | "unknown"\n` +
            `  word:        the single target word, lowercase, no punctuation\n` +
            `  sourceLang:  the BCP-47 language code of "word" (e.g. "en", "${accountLang}")\n` +
            `  targetLang:  for "translate", the language to translate INTO; otherwise same as sourceLang\n\n` +
            `Rules:\n` +
            `- "How do you spell X" / "spell X" / "איך כותבים X" → intent="spell", word=X.\n` +
            `- "What is X in <language>" / "translate X to <language>" / "איך אומרים X ב<שפה>" → intent="translate".\n` +
            `- A single bare word → intent="spell".\n` +
            `- If you cannot identify a target word → intent="unknown", word="".`,
        },
        { role: 'user', content: cleaned },
      ],
    });

    const raw = (data.content ?? '').replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = SCHEMA.safeParse(JSON.parse(raw));
    if (!parsed.success) return heuristicIntent(cleaned, accountLang);

    const result: AskClassification = {
      intent: parsed.data.intent,
      word: parsed.data.word.trim().toLowerCase().replace(/[^\p{L}']/gu, ''),
      sourceLang: parsed.data.sourceLang.trim() || 'en',
      targetLang: parsed.data.targetLang.trim() || parsed.data.sourceLang.trim() || 'en',
    };
    if (result.intent !== 'unknown' && !result.word) return heuristicIntent(cleaned, accountLang);
    return result;
  } catch (err) {
    if (err instanceof QuotaExceededError) throw err;
    return heuristicIntent(cleaned, accountLang);
  }
}
