# Market News App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a full-stack market news skeleton — Postgres + Node/Express/Prisma API + React frontend — runnable via a single `docker compose up`.

**Architecture:** Three docker-compose services (`postgres`, `backend`, `frontend`) on one network. Backend exposes `GET /api/news` backed by Prisma against a single `news_articles` table. Frontend fetches that endpoint on load and renders a list. No auth, pagination, ingestion, or seed data in this pass.

**Tech Stack:** Postgres 17, Node 20, Express, TypeScript, Prisma ORM, Vite, React, Vitest + Supertest.

## Global Constraints

- Postgres 17, exposed on host port `5432`.
- Backend: Node + Express + TypeScript + Prisma, listens on `4000`.
- Frontend: Vite + React + TypeScript, listens on `5173`.
- No auth, no pagination/filtering, no ticker/symbol tagging, no live ingestion, no seed script — test data is inserted manually.
- CORS: backend allows exactly `http://localhost:5173`, not a wildcard.
- No frontend automated tests in this pass (per spec, `NewsList` has no branching logic yet worth testing).
- All source directories bind-mounted into their containers for hot reload.

---

### Task 1: Docker Compose skeleton + Postgres service

**Files:**
- Create: `docker-compose.yml`
- Create: `.gitignore`

**Interfaces:**
- Produces: a running Postgres reachable at `localhost:5432` with user `news`, password `news`, database `news`. Later tasks depend on this connection.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17
    container_name: news-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: news
      POSTGRES_PASSWORD: news
      POSTGRES_DB: news
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 3: Start Postgres and verify it accepts connections**

Run: `docker compose up -d postgres && sleep 2 && docker compose exec postgres pg_isready -U news`
Expected: `/var/run/postgresql:5432 - accepting connections`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "Add docker-compose skeleton with Postgres service"
```

---

### Task 2: Backend scaffold + Prisma schema + migration

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/.env` (not committed)
- Create: `backend/.env.example`
- Create: `backend/src/db.ts`

