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
