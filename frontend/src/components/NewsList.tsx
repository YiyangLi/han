import { useEffect, useState } from 'react';
import { deriveSentiment, fetchNews, sentimentColors, type NewsArticle } from '../api/news';

const dateLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function NewsList() {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews()
      .then(setArticles)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'oklch(0.16 0.01 250)',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: 'oklch(0.92 0.005 250)',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 100px' }}>
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderBottom: '1px solid oklch(0.32 0.01 250)',
            paddingBottom: 28,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <h1
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontWeight: 700,
                fontSize: 34,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Top 10 Daily
            </h1>
            <span
              style={{
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'oklch(0.65 0.01 250)',
              }}
            >
              {dateLabel}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 15, color: 'oklch(0.68 0.01 250)' }}>
            The ten market stories moving today, in plain language.
          </p>
        </header>

        {error && (
          <p role="alert" style={{ padding: '28px 0' }}>
            Could not load news: {error}
          </p>
        )}
        {!error && articles === null && <p style={{ padding: '28px 0' }}>Loading news...</p>}
        {!error && articles !== null && articles.length === 0 && (
          <p style={{ padding: '28px 0' }}>No news yet.</p>
        )}

        {articles?.map((article, index) => {
          const sentiment = deriveSentiment(article.headline, article.summary);
          const { tagBg, tagColor } = sentimentColors[sentiment];
          const rank = String(index + 1).padStart(2, '0');
          return (
            <article
              key={article.id}
              style={{
                display: 'flex',
                gap: 20,
                padding: '28px 0',
                borderBottom: '1px solid oklch(0.27 0.01 250)',
              }}
            >
              <div
                style={{
                  flex: 'none',
                  width: 40,
                  fontFamily: "'Source Serif 4', serif",
                  fontSize: 26,
                  fontWeight: 600,
                  color: 'oklch(0.5 0.01 250)',
                  lineHeight: 1,
                }}
              >
                {rank}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 3,
                      background: tagBg,
                      color: tagColor,
                    }}
                  >
                    {article.category}
                  </span>
                  <span style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)' }}>{article.source}</span>
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "'Source Serif 4', serif",
                    fontSize: 21,
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: 'oklch(0.94 0.005 250)',
                    textDecoration: 'none',
                  }}
                >
                  {article.headline}
                </a>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'oklch(0.75 0.01 250)' }}>
                  {article.summary}
                </p>
              </div>
            </article>
          );
        })}

        <footer style={{ marginTop: 36, paddingTop: 20, fontSize: 12, color: 'oklch(0.5 0.01 250)' }}>
          Summaries condensed from CNBC, Bloomberg, and Schwab market coverage. Links open the original
          reporting.
        </footer>
      </div>
    </div>
  );
}
