'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMatches, getMatch } from '@/lib/api';
import styles from './page.module.css';

export default function MatchesPage() {
  const currentYear = new Date().getFullYear();
  const YEARS = ['all', ...Array.from({ length: currentYear - 2021 }, (_, i) => String(currentYear - i))];

  const [matches, setMatches] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear)); // デフォルトは今年
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    getMatches(selectedYear)
      .then(data => setMatches(data.matches || data || []))
      .catch((err) => setErrorMsg(err.message || 'Error occurred'))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const toggleDetails = async (matchId) => {
    if (expandedId === matchId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(matchId);
    if (!details[matchId]) {
      try {
        const data = await getMatch(matchId);
        setDetails(prev => ({ ...prev, [matchId]: data.match || data }));
      } catch {}
    }
  };

  const getResult = (m) => {
    const us = m.our_score ?? 0;
    const them = m.opponent_score ?? 0;
    if (us > them) return 'win';
    if (us < them) return 'loss';
    return 'draw';
  };

  const resultLabel = (r) => r === 'win' ? '勝利' : r === 'loss' ? '敗北' : '引分';

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerBg} />
          <h1 className={styles.pageTitle}>MATCHES</h1>
          <p className={styles.pageSubtitle}>試合結果</p>
          <div className={styles.yearFilterWrapper}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className={styles.yearSelect}
            >
              <option value="all">すべての期間</option>
              {YEARS.filter(y => y !== 'all').map(y => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </div>
        </div>
        <div className="container">
          <div className={styles.loading}><div className={styles.spinner} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>MATCHES</h1>
        <p className={styles.pageSubtitle}>試合結果</p>
        <div className={styles.yearFilterWrapper}>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className={styles.yearSelect}
          >
            <option value="all">すべての期間</option>
            {YEARS.filter(y => y !== 'all').map(y => (
              <option key={y} value={y}>{y}年度</option>
            ))}
          </select>
        </div>
      </div>
      <div className="container">
        <div className={styles.matchList}>
          {matches.length === 0 ? (
            <p className={styles.empty}>試合データがありません</p>
          ) : (
            matches.map((match, i) => {
              const result = getResult(match);
              const isExpanded = expandedId === (match.match_id || match.id);
              const detail = details[match.match_id || match.id];
              return (
                <div
                  key={match.match_id || match.id || i}
                  className={`${styles.matchCard} ${styles[result]}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <button
                    className={styles.matchMain}
                    onClick={() => toggleDetails(match.match_id || match.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className={styles.matchLeft}>
                      <span className={styles.matchDate}>
                        {new Date(match.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className={styles.matchComp}>{match.competition_name || '練習試合'}</span>
                    </div>
                    <div className={styles.matchCenter}>
                      <span className={styles.teamName}>FUMINTUS</span>
                      <div className={styles.scoreBox}>
                        <span className={styles.score}>{match.our_score ?? 0}</span>
                        <span className={styles.scoreDivider}>-</span>
                        <span className={styles.score}>{match.opponent_score ?? 0}</span>
                      </div>
                      <span className={styles.teamName}>{match.opponent_name}</span>
                    </div>
                    <div className={styles.matchRight}>
                      <span className={`${styles.resultBadge} ${styles[`badge_${result}`]}`}>
                        {resultLabel(result)}
                      </span>
                      <span className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}>▼</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={styles.matchDetails}>
                      {!detail ? (
                        <div className={styles.detailLoading}><div className={styles.spinner} /></div>
                      ) : (
                        <>
                          {detail.summary_text && (
                            <div className={styles.detailSection}>
                              <h4 className={styles.detailLabel}>試合総括</h4>
                              <p className={styles.detailText}>{detail.summary_text}</p>
                            </div>
                          )}

                          {detail.mom_name && (
                            <div className={styles.detailSection}>
                              <h4 className={styles.detailLabel}>MOM (Man of the Match)</h4>
                              <div className={styles.momBadge}>⭐ {detail.mom_name}</div>
                            </div>
                          )}

                          {detail.stats && detail.stats.length > 0 && (
                            <div className={styles.detailSection}>
                              <h4 className={styles.detailLabel}>出場メンバー</h4>
                              <div className={styles.memberGrid}>
                                {detail.stats
                                  .sort((a, b) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0))
                                  .map((s, idx) => (
                                    <div key={idx} className={styles.memberItem}>
                                      <span className={`${styles.memberRole} ${s.is_starter ? styles.starter : styles.sub}`}>
                                        {s.is_starter ? 'ST' : 'SUB'}
                                      </span>
                                      <span className={styles.memberName}>{s.name || s.user_name}</span>
                                      {s.goals > 0 && <span className={styles.memberStat}>⚽{s.goals}</span>}
                                      {s.assists > 0 && <span className={styles.memberStat}>🅰️{s.assists}</span>}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                            <Link href={`/matches/${match.match_id || match.id}`} className={styles.moreLink} style={{ display: 'inline-block', padding: '0.5rem 1.5rem', background: 'var(--color-primary-500)', color: 'white', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}>
                              詳細フォーメーションを見る →
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
