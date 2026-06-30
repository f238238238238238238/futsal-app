'use client';

import { useState, useEffect } from 'react';
import { getGoalRanking, getAssistRanking, getAttendanceRanking, getStaminaRanking, getSavesRanking, getImageUrl } from '@/lib/api';
import styles from './page.module.css';

const TABS = [
  { key: 'goals', label: '得点王', icon: '⚽', unit: 'ゴール' },
  { key: 'assists', label: 'アシスト王', icon: '🅰️', unit: 'アシスト' },
  { key: 'attendance', label: '出席王', icon: '📅', unit: '%' },
  { key: 'stamina', label: '体力王', icon: '💪', unit: '分' },
  { key: 'saves', label: 'セーブ王', icon: '🧤', unit: '回' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const fetchers = {
  goals: getGoalRanking,
  assists: getAssistRanking,
  attendance: getAttendanceRanking,
  stamina: getStaminaRanking,
  saves: getSavesRanking,
};

export default function RankingsPage() {
  const currentYear = new Date().getFullYear();
  const YEARS = ['all', ...Array.from({ length: currentYear - 2021 }, (_, i) => String(currentYear - i))];

  const [activeTab, setActiveTab] = useState('goals');
  const [selectedYear, setSelectedYear] = useState(String(currentYear)); // デフォルトは今年
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 変更があったらデータをクリアして再取得
  useEffect(() => {
    // yearが変わったらキャッシュをクリアするか、あるいは year 別のキーで管理する
    setData({});
  }, [selectedYear]);

  useEffect(() => {
    const cacheKey = `${activeTab}-${selectedYear}`;
    if (data[cacheKey]) return;

    setLoading(true);
    fetchers[activeTab](selectedYear)
      .then(res => {
        const rankings = res.ranking || res.rankings || (Array.isArray(res) ? res : []);
        setData(prev => ({ ...prev, [cacheKey]: rankings }));
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Error occurred');
        setData(prev => ({ ...prev, [cacheKey]: [] }));
      })
      .finally(() => setLoading(false));
  }, [activeTab, selectedYear, data]);

  const cacheKey = `${activeTab}-${selectedYear}`;
  const rawRankings = data[cacheKey] || [];
  const tab = TABS.find(t => t.key === activeTab);

  const getValue = (item) => {
    if (activeTab === 'goals') return item.total_goals ?? item.goals ?? 0;
    if (activeTab === 'assists') return item.total_assists ?? item.assists ?? 0;
    if (activeTab === 'attendance') return item.attendance_rate != null ? Math.round(item.attendance_rate) : (item.rate ?? 0);
    if (activeTab === 'stamina') return item.total_minutes ?? item.full_matches ?? item.stamina ?? 0;
    if (activeTab === 'saves') return item.total_saves ?? item.saves ?? 0;
    return 0;
  };

  let currentRank = 1;
  let previousValue = null;
  const rankings = rawRankings.map((item, index) => {
    const val = getValue(item);
    if (val !== previousValue) {
      currentRank = index + 1;
      previousValue = val;
    }
    return { ...item, displayRank: currentRank };
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>RANKINGS</h1>
        <p className={styles.pageSubtitle}>チーム内ランキング</p>
        
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
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span className={styles.tabIcon}>{t.icon}</span>
              <span className={styles.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : rankings.length === 0 ? (
          <p className={styles.empty}>データがありません</p>
        ) : (
          <div className={styles.rankingContent}>
            {/* Top 3 podium */}
            <div className={styles.podium}>
              {rankings.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  className={`${styles.podiumCard} ${styles[`podium${i + 1}`]}`}
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <div className={styles.podiumMedal} style={{ color: MEDAL_COLORS[item.displayRank - 1] || '#ccc' }}>
                    {item.displayRank === 1 ? '👑' : item.displayRank === 2 ? '🥈' : item.displayRank === 3 ? '🥉' : ''}
                  </div>
                  <div className={styles.podiumRank} style={{ color: MEDAL_COLORS[item.displayRank - 1] || '#ccc' }}>
                    {item.displayRank}
                  </div>
                  <div className={styles.podiumAvatar}>
                    {item.photo_url ? (
                      <img src={getImageUrl(item.photo_url)} alt={item.name} className={styles.avatarImg} />
                    ) : (
                      <span className={styles.podiumJersey}>#{item.jersey_number ?? '-'}</span>
                    )}
                  </div>
                  <h3 className={styles.podiumName}>{item.name}</h3>
                  <span className={styles.podiumPosition}>{item.position || '-'}</span>
                  <div className={styles.podiumValue}>
                    <span className={styles.podiumNumber}>{getValue(item)}</span>
                    <span className={styles.podiumUnit}>{tab.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 4th and below */}
            {rankings.length > 3 && (
              <div className={styles.restList}>
                {rankings.slice(3).map((item, i) => (
                  <div
                    key={i}
                    className={styles.restItem}
                    style={{ animationDelay: `${(i + 3) * 0.05}s` }}
                  >
                    <span className={styles.restRank}>{item.displayRank}</span>
                    <div className={styles.restAvatar}>
                      {item.photo_url ? (
                        <img src={getImageUrl(item.photo_url)} alt={item.name} className={styles.avatarImgSmall} />
                      ) : (
                        <span className={styles.restJersey}>#{item.jersey_number ?? '-'}</span>
                      )}
                    </div>
                    <span className={styles.restName}>{item.name}</span>
                    <span className={styles.restPosition}>{item.position || '-'}</span>
                    <span className={styles.restValue}>
                      {getValue(item)} <small>{tab.unit}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
