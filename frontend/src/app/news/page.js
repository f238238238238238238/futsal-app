'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getNewsList } from '@/lib/api';
import styles from './page.module.css';

const CATEGORIES = ['すべて', '公式戦', '練習', 'イベント', 'お知らせ'];

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('すべて');

  useEffect(() => {
    setLoading(true);
    const params = activeCategory !== 'すべて' ? { category: activeCategory } : {};
    getNewsList(params)
      .then(data => setNews(data.news || data || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>NEWS</h1>
        <p className={styles.pageSubtitle}>最新ニュース</p>
      </div>

      <div className="container">
        <div className={styles.filters}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.filterBtn} ${activeCategory === cat ? styles.filterActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : news.length === 0 ? (
          <p className={styles.empty}>ニュースがありません</p>
        ) : (
          <div className={styles.newsList}>
            {news.map((item, i) => (
              <Link
                key={item.news_id || item.id || i}
                href={`/news/${item.news_id || item.id}`}
                className={styles.newsCard}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={styles.newsImage}>
                  <span className={styles.newsImagePlaceholder}>📰</span>
                </div>
                <div className={styles.newsBody}>
                  <div className={styles.newsMeta}>
                    {item.category && (
                      <span className={styles.newsCategory}>{item.category}</span>
                    )}
                    <span className={styles.newsDate}>
                      {new Date(item.created_at).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </span>
                  </div>
                  <h3 className={styles.newsTitle}>{item.title}</h3>
                  <p className={styles.newsExcerpt}>
                    {(item.content || '').replace(/<[^>]*>/g, '').slice(0, 100)}...
                  </p>
                </div>
                <div className={styles.newsArrow}>→</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
