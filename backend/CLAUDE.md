# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Express + TypeScript + Prisma (Postgres) API. See the root `CLAUDE.md` for how this fits with the frontend and deployment.

## Commands

```bash
npm run dev                        # ts-node-dev with hot reload (needs DATABASE_URL)
npm run build                      # tsc → dist/
npm test                           # vitest run (all tests)
npx vitest run src/routes/news.test.ts   # single test file
npx vitest run -t "returns 500"    # single test by name
npx prisma migrate dev --name <name>     # create + apply a migration after editing schema.prisma
npx prisma studio                  # browse/insert articles manually
```

Tests mock the Prisma client entirely (`vi.mock('../db')`), so they need no database and no `DATABASE_URL`.

## Architecture

- `src/index.ts` exports `createApp()` (the Express app factory) and only calls `app.listen` under `require.main === module`. Tests import `createApp` and drive it with supertest — keep new setup inside `createApp()` so it stays testable.
- `src/db.ts` is the Prisma client singleton. Routes import `prisma` from here, never construct their own client — the test mock targets this module.
- `src/routes/news.ts` — the only route: `GET /api/news` returns the top 10 articles ordered by `publishedAt` desc, `id` desc (backed by the `@@index([publishedAt, id])`). Routes catch their own errors and respond 500; the middleware in `index.ts` is only a last-resort net.
- `createApp()` also serves `../public` statically if it exists — that directory only exists in the production image (built frontend). Don't create a `public/` dir in dev.

## Prisma conventions

- DB names are snake_case via `@map`/`@@map` (`news_articles`, `published_at`); model fields are camelCase.
- `postinstall` runs `prisma generate`; migrations are applied by `prisma migrate deploy` at container startup, not at build time.
- Schema changes ripple to the frontend's hand-written `NewsArticle` interface (`frontend/src/api/news.ts`) and to the test fixtures in `news.test.ts`.
