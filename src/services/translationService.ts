/**
 * Azure Translator service — translates words to Hebrew.
 */

const TRANSLATOR_KEY = import.meta.env.VITE_AZURE_TRANSLATOR_KEY as string;
const TRANSLATOR_REGION = import.meta.env.VITE_AZURE_TRANSLATOR_REGION as string;

const TRANSLATE_URL =
  'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=he';

export interface TranslationResult {
  hebrew: string;
}

/**
 * Translate an English word or phrase to Hebrew via Azure Translator.
 */
export async function translateToHebrew(text: string): Promise<TranslationResult> {
  if (!TRANSLATOR_KEY || !TRANSLATOR_REGION) {
    throw new Error(
      'Azure Translator credentials are not configured. ' +
        'Set VITE_AZURE_TRANSLATOR_KEY and VITE_AZURE_TRANSLATOR_REGION in your .env file.',
    );
  }

  const res = await fetch(TRANSLATE_URL, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY,
      'Ocp-Apim-Subscription-Region': TRANSLATOR_REGION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Translator API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const hebrew: string = data?.[0]?.translations?.[0]?.text ?? '';
  return { hebrew };
}
