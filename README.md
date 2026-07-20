# Market News App

A "Top 10 Daily" list of market news articles. Express + TypeScript + Prisma backend, Vite + React frontend, Postgres storage, ingested by a Finnhub news poller. See `CLAUDE.md` for full architecture notes.

## Running locally

```bash
docker compose up            # postgres + backend + frontend, with hot reload
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/news

Source directories are bind-mounted into the containers, so edits hot-reload (ts-node-dev for the backend, Vite HMR for the frontend) without rebuilding. The backend container runs `prisma migrate deploy` on startup. The poller needs `FINNHUB_TOKEN` set in `backend/.env`.

Backend and frontend can also be run directly with `npm run dev` in each directory (backend needs `DATABASE_URL` pointing at a running Postgres; the compose Postgres is exposed on host port 5432 as `postgresql://news:news@localhost:5432/news?schema=public`).

## Changelog

- Scaffolded the market news app: Express/Prisma backend, React frontend, Postgres — [spec](docs/superpowers/specs/2026-07-19-market-news-app-design.md) / [plan](docs/superpowers/plans/2026-07-19-market-news-app.md)
- Redesigned the news list as a dark editorial "Top 10 Daily" layout — [spec](docs/superpowers/specs/2026-07-19-top-10-daily-redesign.md) / [plan](docs/superpowers/plans/2026-07-19-top-10-daily-redesign.md)
- Added the Finnhub news poller: fetch, filter categories, dedup by `finnhubId`, start on boot — [spec](docs/superpowers/specs/2026-07-19-finnhub-news-poller-design.md) / [plan](docs/superpowers/plans/2026-07-19-finnhub-news-poller.md)
- Narrowed the poller to keep only `business`-category articles
