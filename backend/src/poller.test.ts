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
        }
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
