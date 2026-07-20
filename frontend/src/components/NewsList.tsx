import { useEffect, useState } from 'react';
import { fetchNews, type NewsArticle } from '../api/news';

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
