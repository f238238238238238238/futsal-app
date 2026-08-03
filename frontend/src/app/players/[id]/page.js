'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getPlayer, getImageUrl } from '@/lib/api';
import styles from './page.module.css';

const POSITION_CLASSES = {
  'ゴレイロ': 'posGoleiro',
  'フィクソ': 'posFixo',
  'アラ': 'posAla',
  'ピヴォ': 'posPivo',
};

function RadarChart({ stats, labels, size = 220 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const numAxes = stats.length;
  const angleStep = (Math.PI * 2) / numAxes;
  const offset = -Math.PI / 2;

  const getPoint = (i, value) => {
    const angle = offset + i * angleStep;
    const ratio = value / 100;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = stats.map((v, i) => getPoint(i, v));
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={styles.radarSvg}>
      {/* Grid */}
      {gridLevels.map((level, li) => (
        <polygon
          key={li}
          points={Array.from({ length: numAxes }, (_, i) => {
            const angle = offset + i * angleStep;
            return `${cx + r * level * Math.cos(angle)},${cy + r * level * Math.sin(angle)}`;
          }).join(' ')}
          className={styles.radarGrid}
        />
      ))}
      {/* Axes */}
      {Array.from({ length: numAxes }, (_, i) => {
        const angle = offset + i * angleStep;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            className={styles.radarAxis}
          />
        );
      })}
      {/* Data polygon */}
      <polygon points={polygon} className={styles.radarData} />
      <polygon points={polygon} className={styles.radarDataStroke} />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" className={styles.radarDot} />
      ))}
      {/* Labels */}
      {labels.map((label, i) => {
        const angle = offset + i * angleStep;
        const lx = cx + (r + 26) * Math.cos(angle);
        const ly = cy + (r + 26) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} className={styles.radarLabel} textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
        );
      })}
      {/* Values */}
      {stats.map((val, i) => {
        const p = getPoint(i, val);
        return (
          <text key={`v${i}`} x={p.x} y={p.y - 10} className={styles.radarValue} textAnchor="middle">
            {val}
          </text>
        );
      })}
    </svg>
  );
}

