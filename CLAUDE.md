# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A market news app showing a "Top 10 Daily" list of market news articles. Three parts:

- `backend/` — Express + TypeScript + Prisma API (`GET /api/news`), port 4000. See `backend/CLAUDE.md`.
- `frontend/` — Vite + React 19 + TypeScript, port 5173. See `frontend/CLAUDE.md`.
- Postgres 17 — single `news_articles` table. Articles are ingested by a backend poller that fetches Finnhub news every 60s (needs `FINNHUB_TOKEN` in `backend/.env` locally / Railway variables in prod), deduped by the unique `finnhubId` column.

Design specs and implementation plans live in `docs/superpowers/`.

## Running locally

```bash
docker compose up            # postgres + backend + frontend, with hot reload
```

Source directories are bind-mounted into the containers, so edits hot-reload (ts-node-dev for the backend, Vite HMR for the frontend) without rebuilding. The backend container runs `prisma migrate deploy` on startup. Frontend: http://localhost:5173, API: http://localhost:4000/api/news.

Backend and frontend can also be run directly with `npm run dev` in each directory (backend needs `DATABASE_URL` pointing at a running Postgres; the compose Postgres is exposed on host port 5432 as `postgresql://news:news@localhost:5432/news?schema=public`).

## Deployment (Railway)

`railway.json` + the **root** `Dockerfile` define the production build — a single image, distinct from the per-service dev Dockerfiles used by docker-compose:

1. Stage 1 builds the frontend with `VITE_API_BASE_URL=""` (same-origin API calls).
2. Stage 2 builds the backend and copies the frontend `dist/` to `./public`, which Express serves statically with an SPA catch-all.

So in production one process on port 4000 serves both the API and the UI; the two-origin setup (5173 → 4000, with CORS) exists only in dev. The container runs `prisma migrate deploy` before starting. Railway health-checks `/api/news`.

## Cross-cutting gotchas

- The `NewsArticle` shape is duplicated by hand: `backend/prisma/schema.prisma` and `frontend/src/api/news.ts` (interface). Schema changes must update both, plus a Prisma migration.
- The API contract is exactly "top 10 articles ordered by `publishedAt` desc, then `id` desc" — the backend tests assert this query verbatim and the frontend renders whatever it gets in order.
- node:20-alpine no longer bundles OpenSSL, which Prisma's engine needs — every backend image must `apk add --no-cache openssl` (already in both Dockerfiles; keep it when touching them).
