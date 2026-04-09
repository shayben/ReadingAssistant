/**
 * One-time script: generate immersive moments for all demo paragraphs
 * and write them to src/data/momentCache.ts.
 *
 * Run: node scripts/generateMomentCache.mjs
 */

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const KEY = process.env.AZURE_OPENAI_KEY;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';

if (!ENDPOINT || !KEY) {
  console.error('Missing required environment variables: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY');
  console.error('Usage: AZURE_OPENAI_ENDPOINT=https://... AZURE_OPENAI_KEY=... node scripts/generateMomentCache.mjs');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a reading assistant for children ages 6-12. Analyse the given text and identify 4-8 key moments where showing a visual sticker, playing background music, or triggering a contextual sound effect would make reading more immersive and engaging.

Each moment spans a range of words: it appears at the "start" word and fades at the "fade" word. Pick a range that covers the phrase or scene the moment illustrates (typically 3-10 words).

For each moment return a JSON object with:
- wordIndex: 0-based index of the START word where the moment appears
- triggerWord: the actual start word
- fadeWordIndex: 0-based index of the FADE word where the moment disappears (must be >= wordIndex)
- fadeWord: the actual fade word
- type: "image", "music", or "both"
- imageQuery: a Wikipedia article title for finding a reference image (use underscores for spaces, e.g. "Napoleon", "Amazon_rainforest"). Only if type includes image.
- stickerPrompt: a short phrase describing a cute cartoon sticker to show (e.g. "a happy orange cat sitting", "bright yellow sun with sunglasses", "a rocket blasting off"). Keep it simple, child-friendly, and visual. Only if type includes image.
- stickerEmoji: a single emoji that best represents this moment (always include this)
- stickerLabel: a short consistent name for the character, place, or object this sticker depicts (e.g. "brave knight", "enchanted forest", "golden crown"). Use the SAME label when the same entity appears again.
- musicCategory: one of "nature", "dramatic", "celebration", "peaceful", "mysterious", "adventure", "ocean", "space". Only if type includes music.
- soundEffect: (optional) a short sound effect that matches what is happening in the text at this word. Pick from: "falling", "splash", "honk", "thunder", "wind", "rain", "bark", "roar", "bell", "whistle", "bird", "whoosh", "knock", "pop", "buzz", "boom", "gallop", "wave", "cheer", "fire", "ding", "creak", "snap", "engine", "scream". Only include when the text clearly describes an action or scene that has a recognisable sound.
- caption: a fun, kid-friendly one-sentence fact (max 15 words)

Return ONLY a valid JSON array. No markdown fences, no explanation.`;

const paragraphs = [
  { key: 'K-0', text: 'The cat sat on a mat. The cat is big. The cat is red. I like the cat.' },
  { key: 'K-1', text: 'I have a dog. My dog can run. My dog can sit. I love my dog.' },
  { key: 'K-2', text: 'The sun is hot. The sun is up. I can see the sun. It is a fun day.' },
  { key: '1-0', text: 'I went to the park with my mom. We played on the swings. I went down the slide. It was so much fun!' },
  { key: '1-1', text: 'I have a pet fish. It is blue and small. It swims in a tank. I feed it every day.' },
  { key: '1-2', text: 'It is raining today. I can hear the rain on the roof. I will read a book and drink warm milk.' },
  { key: '2-0', text: 'Last week we went to a farm. We saw cows, pigs, and chickens. The farmer let us feed the baby goats. They were soft and very friendly.' },
  { key: '2-1', text: 'Yesterday was my birthday. I turned seven years old. My friends came to my party. We ate cake and played games outside.' },
  { key: '2-2', text: 'I like going to the library. There are so many books to read. I picked a book about dinosaurs. Did you know some dinosaurs could fly?' },
  { key: '3-0', text: 'Our solar system has eight planets. Earth is the third planet from the sun. Jupiter is the biggest planet. It would take over one thousand Earths to fill up Jupiter!' },
  { key: '3-1', text: 'On Saturday morning, I helped my dad make pancakes. We mixed flour, eggs, and milk in a big bowl. Then we poured the batter on the hot pan. The pancakes were delicious with maple syrup.' },
  { key: '3-2', text: 'My grandfather helped me build a treehouse. We used wooden boards and nails. It has a small window and a rope ladder. I love sitting up there and watching the birds.' },
  { key: '4-0', text: 'Water is always moving in a cycle. The sun heats water in oceans and lakes, turning it into vapor. The vapor rises and forms clouds. When the clouds get heavy, rain or snow falls back down to Earth. This process repeats over and over again.' },
  { key: '4-1', text: 'Penguins are interesting birds that cannot fly. Instead, they are excellent swimmers. Emperor penguins live in Antarctica where temperatures can drop below negative forty degrees. They huddle together in large groups to stay warm during terrible blizzards.' },
  { key: '4-2', text: 'Pizza originally comes from Italy. In the late 1800s, a baker in Naples created a special pizza for the queen. He used tomatoes, mozzarella cheese, and basil to represent the Italian flag. Today, pizza is enjoyed by millions of people around the world.' },
  { key: '5-0', text: "The Amazon Rainforest is the largest tropical rainforest on Earth, covering over five million square kilometers. It produces approximately twenty percent of the world's oxygen and is home to countless species of plants and animals. Scientists estimate that millions of species living there have not yet been discovered." },
  { key: '5-1', text: 'The ancient Egyptians built the pyramids over four thousand years ago. The Great Pyramid of Giza contains roughly two million stone blocks, each weighing about two and a half tons. Historians believe it took approximately twenty years and thousands of workers to complete this extraordinary structure.' },
  { key: '5-2', text: 'More than eighty percent of the ocean remains unexplored. The deepest point, the Mariana Trench, reaches nearly eleven kilometers below the surface. Remarkable creatures survive there despite crushing pressure and complete darkness. Scientists use specialized submarines to study these mysterious environments.' },
  { key: '6-0', text: 'Photosynthesis is the remarkable process by which plants convert sunlight into energy. Chlorophyll, the green pigment in leaves, absorbs light and uses it to transform carbon dioxide and water into glucose and oxygen. This process is fundamental to life on Earth, as it provides the oxygen we breathe and forms the base of nearly every food chain in existence.' },
  { key: '6-1', text: 'The Renaissance was a period of extraordinary cultural and intellectual achievement that began in Italy during the fourteenth century. Artists like Leonardo da Vinci and Michelangelo revolutionized painting and sculpture. Meanwhile, scientists such as Galileo challenged traditional beliefs about the universe. This remarkable era transformed European civilization and continues to influence our world today.' },
  { key: '6-2', text: 'Artificial intelligence refers to computer systems designed to perform tasks that typically require human intelligence. These systems can recognize speech, translate languages, and even make decisions. While artificial intelligence offers tremendous benefits in healthcare, education, and transportation, researchers emphasize the importance of developing these technologies responsibly and ethically.' },
];

async function generateMoments(text) {
  const words = text.match(/\S+/g) ?? [];
  const indexed = words.map((w, i) => `${i}:${w}`);
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2024-02-01`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Text: "${text}"\n\nWords (0-indexed): ${JSON.stringify(indexed)}` },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    console.error(`  API error ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const moments = JSON.parse(jsonStr);

  return moments.filter(
    (m) => typeof m.wordIndex === 'number' && m.wordIndex >= 0 && m.wordIndex < words.length && typeof m.caption === 'string',
  );
}

async function main() {
  const cache = {};

  for (const p of paragraphs) {
    console.log(`Generating moments for ${p.key}...`);
    try {
      cache[p.key] = await generateMoments(p.text);
      console.log(`  -> ${cache[p.key].length} moments`);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      cache[p.key] = [];
    }
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Generate TypeScript file
  const fs = await import('fs');
  const lines = [
    '/**',
    ' * Pre-generated immersive moments for demo paragraphs.',
    ' * Generated by scripts/generateMomentCache.mjs -- do not edit manually.',
    ' */',
    '',
    'import type { KeyMoment } from \'../services/momentsService\';',
    '',
    '/** Key format: "{grade}-{paragraphIndex}" e.g. "K-0", "3-2", "6-1" */',
    `export const momentCache: Record<string, KeyMoment[]> = ${JSON.stringify(cache, null, 2)};`,
    '',
  ];

  fs.writeFileSync('src/data/momentCache.ts', lines.join('\n'), 'utf-8');
  console.log('\nWritten to src/data/momentCache.ts');

  // Also write pure JSON for runtime lazy-loading
  fs.writeFileSync('public/momentCache.json', JSON.stringify(cache, null, 2), 'utf-8');
  console.log('Written to public/momentCache.json');
}

main().catch(console.error);
