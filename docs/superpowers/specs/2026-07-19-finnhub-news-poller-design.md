# Finnhub News Poller — Design

## Purpose

The backend polls Finnhub's general news API every minute, keeps only
market-relevant articles, and inserts new ones into the existing
`news_articles` table. This replaces manual insertion as the way articles
arrive. The frontend is unchanged — it keeps rendering the top 10 by
`publishedAt` desc, `id` desc.

## Data Source

`GET https://finnhub.io/api/v1/news?category=business&token=$FINNHUB_TOKEN`

Fetched with native Node 20 `fetch` (the `finnhub` npm SDK is
callback-based and adds nothing for a single GET). Response is an array of:

```json
{
  "category": "business",     // article's own category — can differ from the query param
  "datetime": 1784525896,      // unix seconds
  "headline": "...",
  "id": 8241800,               // unique per delivery; same story may recur under a new id
  "image": "...",
  "related": "",
  "source": "Reuters",
  "summary": "...",            // often ≈ headline for Google-News-relayed items
  "url": "..."
}
```

Observed behavior that shaped the design:

- The `category=business` query still returns strays (e.g. sports stories,
  articles tagged `"top news"`), so filtering must check each article's own
  `category` field.
- `id` is unique per delivery and catches exact re-fetches. The same story
  can reappear under a new `id`, and Google-News URLs differ per delivery.
  Decision: dedup by `id` only; headline-similarity matching is out of scope.

## Schema Change

One nullable-unique column on `NewsArticle`, via one Prisma migration:

```prisma
finnhubId Int? @unique @map("finnhub_id")
```

Nullable because the existing hand-inserted rows have no Finnhub id; they
are not backfilled.

## Poller Module — `backend/src/poller.ts`

Two exports:

**`fetchAndStoreNews()`** — one poll cycle, exported for testing:

1. Fetch the URL above. Non-200 or malformed JSON → log and return.
2. Filter to articles whose own `category` is in the kept set:
   `business`, `top news`.
3. Map to `NewsArticle` rows: `headline→headline`, `source→source`,
   `url→url`, `category→category`, `summary→summary`,
   `datetime` (unix seconds → `Date`) `→publishedAt`, `id→finnhubId`.
   Skip items missing any required field.
4. `prisma.newsArticle.createMany({ data, skipDuplicates: true })` — the
   unique `finnhubId` makes re-deliveries no-ops.

**`startNewsPoller()`** — runs one cycle immediately, then `setInterval`
every 60 seconds, with an in-flight guard so a slow cycle never overlaps
the next. Each cycle catches and logs its own errors; a failed poll never
crashes the server.

Wiring: called from the `require.main === module` block in `index.ts` —
NOT inside `createApp()` — so tests and imports never start the interval.
If `FINNHUB_TOKEN` is unset, log a warning and don't start the poller.

## Configuration

- `FINNHUB_TOKEN` — required for polling; read from env. Lives in
  `backend/.env` locally (gitignored) and in Railway service variables in
  production.
- docker-compose: add `env_file: ./backend/.env` to the backend service.
  Inline `environment:` entries take precedence over `env_file`, so the
  compose `DATABASE_URL` (pointing at the `postgres` service) still wins
  over the localhost URL in `.env`.

## Error Handling

- Per-cycle try/catch: one bad minute (network error, Finnhub outage,
  DB hiccup) is logged and skipped; the next cycle runs normally.
- HTTP non-200 and JSON parse failures are treated the same way.

## Testing

Vitest unit tests for `fetchAndStoreNews` with global `fetch` and the
Prisma client mocked (same `vi.mock('../db')` pattern as the news route
tests):

- filters out articles whose category is not in the kept set
- maps fields correctly, including unix seconds → `Date`
- calls `createMany` with `skipDuplicates: true`
- logs and returns without throwing on HTTP error / rejected fetch
- skips items missing required fields

No test starts the interval; `startNewsPoller` stays untested wiring.

## Out of Scope (YAGNI)

- Headline-similarity / fuzzy dedup (id-only was chosen)
- Retention or pruning (only new ids insert; growth is slow; the API
  serves only the top 10)
- Backfilling `finnhubId` on existing rows
- Making the category list or poll interval configurable
