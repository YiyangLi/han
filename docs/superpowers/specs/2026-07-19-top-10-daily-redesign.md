# Top 10 Daily UI Redesign — Design

## Purpose

Replace the plain bulleted news list with a dark, editorial "Top 10 Daily"
layout matching a provided design mockup (`Daily Market News (standalone).html`,
a Claude Artifact export). The redesign also upgrades the underlying data
from generic daily-digest headlines to 10 specific, real story-level market
news items with categories and summaries.

## Data Model

Extend `NewsArticle` with two new required fields:

```prisma
model NewsArticle {
  id          Int      @id @default(autoincrement())
  headline    String
  source      String
  url         String
  category    String
  summary     String
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("news_articles")
}
```

Sentiment (used only for tag color) is **not** stored. It is computed at
render time in the frontend from keywords in the headline/summary text:
words like "plunge," "slump," "falls," "loses," "slide," "drop" map to
negative/red; "beat," "top," "rise," "gain," "recover," "climb" map to
positive/green; anything else defaults to neutral/gray. This matches the
mockup's behavior, where the same category label (e.g. "Tech") appears in
different colors depending on whether that specific story is good or bad
news — the coloring is per-story, not per-category.

The existing 10 rows (generic "Stock market news for July N, 2026"
daily-digest links) are replaced with 10 specific real stories, each with
a genuine source URL:

1. Oil jumps above $91/barrel on US-Iran tensions (Energy, CNBC)
2. S&P 500, Nasdaq, Dow close lower, posting a weekly loss (Markets, CNBC)
3. Chipmakers slide into a bear market after Moonshot's AI model (Tech, Bloomberg)
4. Nvidia briefly loses its market-cap crown before recovering (Tech, TS2/Reuters)
5. Meta in talks to rent AI compute to Anthropic for up to $10B (AI, CNBC/NYT)
6. Netflix slumps on soft Q3 guidance (Earnings, Schwab)
7. IBM shares plunge 25% on weak profit warning (Earnings, CNBC)
8. Bank of America and Citigroup beat Q2 estimates (Banks, CNBC)
9. SpaceX shares fall below their $135 IPO price (IPOs, CNBC)
10. 10-year Treasury yield eases despite Middle East risk (Rates, CNBC)

## Visual Design

Full-page dark theme:
- Background `oklch(0.16 0.01 250)`, primary text `oklch(0.92 0.005 250)`
- Fonts: **Source Serif 4** (headlines, rank numbers) and **IBM Plex Sans**
  (body/UI text), loaded via a Google Fonts `<link>` in `index.html`
  (visually equivalent to the mockup's self-hosted woff2 files, far simpler
  to implement)
- Centered column, `max-width: 760px`, generous padding
- Header: "Top 10 Daily" (serif, bold, 34px) with today's date (uppercase,
  small, right-aligned) and a one-line subtitle
- Each story: large muted serif rank number ("01"–"10") + colored category
  pill + source name + serif headline (links to the real article, opens in
  a new tab) + summary paragraph, separated by thin borders
- Footer attribution line

## Components

- `frontend/src/api/news.ts` — `NewsArticle` interface gains `category` and
  `summary` fields; adds a small pure `deriveSentiment(headline, summary)`
  helper returning `'positive' | 'negative' | 'neutral'`, and a
  `sentimentColors` map from that result to `{ tagBg, tagColor }` oklch
  pairs matching the mockup.
- `frontend/src/components/NewsList.tsx` — rewritten to the new layout,
  including the header (title + date + subtitle) and footer, since both are
  tightly coupled to the list (date label, item count). Rank comes from
  array index, not stored data.
- `frontend/src/App.tsx` — becomes a thin wrapper rendering `<NewsList />`
  only (header/footer chrome moves into `NewsList`).
- `frontend/index.html` — adds the Google Fonts `<link>` tags.

## Data Flow

Unchanged: `GET /api/news` still returns all rows ordered by
`publishedAt desc`; the frontend still fetches once on mount and handles
loading/error/empty states the same way as before. The new `category` and
`summary` fields pass through automatically since the route already does an
unfiltered `findMany()`.

## Testing

The existing backend test (`news.test.ts`) has its mocked fixture data
updated to include `category` and `summary` fields, so it keeps reflecting
the real response shape — this is a shape update to an existing test, not
new test coverage, since no new backend behavior is introduced. No new
frontend tests are added, consistent with the original design's decision to
skip frontend test scaffolding for this bootstrap-stage app; `deriveSentiment`
is a small pure function whose correctness is verified by a human glance at
the rendered page (colors matching the mockup's mapping) rather than by unit
tests, since introducing a test harness for one helper function would be
disproportionate scope for this pass.

## Out of Scope

- Self-hosting the mockup's woff2 font files (Google Fonts CDN is used
  instead).
- Any change to ingestion, pagination, filtering, or auth.
- Storing sentiment as data (it is computed, not persisted).
