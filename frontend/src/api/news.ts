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