**Interfaces:**
- Consumes: Postgres running at `localhost:5432` (Task 1).
- Produces: `news_articles` table in the `news` database. `prisma` singleton exported from `backend/src/db.ts` as `import { prisma } from './db'`, typed via generated `PrismaClient` with model `NewsArticle` (`id: number, headline: string, source: string, url: string, publishedAt: Date, createdAt: Date`).

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd backend && npm install`
Expected: installs cleanly, creates `backend/package-lock.json` and `backend/node_modules/`.

- [ ] **Step 3: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 5: Create `backend/.env` and `backend/.env.example`**

Both files get this content (`.env` is gitignored, `.env.example` is committed):

```
DATABASE_URL="postgresql://news:news@localhost:5432/news?schema=public"
```

- [ ] **Step 6: Run the initial migration**

Run: `cd backend && npx prisma migrate dev --name init`
Expected: creates `backend/prisma/migrations/<timestamp>_init/migration.sql` and reports "Your database is now in sync with your schema."

- [ ] **Step 7: Verify the table exists**

Run: `docker compose exec postgres psql -U news -d news -c "\d news_articles"`
Expected: output lists columns `id`, `headline`, `source`, `url`, `published_at`, `created_at`.

- [ ] **Step 8: Create `backend/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/prisma backend/.env.example backend/src/db.ts
git commit -m "Add backend scaffold with Prisma schema and initial migration"
```

---

### Task 3: `GET /api/news` endpoint (TDD)

**Files:**
- Create: `backend/src/routes/news.ts`
- Create: `backend/src/index.ts`
- Test: `backend/src/routes/news.test.ts`
- Create: `backend/vitest.config.ts`

**Interfaces:**
- Consumes: `prisma` from `backend/src/db.ts` (Task 2).
- Produces: `createApp(): Express` exported from `backend/src/index.ts`, used directly by tests and by the server bootstrap. Route mounted at `/api/news` returning `200` + `NewsArticle[]` JSON on success, `500` + `{ error: string }` on DB failure.

- [ ] **Step 1: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the failing test — `backend/src/routes/news.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db', () => ({
  prisma: {
    newsArticle: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db';
import { createApp } from '../index';

describe('GET /api/news', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and the array of articles on success', async () => {
    const articles = [
      {
        id: 1,
        headline: 'Fed holds rates steady',
        source: 'Reuters',
        url: 'https://example.com/1',
        publishedAt: '2026-07-19T00:00:00.000Z',
        createdAt: '2026-07-19T00:00:00.000Z',
      },
    ];
    (prisma.newsArticle.findMany as any).mockResolvedValue(articles);

    const app = createApp();
    const res = await request(app).get('/api/news');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(articles);
  });

  it('returns 500 when the database call fails', async () => {
    (prisma.newsArticle.findMany as any).mockRejectedValue(new Error('DB down'));

    const app = createApp();
    const res = await request(app).get('/api/news');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch news' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/routes/news.test.ts`
Expected: FAIL — cannot find module `../index` (and/or `../db` route file doesn't exist yet).

- [ ] **Step 4: Create `backend/src/routes/news.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../db';

export const newsRouter = Router();

newsRouter.get('/', async (_req, res) => {
  try {
    const articles = await prisma.newsArticle.findMany({
      orderBy: { publishedAt: 'desc' },
    });
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});
```

- [ ] **Step 5: Create `backend/src/index.ts`**

```ts
import express from 'express';
import cors from 'cors';
import { newsRouter } from './routes/news';

export function createApp() {
  const app = express();
  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use('/api/news', newsRouter);
  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/routes/news.test.ts`
Expected: both tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/vitest.config.ts backend/src/routes/news.ts backend/src/routes/news.test.ts backend/src/index.ts
git commit -m "Add GET /api/news endpoint with passing/failing DB tests"
```

---

### Task 4: Backend Docker wiring

**Files:**
- Create: `backend/Dockerfile`
- Modify: `docker-compose.yml` (add `backend` service)

**Interfaces:**
- Consumes: `backend/src/index.ts` (`createApp`, Task 3), Postgres service `postgres` (Task 1).
- Produces: `backend` container reachable at `localhost:4000`, running `GET /api/news` against the containerized Postgres.

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
```

- [ ] **Step 2: Modify `docker-compose.yml` to add the `backend` service**

Add this under `services:`, alongside `postgres`:

```yaml
  backend:
    build: ./backend
    container_name: news-backend
    restart: unless-stopped
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

- [ ] **Step 3: Build and start, verify the endpoint responds**

Run: `docker compose up -d --build backend && sleep 3 && curl -s http://localhost:4000/api/news`
Expected: `[]` (empty array — table exists, no rows yet).

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile docker-compose.yml
git commit -m "Wire backend into docker-compose"
```

---

### Task 5: Frontend scaffold + news list UI

**Files:**
- Create: `frontend/` (via Vite scaffold)
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/api/news.ts`
- Create: `frontend/src/components/NewsList.tsx`

**Interfaces:**
- Consumes: `GET http://localhost:4000/api/news` (Task 3/4), returning `NewsArticle[]` with fields `id, headline, source, url, publishedAt, createdAt`.
- Produces: `<NewsList />` component rendered by `App`, handling loading/empty/error states.

- [ ] **Step 1: Scaffold the Vite React+TS project**

Run: `npm create vite@latest frontend -- --template react-ts`
Expected: creates `frontend/` with the standard Vite React+TS template.

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: installs cleanly, creates `frontend/package-lock.json` and `frontend/node_modules/`.

- [ ] **Step 3: Create `frontend/src/api/news.ts`**

```ts
export interface NewsArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function fetchNews(): Promise<NewsArticle[]> {
  const res = await fetch(`${API_BASE_URL}/api/news`);
  if (!res.ok) {
    throw new Error(`Failed to fetch news: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Create `frontend/src/components/NewsList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { fetchNews, NewsArticle } from '../api/news';

export function NewsList() {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews()
      .then(setArticles)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p role="alert">Could not load news: {error}</p>;
  }

  if (articles === null) {
    return <p>Loading news...</p>;
  }

  if (articles.length === 0) {
    return <p>No news yet.</p>;
  }

  return (
    <ul>
      {articles.map((article) => (
        <li key={article.id}>
          <a href={article.url} target="_blank" rel="noreferrer">
            {article.headline}
          </a>
          {' — '}
          <span>{article.source}</span>
          {' · '}
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Replace `frontend/src/App.tsx`**

```tsx
import { NewsList } from './components/NewsList';

function App() {
  return (
    <main>
      <h1>Market News</h1>
      <NewsList />
    </main>
  );
}

export default App;
```

- [ ] **Step 6: Manually verify against the running backend**

Run: `docker compose up -d backend` (from Task 4, should already be up), then `cd frontend && npm run dev`, then open `http://localhost:5173` in a browser.
Expected: page shows "Market News" heading and "No news yet." (table is still empty).

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "Add frontend scaffold with NewsList component"
```

---

### Task 6: Frontend Docker wiring + full-stack verification

**Files:**
- Create: `frontend/Dockerfile`
- Modify: `frontend/vite.config.ts` (bind to `0.0.0.0` for container access)
- Modify: `docker-compose.yml` (add `frontend` service)

**Interfaces:**
- Consumes: `backend` service on `localhost:4000` (Task 4), `frontend/` app (Task 5).
- Produces: full stack runnable via `docker compose up`, reachable at `localhost:5173`.

- [ ] **Step 1: Modify `frontend/vite.config.ts` to bind all interfaces**

The Vite scaffold generates a file like:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

Change it to:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

- [ ] **Step 3: Modify `docker-compose.yml` to add the `frontend` service**

Add this under `services:`, alongside `postgres` and `backend`:

```yaml
  frontend:
    build: ./frontend
    container_name: news-frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
```

- [ ] **Step 4: Bring up the full stack**

Run: `docker compose up -d --build && docker compose ps`
Expected: `postgres`, `backend`, and `frontend` all show state `Up`/`running`.

- [ ] **Step 5: Insert a test article directly in Postgres**

Run:
```bash
docker compose exec postgres psql -U news -d news -c "INSERT INTO news_articles (headline, source, url, published_at) VALUES ('Fed holds interest rates steady', 'Reuters', 'https://example.com/fed-holds', now());"
```
Expected: `INSERT 0 1`.

- [ ] **Step 6: Verify the API and the page both reflect it**

Run: `curl -s http://localhost:4000/api/news`
Expected: JSON array containing the "Fed holds interest rates steady" article.

Then open `http://localhost:5173` in a browser.
Expected: the article's headline, source, and timestamp are visible in the list, headline links to the `url`.

- [ ] **Step 7: Commit**

```bash
git add frontend/Dockerfile frontend/vite.config.ts docker-compose.yml
git commit -m "Wire frontend into docker-compose; verify full stack end-to-end"
```
