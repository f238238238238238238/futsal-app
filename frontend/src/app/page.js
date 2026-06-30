'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getEvents, getMatches, getNewsList, getSettings } from '@/lib/api';
import styles from './page.module.css';

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function getMatchResult(match) {
  const ourScore = match.ourScore ?? match.our_score ?? 0;
  const opponentScore = match.opponentScore ?? match.opponent_score ?? 0;
  if (ourScore > opponentScore) return 'win';
  if (ourScore < opponentScore) return 'loss';
  return 'draw';
}

export default function HomePage() {
  const [nextEvent, setNextEvent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heroImage, setHeroImage] = useState(null);

  const countdown = useCountdown(nextEvent?.date || nextEvent?.event_date);

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventsData, matchesData, newsData, settingsData] = await Promise.allSettled([
          getEvents(),
          getMatches(),
          getNewsList({ limit: 3 }),
          getSettings(),
        ]);

        // Settings (hero image)
        if (settingsData.status === 'fulfilled') {
          const s = settingsData.value?.settings || {};
          if (s.hero_image_base64) setHeroImage(s.hero_image_base64);
          else if (s.hero_image_url) setHeroImage(s.hero_image_url);
        }

        // Next event
        if (eventsData.status === 'fulfilled') {
          const events = eventsData.value?.events || eventsData.value || [];
          const now = new Date();
          const upcoming = events
            .filter(e => new Date(e.date || e.event_date) > now)
            .sort((a, b) => new Date(a.date || a.event_date) - new Date(b.date || b.event_date));
          if (upcoming.length > 0) setNextEvent(upcoming[0]);
        }

        // Recent matches
        if (matchesData.status === 'fulfilled') {
          const allMatches = matchesData.value?.matches || matchesData.value || [];
          setMatches(allMatches.slice(0, 3));
        }

        // News
        if (newsData.status === 'fulfilled') {
          const allNews = newsData.value?.news || newsData.value || [];
          setNews(allNews.slice(0, 3));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className={styles.hero} style={heroImage ? { backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className={styles.heroBackground}>
          {!heroImage && <div className={styles.heroPattern} />}
          <div className={styles.heroGradient} />
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleAccent}>FUMINTUS</span>
          </h1>
          <p className={styles.heroSubtitle}>Victory is a state of mind.</p>
          <div className={styles.heroCta}>
            <Link href="/matches" className="btn btnPrimary btnLarge">
              試合結果を見る
            </Link>
            <Link href="/players" className="btn btnSecondary btnLarge">
              選手一覧
            </Link>
          </div>
        </div>
        <div className={styles.heroScrollIndicator}>
          <span>Scroll</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* Next Match Section */}
      <section className={`${styles.section} ${styles.nextMatch}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Next Match</h2>
            <Link href="/attendance" className={styles.moreLink}>
              出欠登録 →
            </Link>
          </div>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : nextEvent ? (
            <div className={styles.nextMatchCard}>
              <div className={styles.nextMatchLabel}>次の試合</div>
              <div className={styles.nextMatchDate}>
                {new Date(nextEvent.date || nextEvent.event_date).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
                })}
              </div>
              <div className={styles.nextMatchInfo}>
                {nextEvent.title || nextEvent.name || '練習試合'}
                {nextEvent.location && ` | ${nextEvent.location}`}
              </div>
              <div className={styles.countdown}>
                <div className={styles.countdownItem}>
                  <span className={styles.countdownNumber}>{countdown.days}</span>
                  <span className={styles.countdownUnit}>Days</span>
                </div>
                <div className={styles.countdownItem}>
                  <span className={styles.countdownNumber}>{countdown.hours}</span>
                  <span className={styles.countdownUnit}>Hours</span>
                </div>
                <div className={styles.countdownItem}>
                  <span className={styles.countdownNumber}>{countdown.minutes}</span>
                  <span className={styles.countdownUnit}>Min</span>
                </div>
                <div className={styles.countdownItem}>
                  <span className={styles.countdownNumber}>{countdown.seconds}</span>
                  <span className={styles.countdownUnit}>Sec</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.noMatch}>次回の試合は未定です</div>
          )}
        </div>
      </section>

      {/* Recent Results Section */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Results</h2>
            <Link href="/matches" className={styles.moreLink}>
              もっと見る →
            </Link>
          </div>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : error ? (
            <p className={styles.error}>データの取得に失敗しました</p>
          ) : matches.length === 0 ? (
            <p className={styles.noMatch}>試合結果はまだありません</p>
          ) : (
            <div className={styles.resultsGrid}>
              {matches.map((match, i) => {
                const result = getMatchResult(match);
                const ourScore = match.ourScore ?? match.our_score ?? 0;
                const opponentScore = match.opponentScore ?? match.opponent_score ?? 0;
                return (
                  <div key={match.id || i} className={styles.resultCard} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className={styles.resultDate}>
                      {new Date(match.date || match.match_date).toLocaleDateString('ja-JP')}
                    </div>
                    <div className={styles.resultTeams}>
                      <span className={styles.resultTeamName}>FUMINTUS</span>
                      <span className={`${styles.resultScore} ${styles[`result${result.charAt(0).toUpperCase() + result.slice(1)}`]}`}>
                        {ourScore} - {opponentScore}
                      </span>
                      <span className={styles.resultTeamName}>{match.opponent || match.opponent_name || '対戦相手'}</span>
                    </div>
                    <div className={styles.resultCompetition}>{match.competition || match.tournament || ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* News Section */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>News</h2>
            <Link href="/news" className={styles.moreLink}>
              もっと見る →
            </Link>
          </div>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : news.length === 0 ? (
            <p className={styles.noMatch}>ニュースはまだありません</p>
          ) : (
            <div className={styles.newsGrid}>
              {news.map((item, i) => (
                <Link key={item.id || i} href={`/news/${item.id}`} className={styles.newsCard} style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className={styles.newsCategory}>{item.category || 'お知らせ'}</span>
                  <h3 className={styles.newsTitle}>{item.title}</h3>
                  <span className={styles.newsDate}>
                    {new Date(item.createdAt || item.created_at || item.date).toLocaleDateString('ja-JP')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
