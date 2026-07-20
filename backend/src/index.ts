import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { newsRouter } from './routes/news';

export function createApp() {
  const app = express();
  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use('/api/news', newsRouter);

  // Terminal error-handling middleware: a safety net for any error that
  // wasn't already caught and responded to upstream (e.g. by newsRouter's
  // own try/catch). Ensures unhandled errors don't crash the process.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}
