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
