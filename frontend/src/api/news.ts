export interface NewsArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  category: string;
  summary: string;
  publishedAt: string;
  createdAt: string;
}

export type Sentiment = 'positive' | 'negative' | 'neutral';

const POSITIVE_KEYWORDS = [
  'recover', 'beat', 'beats', 'top', 'tops', 'climb', 'climbs', 'gain', 'gains', 'rise', 'rises',
];
const NEGATIVE_KEYWORDS = [
  'plunge', 'plunges', 'slump', 'slumps', 'slide', 'slides', 'tumble', 'tumbles',
  'fall', 'falls', 'drop', 'drops', 'lower', 'loss', 'losses', 'warn', 'warning',
  'warns', 'bear market', 'tension', 'tensions', 'weaker', 'disappoint', 'disappoints',
];

export function deriveSentiment(headline: string, summary: string): Sentiment {
  const text = `${headline} ${summary}`.toLowerCase();
  const hasPositive = POSITIVE_KEYWORDS.some((kw) => text.includes(kw));
  const hasNegative = NEGATIVE_KEYWORDS.some((kw) => text.includes(kw));
  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';
  return 'neutral';
}

export const sentimentColors: Record<Sentiment, { tagBg: string; tagColor: string }> = {
  positive: { tagBg: 'oklch(0.32 0.09 145 / 0.3)', tagColor: 'oklch(0.75 0.13 145)' },
  negative: { tagBg: 'oklch(0.32 0.09 25 / 0.35)', tagColor: 'oklch(0.78 0.12 30)' },
  neutral: { tagBg: 'oklch(0.3 0.03 250 / 0.4)', tagColor: 'oklch(0.75 0.03 250)' },
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function fetchNews(): Promise<NewsArticle[]> {
  const res = await fetch(`${API_BASE_URL}/api/news`);
  if (!res.ok) {
    throw new Error(`Failed to fetch news: ${res.status}`);
  }
  return res.json();
}
