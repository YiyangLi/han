# Finnhub News Poller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend polls Finnhub's news API every 60 seconds, keeps only market-relevant articles, and inserts new ones into `news_articles`, deduped by Finnhub's article id.

**Architecture:** A single new module `backend/src/poller.ts` exports `fetchAndStoreNews()` (one poll cycle: fetch → filter by category → map → `createMany` with `skipDuplicates`) and `startNewsPoller()` (immediate run + 60s `setInterval` with an in-flight guard). It is wired into the `require.main === module` block of `index.ts` — never `createApp()` — so tests and imports don't start it. Dedup rests on a new nullable-unique `finnhubId` column.

**Tech Stack:** Express + TypeScript backend, Prisma 5 / Postgres, native Node 20 `fetch`, Vitest for tests. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-07-19-finnhub-news-poller-design.md`

## Global Constraints

- No new npm dependencies — use native Node 20 `fetch`, not the `finnhub` SDK.
- `FINNHUB_TOKEN` is read from env; it lives in `backend/.env` (gitignored) locally and Railway service variables in production. Never hardcode or commit it.
- Kept article categories are exactly: `business`, `top news` (matched against each article's own `category` field, not the query param).
- Poll interval is exactly 60 000 ms; the Finnhub query URL is `https://finnhub.io/api/v1/news?category=business&token=...`.
- The poller must never crash the server: every cycle catches and logs its own errors.
- All backend commands run from `backend/`.

---

### Task 1: Add `finnhubId` column to the Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Creates (generated): `backend/prisma/migrations/<timestamp>_add_finnhub_id/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `NewsArticle.finnhubId: number | null`, unique — Task 2's `createMany` rows include `finnhubId` and rely on the unique constraint for `skipDuplicates` dedup.

- [ ] **Step 1: Add the column to the model**

In `backend/prisma/schema.prisma`, add one line to `model NewsArticle` (after `summary`):

```prisma
model NewsArticle {
  id          Int      @id @default(autoincrement())
  headline    String
  source      String
  url         String
  category    String
  summary     String
  finnhubId   Int?     @unique @map("finnhub_id")
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([publishedAt, id])
  @@map("news_articles")
}
```

Nullable (`Int?`) because existing hand-inserted rows have no Finnhub id and are not backfilled.

- [ ] **Step 2: Ensure Postgres is running, then create the migration**

Run:
```bash
docker compose up -d postgres   # from the repo root; skip if already running
cd backend
npx prisma migrate dev --name add_finnhub_id
```
Expected: output ends with `Your database is now in sync with your schema.` and a new directory `prisma/migrations/<timestamp>_add_finnhub_id/` containing SQL like `ALTER TABLE "news_articles" ADD COLUMN "finnhub_id" INTEGER; CREATE UNIQUE INDEX "news_articles_finnhub_id_key" ...`. `migrate dev` also regenerates the Prisma client, so `prisma.newsArticle.createMany` now accepts `finnhubId`.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm test` (in `backend/`)
Expected: 3 tests in `src/routes/news.test.ts` PASS.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add nullable-unique finnhubId column to NewsArticle"
```

---

### Task 2: `fetchAndStoreNews()` — one poll cycle (TDD)

**Files:**
- Create: `backend/src/poller.ts`
- Test: `backend/src/poller.test.ts`

