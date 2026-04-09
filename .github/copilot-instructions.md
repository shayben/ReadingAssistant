# Copilot Instructions — ReadingAssistant

## Build & Run

```bash
npm run build    # tsc -b && vite build → outputs to dist/
npm run dev      # local dev server at http://localhost:5173
npm run lint     # eslint (TS + React Hooks + React Refresh)
```

No test framework is configured. There is no `npm test` script.

## Architecture

**React 19 + Vite + TypeScript + Tailwind CSS v4** single-page app. No router — navigation is a state machine in `App.tsx` (`AppStep` type: `home | camera | processing | reading | demo-pick | adventure`), rendered via early-return branches.

### Azure Services (all called directly from the browser)

| Service | SDK / Protocol | Used For |
|---|---|---|
| Azure OpenAI (GPT-4o-mini) | REST `chat/completions` | OCR post-processing, immersive moments, story generation, batch translation |
| Azure Computer Vision | REST Read API | Camera OCR |
| Azure Speech | `microsoft-cognitiveservices-speech-sdk` | Pronunciation assessment, TTS |
| Azure Translator | REST v3.0 | Per-word contextual translation (legacy, being replaced by batch AOAI) |

All credentials come from `VITE_` env vars (see `.env.example`). **These are baked into the client bundle at build time and visible in the browser** — this is by design for this app.

### Key Components

- **`App.tsx`** — State machine root: camera capture, OCR processing, demo level picker, adventure mode routing.
- **`ReadingSession`** — Core reading experience: word display, windowed pronunciation assessment, recording, gamification scoring, immersive moments, language toggle, batch translation.
- **`WordPopup`** — Fixed bottom-sheet modal: syllable breakdown, per-phoneme accuracy colors, translation (instant lookup from pre-computed map), practice mode, moment media.
- **`AdventureMode`** — Choose-your-own-adventure orchestrator using `ReadingSession` for each chapter.
- **`MomentOverlay`** — Animated image + caption overlay triggered during reading.

### Key Services

- **`speechService`** — Windowed pronunciation assessment (5-word windows, auto-advancing cursor), single-word assessment for practice, TTS playback.
- **`translationService`** — `batchTranslateText()` sends all unique words + full text to GPT in one call, returns a `Map<string, string>` for instant popup lookups. Supports 10 languages.
- **`momentsService`** — GPT text analysis identifying 2–4 "immersive moments" per text. Results are cached in-memory at runtime. Demo paragraphs use pre-generated static cache (`src/data/momentCache.ts`).
- **`storyService`** — GPT chapter generation with rolling summary context (not full chapter history) to stay within token budget.
- **`ocrService`** — Azure Vision Read API + GPT post-processing for OCR correction. Includes image resize to stay under Azure's 4MB limit.

## Conventions

### Service Pattern

Every Azure-calling service follows a consistent structure:
1. Read `import.meta.env.VITE_*` vars at module top
2. Guard with early throw/return if credentials missing
3. Use `fetchWithRetry` (exponential backoff on 429s) for Azure OpenAI calls
4. Strip markdown fences from LLM JSON responses before parsing
5. Return empty arrays or raw text on failure (best-effort, never crash)

### Component Pattern

- Props typed with `interface FooProps`, components as `React.FC<FooProps>`
- Local state via hooks (`useState`/`useEffect`/`useRef`/`useCallback`/`useMemo`)
- Async effects use `let cancelled = false` + cleanup return for race condition safety
- Mobile-first: large tap targets, fixed overlays, `overscroll-behavior: contain` to prevent pull-to-refresh on bottom sheets

### Styling

- Tailwind utility classes inline (no CSS modules, no styled-components)
- Responsive via `md:` breakpoints for iPad/tablet
- Custom animations defined in `src/index.css`: `animate-slide-up`, `animate-fade-in`, `animate-next-word` (pulse)
- Use SVG icons instead of emoji for precise sizing/alignment in interactive elements

### Static Data

- `src/data/demoParagraphs.ts` — 7 reading levels × 3 paragraphs each
- `src/data/momentCache.ts` — Pre-generated immersive moments keyed by `"{grade}-{paragraphIndex}"`. Regenerate with `node scripts/generateMomentCache.mjs` (requires `.env` credentials).

## Deployment

Azure Static Web Apps via GitHub Actions (`.github/workflows/azure-static-web-apps.yml`). Deploys on push to `main`. Azure secrets are injected as `VITE_` env vars during the build step. SPA routing config is in `public/staticwebapp.config.json`.
