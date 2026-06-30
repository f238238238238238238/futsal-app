'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMatch, getImageUrl } from '@/lib/api';
import styles from './page.module.css';

const POSITIONS = {
  'GK': { top: '85%', left: '50%' },
  'Fixo': { top: '70%', left: '50%' },
  'Ala L': { top: '45%', left: '20%' },
  'Ala R': { top: '45%', left: '80%' },
  'Pivo': { top: '25%', left: '50%' },
  'default': { top: '50%', left: '50%' }
};

export default function MatchDetailPage() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    getMatch(id)
      .then(res => setMatch(res.match || res))
      .catch(err => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const { onPitch, bench } = useMemo(() => {
    if (!match || !match.stats) return { onPitch: [], bench: [] };
    
    let currentOnPitch = [];
    let currentBench = [];

    // Initialize based on starter flag
    match.stats.forEach(st => {
      const p = { 
        user_id: st.user_id, 
        name: st.name || st.user_name, 
        photo_url: st.photo_url, 
        jersey_number: st.jersey_number || '', 
        position: '' 
      };
      if (st.is_starter === 1 || st.is_starter === true) {
        currentOnPitch.push(p);
      } else {
        currentBench.push(p);
      }
    });

    // Apply events up to current minute
    const sortedEvents = [...(match.events || [])].sort((a,b) => a.minute - b.minute);
    
    for (const ev of sortedEvents) {
      if (ev.minute > minute) break;

      if (ev.event_type === 'sub_in') {
        const idx = currentBench.findIndex(p => p.user_id === ev.user_id);
        if (idx !== -1) {
          const p = currentBench.splice(idx, 1)[0];
          p.position = ev.position || '';
          currentOnPitch.push(p);
        }
      } else if (ev.event_type === 'sub_out') {
        const idx = currentOnPitch.findIndex(p => p.user_id === ev.user_id);
        if (idx !== -1) {
          const p = currentOnPitch.splice(idx, 1)[0];
          p.position = '';
          currentBench.push(p);
        }
      } else if (ev.event_type === 'position_change') {
        const p = currentOnPitch.find(p => p.user_id === ev.user_id);
        if (p) {
          p.position = ev.position || '';
        }
      }
    }

    return { onPitch: currentOnPitch, bench: currentBench };
  }, [match, minute]);

  const pastEvents = useMemo(() => {
    if (!match || !match.events) return [];
    return match.events
      .filter(ev => ev.minute <= minute)
      .sort((a,b) => b.minute - a.minute); // desc
  }, [match, minute]);

  const getEventText = (ev) => {
    const name = ev.name || ev.user_name || '選手';
    switch (ev.event_type) {
      case 'goal': return `⚽ ${name} がゴール！`;
      case 'assist': return `🅰️ ${name} がアシスト！`;
      case 'save': return `🧤 ${name} がファインセーブ！`;
      case 'sub_in': return `🔼 ${name} がピッチに入りました`;
      case 'sub_out': return `🔽 ${name} がベンチに下がりました`;
      case 'position_change': return `🔄 ${name} が ${ev.position || '別ポジション'} に変更`;
      default: return `${name} のイベント`;
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}><div className={styles.spinner} /></div>
      </div>
    );
  }

  if (errorMsg || !match) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ paddingTop: '2rem' }}>
          <p>{errorMsg || 'Match not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>MATCH DETAIL</h1>
        <div style={{ color: 'var(--color-primary-400)', fontWeight: 600, marginBottom: '1rem', letterSpacing: '0.1em', position: 'relative', zIndex: 1 }}>{match.competition_name || '練習試合'}</div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-light-100)' }}>FUMINTUS</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary-400)' }}>VS</div>
          <div style={{ flex: 1, textAlign: 'left', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-light-100)' }}>{match.opponent_name}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0.5rem auto 0' }}>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-light-100)' }}>{match.our_score}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-dark-500)' }}>-</div>
          <div style={{ flex: 1, textAlign: 'left', fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-light-100)' }}>{match.opponent_score}</div>
        </div>
      </div>

      <div className="container">
        <Link href="/matches" className={styles.backLink}>← 試合一覧に戻る</Link>

        <div className={styles.sliderContainer}>
          <div className={styles.sliderLabel}>⏱️ {Math.floor(minute / 60)}分{(minute % 60).toString().padStart(2, '0')}秒</div>
          <input 
            type="range" 
            min="0" 
            max={match.duration_seconds || 2400} 
            value={minute} 
            onChange={e => setMinute(parseInt(e.target.value, 10))} 
            className={styles.slider} 
          />
        </div>

        <div className={styles.contentGrid}>
          {/* 左側: スタメン・ベンチ一覧 */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>ピッチ上の選手 ({onPitch.length}名)</h2>
              <div className={styles.memberList}>
                {onPitch.length === 0 && <p style={{color: '#888'}}>なし</p>}
                {onPitch.map(p => (
                  <div key={p.user_id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {p.photo_url ? (
                        <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.memberImage} />
                      ) : (
                        <span className={styles.memberAvatarPlaceholder}>#{p.jersey_number}</span>
                      )}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{p.name}</div>
                      <div className={styles.memberPosition}>{p.position || '未設定'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>ベンチ ({bench.length}名)</h2>
              <div className={styles.memberList}>
                {bench.length === 0 && <p style={{color: '#888'}}>なし</p>}
                {bench.map(p => (
                  <div key={p.user_id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {p.photo_url ? (
                        <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.memberImage} />
                      ) : (
                        <span className={styles.memberAvatarPlaceholder}>#{p.jersey_number}</span>
                      )}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{p.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 中央: フォーメーション図 */}
          <div className={styles.middleColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>フォーメーション</h2>
              <div className={styles.pitchContainer}>
                <div className={styles.pitchLines} />
                <div className={styles.pitchPenaltyAreaTop} />
                <div className={styles.pitchPenaltyAreaBottom} />
                
                {onPitch.map(p => {
                  const pos = POSITIONS[p.position] || POSITIONS['default'];
                  return (
                    <div 
                      key={p.user_id} 
                      className={styles.playerDot}
                      style={{ top: pos.top, left: pos.left }}
                    >
                      <div className={styles.playerDotAvatar}>
                        {p.photo_url ? (
                          <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.playerDotImg} />
                        ) : (
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{p.jersey_number}</span>
                        )}
                      </div>
                      <div className={styles.playerDotLabel}>{p.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右側: イベントログ (実況) */}
          <div className={styles.rightColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>タイムライン ({Math.floor(minute / 60)}分{(minute % 60).toString().padStart(2, '0')}秒時点)</h2>
              <div className={styles.eventLogList} style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pastEvents.length === 0 && <p style={{color: '#888'}}>まだイベントはありません</p>}
                {pastEvents.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'var(--color-dark-900)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-dark-700)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-400)', minWidth: '55px' }}>{Math.floor(ev.minute / 60)}'{String(ev.minute % 60).padStart(2, '0')}"</span>
                    <span style={{ color: 'var(--color-light-100)', flex: 1, lineHeight: 1.4 }}>{getEventText(ev)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
