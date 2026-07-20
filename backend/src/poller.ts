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
