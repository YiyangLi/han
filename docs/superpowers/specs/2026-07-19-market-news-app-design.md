# Market News App — Design

## Purpose

A bootstrap full-stack skeleton for a market news page: a React frontend that
lists market news items, backed by a Node/Express API, backed by a Postgres
database, all running via a single `docker-compose up`. Test data is inserted
manually (via Prisma Studio or `psql`) — no live ingestion pipeline in this
pass.

## Architecture

Three services orchestrated by `docker-compose.yml`:

- **postgres** — Postgres 17. Single table (`news_articles`). Data persisted
  to a named volume. Exposed on host port `5432`.
- **backend** — Node + Express + TypeScript, using Prisma as the ORM.
  Exposes `GET /api/news`. Connects to `postgres` over the Docker Compose
  network (hostname `postgres`). Listens on `4000`.
- **frontend** — Vite + React + TypeScript dev server. Fetches from the
  backend at `http://localhost:4000`. Listens on `5173`.

All three run via `docker compose up`. Each service's source directory is
bind-mounted into its container so edits hot-reload (nodemon/ts-node-dev for
the backend, Vite HMR for the frontend) without rebuilding images.

## Data Model

Single table, managed by Prisma migrations:

```prisma
model NewsArticle {
  id          Int      @id @default(autoincrement())
  headline    String
  source      String
  url         String
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("news_articles")
}
```

No auth, no pagination, no filtering, no ticker/symbol tagging in this pass.

## Components

Backend (`backend/`):

```
prisma/schema.prisma
src/
  index.ts        # Express app setup, CORS, listen
  routes/news.ts  # GET /api/news
  db.ts           # Prisma client singleton
```

Frontend (`frontend/`):

```
src/
  App.tsx                  # page layout
  components/NewsList.tsx  # fetch + render list
  api/news.ts              # fetch wrapper for GET /api/news
```

## Data Flow

1. On page load, `NewsList` calls `GET http://localhost:4000/api/news`.
2. Backend queries Prisma (`findMany`, ordered by `publishedAt desc`) and
   returns a JSON array.
3. Frontend renders each item's headline (linked via `url`), source, and a
   formatted `publishedAt`.

## Error Handling

- Empty table → frontend shows "No news yet" instead of a blank page.
- Fetch failure (backend unreachable, network error) → frontend shows an
  inline error message instead of crashing.
- Backend: if the Prisma/DB connection fails, `GET /api/news` returns `500`
  with a JSON error body. A basic Express error-handling middleware ensures
  unhandled errors don't crash the process.
- CORS: backend explicitly allows the frontend's origin
  (`http://localhost:5173`) rather than a wildcard.

## Testing

Scoped to match the bootstrap nature of this work (no business logic beyond
a passthrough query):

- A backend integration test hitting `GET /api/news` (against a test DB or a
  mocked Prisma client) verifying a `200` + array shape on success, and a
  `500` on simulated DB failure.
- No frontend tests in this pass — `NewsList` is a single fetch-and-render
  component with no branching logic yet worth testing. Add coverage later if
  the page grows (pagination, filtering, etc.).

## Out of Scope (for this pass)

- Live news ingestion from an external API/provider.
- Seed script / fixture data (test rows inserted manually).
- Pagination, filtering, search, or ticker-symbol tagging.
- Auto-refresh / polling on the frontend.
- Authentication/authorization.
