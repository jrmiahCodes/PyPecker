# PyPecker

A browser-based Python syntax drill app inspired by the [Woodpecker Method](https://www.chessprogramming.org/Woodpecker_Method) from chess training.

Solve the same set of data-engineering-themed Python puzzles in repeated cycles, halving your time each pass until pattern recognition becomes automatic. Everything runs locally in your browser — no account, no backend, no telemetry.

## How it works

- **Three tiered sets** — 30 atomic puzzles, 25 combinations, 15 compound scripts
- **Cycles** — solve the whole set, then repeat; each cycle targets half the previous time
- **Mastery** — a set is mastered after 5 cycles at 90%+ accuracy with stable sub-target times
- **Sandboxed** — your code runs inside [Pyodide](https://pyodide.org) in a Web Worker with a 5s timeout
- **Local-first** — progress is saved to `localStorage`; clearing site data wipes it

## Stack

- Next.js 14 App Router with `output: 'export'` (fully static)
- React 18 + TypeScript
- Tailwind CSS
- Pyodide 0.27.5 (loaded from CDN on first use)
- Fonts: JetBrains Mono + DM Sans

## Develop locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Build

```bash
npm run build
```

Static output is written to `out/`.

## Verify puzzles

The Python script mirrors the worker's normalization/validation logic and runs every puzzle's reference solution:

```bash
python3 scripts/verify-puzzles.py
```

## Deploy to Cloudflare Pages

This repo is configured for static export, so no adapter or server runtime is needed.

1. Push this repo to GitHub.
2. In the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, pick this repo.
3. Set the following build settings:
   - **Framework preset:** Next.js (Static HTML Export)
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Node version:** set `NODE_VERSION=20` as an environment variable
4. Deploy.

Pyodide loads from `cdn.jsdelivr.net` on first use; Cloudflare's default CSP does not block it.

## Keyboard shortcuts

| Key                | Action                         |
| ------------------ | ------------------------------ |
| `↵` / `⌘↵`         | Submit solution                |
| `⌘H` / `Ctrl+H`    | Reveal next hint               |
| `⌘→` / `Ctrl+→`    | Skip puzzle (counts as failed) |
| `Esc`              | Back to set list               |

## Project layout

```
public/puzzles/        # tier JSON files — the source of truth for content
public/pyodide-worker.js   # Web Worker wrapping Pyodide
src/app/               # Next.js routes (/, /train/[setId], /progress)
src/components/        # PuzzleCard, CodeInput, FeedbackDisplay, etc.
src/lib/               # cycleTracker, pyodide client, storage, types
scripts/verify-puzzles.py  # offline puzzle validator
```