**Interfaces:**
- Consumes: `prisma` singleton from `backend/src/db.ts` (mocked in tests, same `vi.mock` pattern as `src/routes/news.test.ts`); `NewsArticle.finnhubId` from Task 1; `process.env.FINNHUB_TOKEN`.
- Produces: `export async function fetchAndStoreNews(): Promise<void>` — Task 3's `startNewsPoller()` calls it once per cycle. It never throws.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/poller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./db', () => ({
  prisma: {
    newsArticle: {
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from './db';
import { fetchAndStoreNews } from './poller';

const createMany = prisma.newsArticle.createMany as ReturnType<typeof vi.fn>;

const businessArticle = {
  category: 'business',
  datetime: 1784525896,
  headline: 'Brent oil tops $90',
  id: 8241686,
  image: 'https://example.com/img.jpg',
  related: '',
  source: 'Reuters',
  summary: 'Oil climbs as strikes expand.',
  url: 'https://example.com/oil',
};

const topNewsArticle = {
  category: 'top news',
  datetime: 1784507632,
  headline: 'Stocks are working beyond tech',
  id: 8241580,
  image: '',
  related: '',
  source: 'CNBC',
  summary: 'Opportunities outside tech.',
  url: 'https://example.com/stocks',
};

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

describe('fetchAndStoreNews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FINNHUB_TOKEN = 'test-token';
    createMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests Finnhub business news with the token from env', async () => {
    const fetchSpy = mockFetch([]);
    await fetchAndStoreNews();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://finnhub.io/api/v1/news?category=business&token=test-token',
    );
  });

  it('stores kept-category articles mapped to NewsArticle rows with skipDuplicates', async () => {
    mockFetch([businessArticle, topNewsArticle]);
    await fetchAndStoreNews();
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          finnhubId: 8241686,
          headline: 'Brent oil tops $90',
          source: 'Reuters',
          url: 'https://example.com/oil',
          category: 'business',
          summary: 'Oil climbs as strikes expand.',
          publishedAt: new Date(1784525896 * 1000),
        },
        {
          finnhubId: 8241580,
          headline: 'Stocks are working beyond tech',
          source: 'CNBC',
          url: 'https://example.com/stocks',
          category: 'top news',
          summary: 'Opportunities outside tech.',
          publishedAt: new Date(1784507632 * 1000),
        },
      ],
      skipDuplicates: true,
    });
  });

  it('filters out articles whose own category is not kept', async () => {
    mockFetch([{ ...businessArticle, category: 'sport' }]);
    await fetchAndStoreNews();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('skips articles missing required fields', async () => {
    mockFetch([
      { ...businessArticle, id: undefined },
      { ...businessArticle, headline: undefined },
      { ...businessArticle, datetime: undefined },
    ]);
    await fetchAndStoreNews();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('does nothing on a non-200 response', async () => {
    mockFetch({ error: 'limit' }, false, 429);
    await fetchAndStoreNews();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(fetchAndStoreNews()).resolves.toBeUndefined();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('does not throw when the database insert fails', async () => {
    mockFetch([businessArticle]);
    createMany.mockRejectedValue(new Error('DB down'));
    await expect(fetchAndStoreNews()).resolves.toBeUndefined();
  });

  it('does nothing when the response body is not an array', async () => {
    mockFetch({ error: 'unexpected' });
    await fetchAndStoreNews();
    expect(createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/poller.test.ts` (in `backend/`)
Expected: FAIL — `Cannot find module './poller'` (or equivalent resolve error).

- [ ] **Step 3: Implement `fetchAndStoreNews`**

Create `backend/src/poller.ts`:

```typescript
import { prisma } from './db';

const FINNHUB_NEWS_URL = 'https://finnhub.io/api/v1/news?category=business';
const KEPT_CATEGORIES = new Set(['business', 'top news']);
const POLL_INTERVAL_MS = 60_000;

interface FinnhubArticle {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  source?: string;
  summary?: string;
  url?: string;
}

export async function fetchAndStoreNews(): Promise<void> {
  try {
    const res = await fetch(
      `${FINNHUB_NEWS_URL}&token=${process.env.FINNHUB_TOKEN}`,
    );
    if (!res.ok) {
      console.error(`News poll failed: Finnhub responded ${res.status}`);
      return;
    }
    const body: unknown = await res.json();
    if (!Array.isArray(body)) {
      console.error('News poll failed: unexpected Finnhub response shape');
      return;
    }
    const data = (body as FinnhubArticle[])
      .filter((a) => a.category !== undefined && KEPT_CATEGORIES.has(a.category))
      .filter(
        (a) =>
          a.id !== undefined &&
          a.datetime !== undefined &&
          a.headline !== undefined &&
          a.source !== undefined &&
          a.summary !== undefined &&
          a.url !== undefined,
      )
      .map((a) => ({
        finnhubId: a.id!,
        headline: a.headline!,
        source: a.source!,
        url: a.url!,
        category: a.category!,
        summary: a.summary!,
        publishedAt: new Date(a.datetime! * 1000),
      }));
    if (data.length === 0) {
      return;
    }
    await prisma.newsArticle.createMany({ data, skipDuplicates: true });
  } catch (err) {
    console.error('News poll failed:', err);
  }
}
```

(`POLL_INTERVAL_MS` is defined now but first used in Task 3.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/poller.test.ts` (in `backend/`)
Expected: 8 tests PASS. (TypeScript may warn that `POLL_INTERVAL_MS` is unused; that resolves in Task 3.)

- [ ] **Step 5: Run the full backend suite**

Run: `npm test` (in `backend/`)
Expected: all tests PASS (news route tests + poller tests).

- [ ] **Step 6: Commit**

```bash
git add src/poller.ts src/poller.test.ts
git commit -m "Add Finnhub poll cycle: fetch, filter categories, dedup by finnhubId"
```

---

### Task 3: `startNewsPoller()` wiring, compose env, docs

**Files:**
- Modify: `backend/src/poller.ts` (append `startNewsPoller`)
- Modify: `backend/src/index.ts` (the `require.main === module` block, currently lines 36-42)
- Modify: `docker-compose.yml` (backend service)
- Modify: `backend/CLAUDE.md`, `CLAUDE.md` (root)

**Interfaces:**
- Consumes: `fetchAndStoreNews()` from Task 2.
- Produces: `export function startNewsPoller(): void` — called only from `index.ts` under `require.main === module`, only when `FINNHUB_TOKEN` is set. Per the spec this is untested wiring; no new tests in this task.

- [ ] **Step 1: Append `startNewsPoller` to `backend/src/poller.ts`**

```typescript
export function startNewsPoller(): void {
  let inFlight = false;
  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await fetchAndStoreNews();
    } finally {
      inFlight = false;
    }
  };
  void run();
  setInterval(run, POLL_INTERVAL_MS);
}
```

The in-flight guard means a cycle slower than 60s causes the next tick to be skipped, never overlapped. `fetchAndStoreNews` never throws, so `run` can't leave `inFlight` stuck — the `try/finally` is belt-and-braces.

- [ ] **Step 2: Wire it into `backend/src/index.ts`**

Add to the imports at the top:

```typescript
import { startNewsPoller } from './poller';
```

Change the existing bottom block from:

```typescript
if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}
```

to:

```typescript
if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });

  if (process.env.FINNHUB_TOKEN) {
    startNewsPoller();
  } else {
    console.warn('FINNHUB_TOKEN not set; news poller disabled');
  }
}
```

Do NOT touch `createApp()` — the poller must not start when tests import the app.

- [ ] **Step 3: Pass the token through docker-compose**

In `docker-compose.yml`, add `env_file` to the backend service (keep the existing `environment:` block — its entries take precedence, so the compose `DATABASE_URL` still overrides the localhost one in `.env`):

```yaml
  backend:
    build: ./backend
    container_name: news-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      DATABASE_URL: postgresql://news:news@postgres:5432/news?schema=public
      PORT: "4000"
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - postgres
```

- [ ] **Step 4: Verify the suite still passes and the poller runs**

Run: `npm test` (in `backend/`)
Expected: all tests PASS.

Smoke test (from `backend/`, with the compose postgres up):
```bash
DATABASE_URL="postgresql://news:news@localhost:5432/news?schema=public" \
FINNHUB_TOKEN="$(grep FINNHUB_TOKEN .env | cut -d'"' -f2)" npm run dev
```
Expected: logs `Backend listening on port 4000` with no `news poller disabled` warning and no `News poll failed` errors. Then in another shell:
```bash
curl -s http://localhost:4000/api/news | head -c 600
```
Expected: JSON array containing recent Finnhub stories (fields include `finnhubId`). Stop the dev server afterwards.

- [ ] **Step 5: Update the CLAUDE.md files**

In `backend/CLAUDE.md`, add one bullet to the Architecture section after the `src/routes/news.ts` bullet:

```markdown
- `src/poller.ts` — Finnhub news poller: `fetchAndStoreNews()` (one cycle: fetch `category=business`, keep only articles whose own `category` is `business`/`top news`, insert via `createMany` + `skipDuplicates` deduped by the unique `finnhubId`) and `startNewsPoller()` (immediate run + 60s interval, in-flight guard). Started only from the `require.main` block in `index.ts` when `FINNHUB_TOKEN` is set — never from `createApp()`, so tests don't poll. Tests mock global `fetch` and the prisma singleton.
```

In the root `CLAUDE.md`, in the "What this is" section, replace:

```markdown
- Postgres 17 — single `news_articles` table. Articles are inserted manually (Prisma Studio or `psql`); there is no ingestion pipeline.
```

with:

```markdown
- Postgres 17 — single `news_articles` table. Articles are ingested by a backend poller that fetches Finnhub news every 60s (needs `FINNHUB_TOKEN` in `backend/.env` locally / Railway variables in prod), deduped by the unique `finnhubId` column.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/poller.ts backend/src/index.ts docker-compose.yml backend/CLAUDE.md CLAUDE.md
git commit -m "Start Finnhub news poller on boot and pass token through compose"
```
