'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getNewsItem } from '@/lib/api';
import styles from './page.module.css';

export default function NewsDetailPage() {
  const params = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    getNewsItem(params.id)
      .then(data => setArticle(data.news || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.loading}><div className={styles.spinner} /></div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.notFound}>記事が見つかりませんでした</p>
          <Link href="/news" className={styles.backLink}>← ニュース一覧に戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/news" className={styles.backLink}>← ニュース一覧に戻る</Link>

        <article className={styles.article}>
          <div className={styles.articleMeta}>
            {article.category && (
              <span className={styles.category}>{article.category}</span>
            )}
            <time className={styles.date}>
              {new Date(article.created_at).toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </time>
          </div>

          <h1 className={styles.articleTitle}>{article.title}</h1>

          <div className={styles.goldDivider} />

          <div
            className={styles.articleContent}
            dangerouslySetInnerHTML={{ __html: article.content || '' }}
          />
        </article>
      </div>
    </div>
  );
}
