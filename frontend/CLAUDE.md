# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vite + React 19 + TypeScript frontend rendering the "Top 10 Daily" market news page. See the root `CLAUDE.md` for how this fits with the backend and deployment.

## Commands

```bash
npm run dev       # Vite dev server on 5173
npm run build     # tsc -b, then vite build → dist/
npm run lint      # oxlint
npm run preview   # serve the production build locally
```

There are no frontend tests.

## Architecture

- `src/api/news.ts` is the data layer and the only file that knows about the backend: the hand-written `NewsArticle` interface (must mirror `backend/prisma/schema.prisma`), `fetchNews()`, and the sentiment logic. The API base URL comes from `VITE_API_BASE_URL`, defaulting to `http://localhost:4000`; production builds set it to `""` so calls are same-origin (see root Dockerfile).
- `src/components/NewsList.tsx` is essentially the whole UI — `App.tsx` just renders it. It fetches once on mount and renders error / loading / empty / list states.

## Design conventions

- **Sentiment is derived, not stored.** `deriveSentiment()` keyword-matches the headline + summary (with `\b` word boundaries — substring matching caused false positives before) to color the category tag per-story: positive/green, negative/red, mixed-or-neither/neutral gray. Category text and tag color are independent axes.
- Dark editorial theme, all inline styles (no CSS files — a leftover `index.css` once broke the layout), colors in `oklch()`. Serif (`Source Serif 4`) for headlines and rank numbers, sans (`IBM Plex Sans`) for everything else. The layout follows the mockup in `docs/superpowers/specs/2026-07-19-top-10-daily-redesign.md`.
- The list order is the backend's order (publishedAt desc, id desc); ranks 01–10 are just the render index, not stored.