function formatSalary(amount) {
  if (!amount) return '-';
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億円`;
  if (amount >= 10000) return `${Math.round(amount / 10000)}万円`;
  return `${amount.toLocaleString()}円`;
}

export default function PlayerDetailPage({ params }) {
  const { id } = use(params);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYearState, setSelectedYearState] = useState(null);

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const data = await getPlayer(id);
        setPlayer(data.user || data.player || data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayer();
  }, [id]);

  if (loading) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>;
  }

  if (error || !player) {
    return <div className={styles.error}>{error || '選手が見つかりません'}</div>;
  }

  const availableYears = player?.yearlyStats?.map(s => s.year).sort((a,b) => b - a) || [];
  const defaultYear = availableYears.length > 0 ? availableYears[0].toString() : new Date().getFullYear().toString();
  const selectedYear = selectedYearState || defaultYear;

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const computedAge = calculateAge(player.birth_date);
  const ageDisplay = computedAge !== null ? `${computedAge}歳` : (player.age ? `${player.age}歳` : '-');

  const number = player.number ?? player.jersey_number ?? '-';
  
  const latestSalary = player.salaries && player.salaries.length > 0 
    ? player.salaries[0].salary 
    : player.salary;

  const infoItems = [
    { icon: '🥅', label: 'ポジション', value: player.position || '-' },
    { icon: '📏', label: '身長', value: player.height ? `${player.height}cm` : '-' },
    { icon: '⚖️', label: '体重', value: player.weight ? `${player.weight}kg` : '-' },
    { icon: '🎂', label: '年齢', value: ageDisplay },
    { icon: '🦶', label: '利き足', value: player.dominant_foot || player.foot || '-' },
    { icon: '💰', label: '年俸', value: formatSalary(latestSalary) },
  ];

  const selectedYearStat = player.yearlyStats?.find(s => s.year.toString() === selectedYear);

  // Decide if we should show Goalkeeping
  const hasGK = selectedYearStat?.calculated_goalkeeping > 0;
  const statLabels = hasGK 
    ? ['オフェンス', 'テクニック', 'ディフェンス', 'スピード', 'スタミナ', 'キーパー力']
    : ['オフェンス', 'テクニック', 'ディフェンス', 'スピード', 'スタミナ'];
  
  const currentStats = hasGK
    ? [
        selectedYearStat?.calculated_offense ?? player.stat_offense ?? 50,
        selectedYearStat?.calculated_technique ?? player.stat_technique ?? 50,
        selectedYearStat?.calculated_defense ?? player.stat_defense ?? 50,
        selectedYearStat?.calculated_speed ?? player.stat_speed ?? 75,
        selectedYearStat?.calculated_stamina ?? player.stat_stamina ?? 50,
        selectedYearStat?.calculated_goalkeeping ?? 0,
      ]
    : [
        selectedYearStat?.calculated_offense ?? player.stat_offense ?? 50,
        selectedYearStat?.calculated_technique ?? player.stat_technique ?? 50,
        selectedYearStat?.calculated_defense ?? player.stat_defense ?? 50,
        selectedYearStat?.calculated_speed ?? player.stat_speed ?? 75,
        selectedYearStat?.calculated_stamina ?? player.stat_stamina ?? 50,
      ];

  const profileItems = [
    { label: 'キャッチコピー', value: player.catchphrase || player.catch_copy },
    { label: 'フットサルを始めたきっかけ', value: player.motivation || player.reason_started },
    { label: '趣味', value: player.hobby || player.hobbies },
    { label: '今シーズンの意気込み', value: player.aspiration || player.season_goal },
    { label: 'スパイク', value: player.spike || player.favorite_shoes },
  ].filter(item => item.value);

  return (
    <div className={styles.page}>
      {/* Profile Header */}
      <section className={styles.profileHeaderSection}>
        <div className="container">
          <Link href="/players" className={styles.backLink}>
            ← 選手一覧に戻る
          </Link>
          
          <div className={styles.playerHeaderTop}>
            <div className={styles.playerMetaTop}>
              <span className={styles.jerseyNumber}>#{number}</span>
              <span className={`${styles.positionBadge} ${POSITION_CLASSES[player.position] || ''}`}>
                {player.position || '-'}
              </span>
            </div>
            <h1 className={styles.playerNameTop}>{player.name}</h1>
          </div>

          <div className={styles.profileHeaderContainer}>
            {/* Left Column: Portrait */}
            <div className={styles.portraitWrapper}>
              <div className={styles.portraitBgNumber}>{number}</div>
              {player.photo_url ? (
                <img src={getImageUrl(player.photo_url)} alt={player.name} className={styles.portraitPhoto} />
              ) : (
                <div className={styles.portraitPlaceholder} />
              )}
            </div>

            {/* Right Column: Info */}
            <div className={styles.infoWrapper}>
              <div className={styles.basicInfoArea}>
                <div className={styles.infoGrid2Col}>
                  {infoItems.map((item, i) => (
                    <div key={i} className={styles.infoCard} style={{ animationDelay: `${i * 0.1}s` }}>
                      <div className={styles.infoIcon}>{item.icon}</div>
                      <div className={styles.infoLabel}>{item.label}</div>
                      <div className={styles.infoValue}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`container ${styles.statsSection}`}>
        {/* Performance By Year */}
        <h2 className={styles.sectionTitle}>成績統計</h2>
        <div className={styles.statsScrollWrap}>
          <div className={styles.statsYearContainer}>
            {player.yearlyStats && player.yearlyStats.length > 0 ? (
              player.yearlyStats.map((stat, i) => (
                <div key={stat.year} className={styles.yearCard} style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className={styles.yearHeader}>{stat.year}年度</div>
                  <div className={styles.yearGrid}>
                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>出場試合数</span>
                      <span className={styles.yearStatValue}>{stat.matches_played}</span>
                    </div>
                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>ゴール</span>
                      <span className={styles.yearStatValue}>{stat.goals}</span>
                    </div>
                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>アシスト</span>
                      <span className={styles.yearStatValue}>{stat.assists}</span>
                    </div>
                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>セーブ</span>
                      <span className={styles.yearStatValue}>{stat.saves}</span>
                    </div>

                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>出席率</span>
                      <span className={styles.yearStatValue}>{Math.round(stat.attendance_rate)}%</span>
                    </div>
                    <div className={styles.yearStat}>
                      <span className={styles.yearStatLabel}>年俸</span>
                      <span className={styles.yearStatValue}>{formatSalary(player.salaries?.find(s => s.year === stat.year)?.salary ?? player.salary)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.perfCard}>
                <div className={styles.perfNumber}>{player.total_matches_played ?? player.matches_played ?? 0}</div>
                <div className={styles.perfLabel}>出場試合数</div>
              </div>
            )}
          </div>
        </div>

        {/* Radar Chart & FIFA Style Attributes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>能力チャート</h2>
          {availableYears.length > 0 && (
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYearState(e.target.value)}
              style={{
                background: 'var(--color-dark-800)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-gold)',
                padding: '5px 10px',
                borderRadius: '4px',
                outline: 'none'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          )}
        </div>
        
        <div className={styles.statsRow}>
          <div className={styles.radarWrap}>
            <RadarChart stats={currentStats} labels={statLabels} size={280} />
          </div>

          <div className={styles.attributesCard}>
            <div className={styles.attributesGrid}>
              <div className={styles.attrCol}>
                <div className={styles.attrMain}>
                  <span>{currentStats[0]}</span> <span>オフェンス</span>
                </div>
                <div className={styles.attrSub}>
                  <div><span>ポジショニング</span> <span>{selectedYearStat?.sub_stats?.positioning ?? '-'}</span></div>
                  <div><span>決定力</span> <span>{selectedYearStat?.sub_stats?.finishing ?? '-'}</span></div>
                  <div><span>シュート</span> <span>{selectedYearStat?.sub_stats?.shooting ?? '-'}</span></div>
                </div>

                <div className={styles.attrMain} style={{marginTop: '1rem'}}>
                  <span>{currentStats[1]}</span> <span>テクニック</span>
                </div>
                <div className={styles.attrSub}>
                  <div><span>パス</span> <span>{selectedYearStat?.sub_stats?.passing ?? '-'}</span></div>
                  <div><span>ボールコントロール</span> <span>{selectedYearStat?.sub_stats?.ballControl ?? '-'}</span></div>
                  <div><span>アシスト</span> <span>{selectedYearStat?.sub_stats?.vision ?? '-'}</span></div>
                </div>
              </div>

              <div className={styles.attrCol}>
                <div className={styles.attrMain}>
                  <span>{currentStats[2]}</span> <span>ディフェンス</span>
                </div>
                <div className={styles.attrSub}>
                  <div><span>ブロック</span> <span>{selectedYearStat?.sub_stats?.blocking ?? '-'}</span></div>
                  <div><span>インターセプト</span> <span>{selectedYearStat?.sub_stats?.intercepting ?? '-'}</span></div>
                  <div><span>クリア</span> <span>{selectedYearStat?.sub_stats?.clearing ?? '-'}</span></div>
                  <div><span>スティール</span> <span>{selectedYearStat?.sub_stats?.stealing ?? '-'}</span></div>
                </div>

                <div className={styles.attrMain} style={{marginTop: '1rem'}}>
                  <span>{currentStats[3]}</span> <span>スピード</span>
                </div>
                <div className={styles.attrSub}>
                  <div><span>加速度</span> <span>{selectedYearStat?.sub_stats?.acceleration ?? 75}</span></div>
                  <div><span>スプリント力</span> <span>{selectedYearStat?.sub_stats?.sprintSpeed ?? 75}</span></div>
                </div>
              </div>

              <div className={styles.attrCol}>
                <div className={styles.attrMain}>
                  <span>{currentStats[4]}</span> <span>スタミナ</span>
                </div>
                <div className={styles.attrSub}>
                  <div><span>運動量</span> <span>{selectedYearStat?.sub_stats?.staminaWorkRate ?? '-'}</span></div>
                </div>

                {hasGK && (
                  <>
                    <div className={styles.attrMain} style={{marginTop: '1rem'}}>
                      <span>{currentStats[5]}</span> <span>キーパー力</span>
                    </div>
                    <div className={styles.attrSub}>
                      <div><span>セーブ</span> <span>{selectedYearStat?.sub_stats?.saving ?? '-'}</span></div>
                      <div><span>キャッチ</span> <span>{selectedYearStat?.sub_stats?.catching ?? '-'}</span></div>
                      <div><span>キーパー</span> <span>{selectedYearStat?.sub_stats?.gkPositioning ?? '-'}</span></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile */}
      {profileItems.length > 0 && (
        <section className={`container ${styles.profileSection}`}>
          <h2 className={styles.sectionTitle}>プロフィール</h2>
          <div className={styles.profileGrid}>
            {profileItems.map((item, i) => (
              <div key={i} className={styles.profileCard} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={styles.profileLabel}>{item.label}</div>
                <div className={styles.profileValue}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
