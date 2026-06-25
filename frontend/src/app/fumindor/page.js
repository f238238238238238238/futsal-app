'use client';

import { useState, useEffect } from 'react';
import { getFumindor } from '@/lib/api';
import styles from './page.module.css';
import Link from 'next/link';

export default function FumindorPage() {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAwards() {
      try {
        const data = await getFumindor();
        setAwards(data.awards || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAwards();
  }, []);

  if (loading) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>FUMINDOR</h1>
        <p className={styles.subtitle}>ANNUAL MVP AWARDS</p>
      </div>

      <div className={`container ${styles.container}`}>
        {awards.length === 0 ? (
          <p className={styles.empty}>受賞記録がありません</p>
        ) : (
          <div className={styles.timeline}>
            {awards.map((award, index) => (
              <div key={award.fumindor_id} className={styles.card} style={{ animationDelay: `${index * 0.15}s` }}>
                <div className={styles.yearCol}>
                  <div className={styles.year}>{award.year}</div>
                </div>
                <div className={styles.contentCol}>
                  <div className={styles.playerInfo}>
                    <span className={styles.jersey}>#{award.jersey_number}</span>
                    <Link href={`/players/${award.user_id}`} className={styles.playerName}>
                      {award.name}
                    </Link>
                    <span className={styles.position}>{award.position}</span>
                  </div>
                  
                  <div className={styles.stats}>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{award.matches_played}</span>
                      <span className={styles.statLabel}>出場数</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{award.goals}</span>
                      <span className={styles.statLabel}>ゴール</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{award.assists}</span>
                      <span className={styles.statLabel}>アシスト</span>
                    </div>
                  </div>

                  {award.description && (
                    <p className={styles.description}>{award.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
