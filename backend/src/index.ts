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
