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

function pad(n) {
  return String(n).padStart(2, '0');
}

function getMatchResult(match) {
  const ourScore = match.ourScore ?? match.our_score ?? 0;
  const opponentScore = match.opponentScore ?? match.opponent_score ?? 0;
  if (ourScore > opponentScore) return 'win';
  if (ourScore < opponentScore) return 'loss';
  return 'draw';
}

function matchId(match) {
  return match.match_id || match.id;
}

export default function HomePage() {
  const [nextEvent, setNextEvent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroImages, setHeroImages] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const countdown = useCountdown(nextEvent?.date || nextEvent?.event_date || nextEvent?.date_time);

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventsData, matchesData, newsData, settingsData] = await Promise.allSettled([
          getEvents(),
          getMatches(),
          getNewsList({ limit: 3 }),
          getSettings(),
        ]);

        if (settingsData.status === 'fulfilled') {
          const s = settingsData.value?.settings || {};
          let images = [];
          if (s.hero_images) {
            try { images = JSON.parse(s.hero_images); } catch (e) { /* ignore */ }
          } else if (s.hero_image_base64) {
            images = [s.hero_image_base64];
          } else if (s.hero_image_url) {
            images = [s.hero_image_url];
          }
          setHeroImages(images);
        }

        if (eventsData.status === 'fulfilled') {
          const events = eventsData.value?.events || eventsData.value || [];
          const now = new Date();
          const upcoming = events
            .filter(e => new Date(e.date || e.event_date || e.date_time) > now)
            .sort((a, b) =>
              new Date(a.date || a.event_date || a.date_time) - new Date(b.date || b.event_date || b.date_time)
            );
          if (upcoming.length > 0) setNextEvent(upcoming[0]);
        }

        if (matchesData.status === 'fulfilled') {
          const allMatches = matchesData.value?.matches || matchesData.value || [];
          setMatches(allMatches.slice(0, 3));
        }

        if (newsData.status === 'fulfilled') {
          const allNews = newsData.value?.news || newsData.value || [];
          setNews(allNews.slice(0, 3));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroImages]);

  const featured = matches[0];
  const restMatches = matches.slice(1);

  return (
    <>
      <section className={styles.hero}>
        {heroImages.length > 0 ? (
          heroImages.map((img, i) => (
            <div
              key={i}
              className={styles.heroBackground}
              style={{
                backgroundImage: `url(${img})`,
                opacity: i === currentSlide ? 1 : 0,
              }}
            />
          ))
        ) : (
          <div className={styles.heroBackground}>
            <div className={styles.heroStripes} />
          </div>
        )}
        <div className={styles.heroGradient} />
        <div className={styles.heroRail} aria-hidden="true" />

        <div className={styles.heroContent}>
          <p className={styles.heroKicker}>Official club</p>
          <h1 className={styles.heroTitle}>FUMINTUS</h1>
          <p className={styles.heroSubtitle}>Victory is a state of mind.</p>
          <div className={styles.heroCta}>
            <Link href="/matches" className="btn btnPrimary">試合結果</Link>
            <Link href="/players" className="btn btnSecondary">選手一覧</Link>
          </div>
        </div>
      </section>

      <section className={styles.fixture}>
        <div className="container">
          <div className={styles.fixtureHead}>
            <div>
              <p className={styles.sectionKicker}>Next fixture</p>
              <h2 className={styles.fixtureTitle}>次の試合</h2>
            </div>
            <Link href="/attendance" className={styles.moreLink}>出欠を登録</Link>
          </div>

          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : nextEvent ? (
            <div className={styles.fixtureBoard}>
              <div className={styles.fixtureMeta}>
                {new Date(nextEvent.date || nextEvent.event_date || nextEvent.date_time).toLocaleDateString('ja-JP', {
                  weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                })}
                {nextEvent.location ? `  ·  ${nextEvent.location}` : ''}
              </div>
              <div className={styles.fixtureTeams}>
                <span className={styles.fixtureUs}>FUMINTUS</span>
                <span className={styles.fixtureVs}>vs</span>
                <span className={styles.fixtureThem}>
                  {nextEvent.title || nextEvent.name || '対戦相手未定'}
                </span>
              </div>
              <div className={styles.countdown}>
                {[
                  [pad(countdown.days), 'Days'],
                  [pad(countdown.hours), 'Hrs'],
                  [pad(countdown.minutes), 'Min'],
                  [pad(countdown.seconds), 'Sec'],
                ].map(([num, unit]) => (
                  <div key={unit} className={styles.countdownItem}>
                    <span className={styles.countdownNumber}>{num}</span>
                    <span className={styles.countdownUnit}>{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.empty}>次戦はまだ組まれていません</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Latest</p>
              <h2 className={styles.sectionTitle}>Results</h2>
            </div>
            <Link href="/matches" className={styles.moreLink}>すべての試合</Link>
          </div>

          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : matches.length === 0 ? (
            <p className={styles.empty}>試合結果はまだありません</p>
          ) : (
            <div className={styles.results}>
              {featured && (
                <Link
                  href={`/matches/${matchId(featured)}`}
                  className={`${styles.featured} ${styles[getMatchResult(featured)]}`}
                >
                  <div className={styles.featuredMeta}>
                    <span>
                      {new Date(featured.date || featured.match_date).toLocaleDateString('ja-JP', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                    <span>{featured.competition_name || featured.competition || featured.tournament || 'Friendly'}</span>
                  </div>
                  <div className={styles.featuredRow}>
                    <span className={styles.featuredTeam}>FUMINTUS</span>
                    <span className={styles.featuredScore}>
                      {featured.ourScore ?? featured.our_score ?? 0}
                    </span>
                  </div>
                  <div className={styles.featuredRow}>
                    <span className={styles.featuredTeamMuted}>
                      {featured.opponent || featured.opponent_name || '対戦相手'}
                    </span>
                    <span className={styles.featuredScoreMuted}>
                      {featured.opponentScore ?? featured.opponent_score ?? 0}
                    </span>
                  </div>
                </Link>
              )}

              <div className={styles.resultStack}>
                {restMatches.map((match) => {
                  const result = getMatchResult(match);
                  return (
                    <Link
                      key={matchId(match)}
                      href={`/matches/${matchId(match)}`}
                      className={`${styles.resultRow} ${styles[result]}`}
                    >
                      <span className={styles.resultDate}>
                        {new Date(match.date || match.match_date).toLocaleDateString('ja-JP', {
                          month: 'numeric', day: 'numeric',
                        })}
                      </span>
                      <span className={styles.resultUs}>FUMINTUS</span>
                      <span className={styles.resultScoreline}>
                        {match.ourScore ?? match.our_score ?? 0}
                        <span>–</span>
                        {match.opponentScore ?? match.opponent_score ?? 0}
                      </span>
                      <span className={styles.resultThem}>
                        {match.opponent || match.opponent_name || '対戦相手'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.section} ${styles.newsSection}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Club</p>
              <h2 className={styles.sectionTitle}>News</h2>
            </div>
            <Link href="/news" className={styles.moreLink}>すべてのニュース</Link>
          </div>

          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : news.length === 0 ? (
            <p className={styles.empty}>ニュースはまだありません。公開されるとここに並びます。</p>
          ) : (
            <div className={styles.newsList}>
              {news.map((item) => (
                <Link
                  key={item.news_id || item.id}
                  href={`/news/${item.news_id || item.id}`}
                  className={styles.newsRow}
                >
                  <span className={styles.newsCat}>{item.category || 'お知らせ'}</span>
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
