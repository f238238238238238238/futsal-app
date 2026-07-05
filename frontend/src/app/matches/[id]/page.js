'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  'red_GK': { top: '92%', left: '50%' },
  'red_Fixo': { top: '75%', left: '50%' },
  'red_AlaL': { top: '60%', left: '25%' },
  'red_AlaR': { top: '60%', left: '75%' },
  'red_Pivo': { top: '45%', left: '50%' },
  'blue_GK': { top: '8%', left: '50%' },
  'blue_Fixo': { top: '25%', left: '50%' },
  'blue_AlaL': { top: '40%', left: '75%' },
  'blue_AlaR': { top: '40%', left: '25%' },
  'blue_Pivo': { top: '55%', left: '50%' },
  'default': { top: '50%', left: '50%' }
};

export default function MatchDetailPage() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [minute, setMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(-1);
  
  const [ballState, setBallState] = useState({ top: '50%', left: '50%', opacity: 0 });
  const [effect, setEffect] = useState(null);

  useEffect(() => {
    getMatch(id)
      .then(res => setMatch(res.match || res))
      .catch(err => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const sortedEvents = useMemo(() => {
    if (!match || !match.events) return [];
    return [...match.events].sort((a,b) => a.minute - b.minute);
  }, [match]);

  const getPlayerPosition = (userId, currentMin, evPos) => {
    if (!userId && evPos && (evPos.startsWith('dummy_') || evPos === 'opponent')) {
      return POSITIONS[evPos] || POSITIONS['default'];
    }
    if (userId && typeof userId === 'string' && (userId.startsWith('dummy_') || userId === 'opponent')) {
      return POSITIONS[userId] || POSITIONS['default'];
    }
    let pos = '';
    const starter = match.stats.find(s => s.user_id === userId);
    if (starter && (starter.is_starter === 1 || starter.is_starter === true)) {
      pos = starter.position;
    }
    for (const e of sortedEvents) {
      if (e.minute > currentMin) break;
      if (e.user_id === userId) {
        if (e.event_type === 'sub_in') pos = e.position;
        if (e.event_type === 'sub_out') pos = '';
        if (e.event_type === 'position_change') pos = e.position;
      }
    }
    return POSITIONS[pos] || POSITIONS['default'];
  };

  const triggerAnimation = (ev, evIndex) => {
    const pPos = getPlayerPosition(ev.user_id, ev.minute, ev.position);
    
    switch (ev.event_type) {
      case 'pass':
      case 'steal':
      case 'catch':
      case 'assist':
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        if(ev.event_type === 'steal' || ev.event_type === 'catch') {
          setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: ev.event_type === 'steal' ? '🛡️' : '🧤' });
        }
        if(ev.event_type === 'assist') {
          setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: '🅰️' });
        }
        break;
      case 'lost_ball':
        setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: '💥' });
        setBallState({ top: pPos.top, left: pPos.left, opacity: 0 });
        break;
      case 'block':
      case 'save':
      case 'defense':
        setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: ev.event_type === 'save' ? '🧤' : '🛡️' });
        setBallState({ top: `calc(${pPos.top} + 15%)`, left: `calc(${pPos.left} + 15%)`, opacity: 0 });
        break;
      case 'goal':
        let goalCount = 0;
        if (evIndex !== undefined) {
          for(let i=0; i<=evIndex; i++) {
            if(sortedEvents[i].event_type === 'goal' && sortedEvents[i].user_id === ev.user_id) {
              goalCount++;
            }
          }
        }
        const isHattrick = goalCount === 3;

        // まずゴール決めた人へパスアニメーション(400ms)
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        setTimeout(() => {
          // パス完了後にゴールへシュート
          setBallState({ top: '0%', left: '50%', opacity: 1 });
          setTimeout(() => {
            if (isHattrick) {
              setEffect({ key: Date.now(), type: 'hattrick', top: '50%', left: '50%', emoji: 'HATTRICK!!! 🎩✨🔥' });
            } else {
              setEffect({ key: Date.now(), type: 'goal', top: '50%', left: '50%', emoji: 'GOAL!! 🎉' });
            }
            
            // 演出終了後(約1.5秒〜2秒後)にコート中央へボールをリセット
            setTimeout(() => {
              setBallState({ top: '50%', left: '50%', opacity: 1 });
            }, 2000);

          }, 400);
        }, 400);
        break;
      case 'shot':
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        setTimeout(() => {
          setBallState({ top: '-10%', left: '70%', opacity: 0 });
          setTimeout(() => {
            setEffect({ key: Date.now(), type: 'miss', top: '50%', left: '50%', emoji: 'NO GOAL 😱' });
          }, 400);
        }, 400);
        break;
      default:
        // それ以外のイベントでも必要に応じて中央リセットなどを入れるか検討
        break;
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    
    const nextIdx = playIndex + 1;
    if (nextIdx >= sortedEvents.length) {
      setIsPlaying(false);
      return;
    }
    
    const nextEvent = sortedEvents[nextIdx];
    const delay = playIndex === -1 ? 500 : 2500; // wait longer between events
    
    const timer = setTimeout(() => {
      setMinute(nextEvent.minute);
      setPlayIndex(nextIdx);
      triggerAnimation(nextEvent, nextIdx);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [isPlaying, playIndex, sortedEvents]);

  const handleSliderChange = (newMin) => {
    setMinute(newMin);
    setIsPlaying(false);
    
    let idx = -1;
    for(let i=0; i<sortedEvents.length; i++) {
      if(sortedEvents[i].minute <= newMin) idx = i;
    }
    setPlayIndex(idx);
    
    if (idx >= 0) {
      triggerAnimation(sortedEvents[idx], idx);
    } else {
      setBallState({ ...ballState, opacity: 0 });
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If at the end, restart
      if (playIndex >= sortedEvents.length - 1) {
        setPlayIndex(-1);
        setMinute(0);
        setBallState({ top: '50%', left: '50%', opacity: 0 });
      }
      setIsPlaying(true);
    }
  };

  const { onPitch, bench } = useMemo(() => {
    if (!match || !match.stats) return { onPitch: [], bench: [] };
    
    let currentOnPitch = [];
    let currentBench = [];

    match.stats.forEach(st => {
      const p = { 
        user_id: st.user_id, 
        name: st.name || st.user_name, 
        photo_url: st.photo_url, 
        jersey_number: st.jersey_number || '', 
        position: st.position || '' 
      };
      if (st.is_starter === 1 || st.is_starter === true) {
        currentOnPitch.push(p);
      } else {
        currentBench.push(p);
      }
    });

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
  }, [match, minute, sortedEvents]);

  const teamStats = useMemo(() => {
    let redStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0 };
    let blueStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0 };
    
    if (!match || !match.stats) return { red: redStats, blue: blueStats };

    let currentOnPitch = [];
    match.stats.forEach(st => {
      if (st.is_starter === 1 || st.is_starter === true) {
        currentOnPitch.push({ user_id: st.user_id, position: st.position || '' });
      }
    });

    for (const ev of sortedEvents) {
      if (ev.minute > minute) break;
      
      if (ev.event_type === 'sub_in') {
         currentOnPitch.push({ user_id: ev.user_id, position: ev.position || '' });
      } else if (ev.event_type === 'sub_out') {
         const idx = currentOnPitch.findIndex(p => p.user_id === ev.user_id);
         if (idx !== -1) currentOnPitch.splice(idx, 1);
      } else if (ev.event_type === 'position_change') {
         const p = currentOnPitch.find(p => p.user_id === ev.user_id);
         if (p) p.position = ev.position || '';
      }

      let team = null;
      if (match.match_mode === 'intra') {
         const p = currentOnPitch.find(x => x.user_id === ev.user_id);
         if (p && p.position.startsWith('red_')) team = 'red';
         else if (p && p.position.startsWith('blue_')) team = 'blue';
      } else {
         if (!ev.user_id || ev.user_id === 'opponent' || (typeof ev.user_id === 'string' && ev.user_id.startsWith('dummy_')) || (typeof ev.position === 'string' && (ev.position.startsWith('dummy_') || ev.position === 'opponent'))) {
            team = 'blue'; // opponent
         } else {
            team = 'red'; // us
         }
      }

      if (team === 'red') {
        if (ev.event_type === 'pass') redStats.passes++;
        if (ev.event_type === 'lost_ball') redStats.lost++;
        if (ev.event_type === 'goal') redStats.goals++;
        if (ev.event_type === 'shot') redStats.shots++;
        if (ev.event_type === 'save') redStats.saves++;
      } else if (team === 'blue') {
        if (ev.event_type === 'pass') blueStats.passes++;
        if (ev.event_type === 'lost_ball') blueStats.lost++;
        if (ev.event_type === 'goal') blueStats.goals++;
        if (ev.event_type === 'shot') blueStats.shots++;
        if (ev.event_type === 'save') blueStats.saves++;
      }
      
      // Override for opponent-specific events in external matches (which might be tied to our player IDs)
      if (ev.event_type === 'concede') blueStats.goals++;
      if (ev.event_type === 'opponent_shot') blueStats.shots++;
    }
    
    return { red: redStats, blue: blueStats };
  }, [match, minute, sortedEvents]);

  const StatBar = ({ label, leftVal, rightVal, leftStr, rightStr }) => {
    const total = leftVal + rightVal;
    const leftRatio = total > 0 ? (leftVal / total) * 100 : 50;
    const rightRatio = total > 0 ? (rightVal / total) * 100 : 50;
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <span style={{ color: 'var(--color-primary-400)' }}>{leftStr || leftVal}</span>
          <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{label}</span>
          <span style={{ color: '#fff' }}>{rightStr || rightVal}</span>
        </div>
        <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: '#333' }}>
          <div style={{ width: `${leftRatio}%`, background: 'var(--color-primary-400)' }} />
          <div style={{ width: `${rightRatio}%`, background: '#fff' }} />
        </div>
      </div>
    );
  };

  const pastEvents = useMemo(() => {
    return sortedEvents
      .filter(ev => ev.minute <= minute)
      .sort((a,b) => b.minute - a.minute);
  }, [sortedEvents, minute]);

  const getEventText = (ev) => {
    let name = ev.name || ev.user_name || '選手';
    if (!ev.user_id && ev.position && (ev.position.startsWith('dummy_') || ev.position === 'opponent')) {
      name = '相手選手';
    } else if (ev.user_id === 'opponent' || (typeof ev.user_id === 'string' && ev.user_id.startsWith('dummy_'))) {
      name = '相手選手';
    }
    switch (ev.event_type) {
      case 'goal': return `⚽ ${name} がゴール！`;
      case 'assist': return `🅰️ ${name} がアシスト！`;
      case 'save': return `🧤 ${name} がセーブ(弾く)！`;
      case 'catch': return `🧤 ${name} がボールキャッチ！`;
      case 'shot': return `👟 ${name} がシュート！(ノーゴール)`;
      case 'defense': return `🛡️ ${name} がディフェンス！`;
      case 'steal': return `🛡️ ${name} がボール奪取！`;
      case 'block': return `🛡️ ${name} がブロック/パスカット！`;
      case 'sub_in': return `🔼 ${name} がピッチに入りました`;
      case 'sub_out': return `🔽 ${name} がベンチに下がりました`;
      case 'position_change': return `🔄 ${name} が ${ev.position || '別ポジション'} に変更`;
      case 'pass': return `🔁 ${name} がパスを繋ぎました`;
      case 'lost_ball': return `💥 ${name} がボールをロスト`;
      default: return `${name} - ${ev.event_type}`;
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
            onChange={e => handleSliderChange(parseInt(e.target.value, 10))} 
            className={styles.slider} 
          />
          <div className={styles.playbackControls}>
            <button className={styles.playBtn} onClick={togglePlay}>
              {isPlaying ? '⏸ 停止' : '▶ ハイライト再生'}
            </button>
          </div>
        </div>

        <div className={styles.contentGrid}>
          {/* 左側: スタメン・ベンチ一覧 */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>チームスタッツ</h2>
              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ display: 'flex', marginBottom: '1.5rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1, padding: '0.5rem', background: 'var(--color-primary-400)', color: '#fff', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'RED' : 'FUMINTUS'}
                  </div>
                  <div style={{ flex: 1, padding: '0.5rem', background: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'BLUE' : (match?.opponent_name || 'OPPONENT')}
                  </div>
                </div>

                <StatBar 
                  label="ボール支配率" 
                  leftVal={teamStats.red.passes} 
                  rightVal={teamStats.blue.passes} 
                  leftStr={teamStats.red.passes + teamStats.blue.passes > 0 ? `${Math.round((teamStats.red.passes / (teamStats.red.passes + teamStats.blue.passes)) * 100)}%` : '50%'}
                  rightStr={teamStats.red.passes + teamStats.blue.passes > 0 ? `${Math.round((teamStats.blue.passes / (teamStats.red.passes + teamStats.blue.passes)) * 100)}%` : '50%'}
                />
                <StatBar 
                  label="シュート数" 
                  leftVal={teamStats.red.goals + teamStats.red.shots} 
                  rightVal={teamStats.blue.goals + teamStats.blue.shots} 
                />
                <StatBar 
                  label="枠内シュート" 
                  leftVal={teamStats.red.goals + teamStats.red.saves} 
                  rightVal={teamStats.blue.goals + teamStats.blue.saves} 
                />
                <StatBar 
                  label="パス本数" 
                  leftVal={teamStats.red.passes} 
                  rightVal={teamStats.blue.passes} 
                />
                <StatBar 
                  label="パス成功率" 
                  leftVal={teamStats.red.passes > 0 ? teamStats.red.passes / (teamStats.red.passes + teamStats.red.lost) : 0} 
                  rightVal={teamStats.blue.passes > 0 ? teamStats.blue.passes / (teamStats.blue.passes + teamStats.blue.lost) : 0} 
                  leftStr={teamStats.red.passes + teamStats.red.lost > 0 ? `${Math.round((teamStats.red.passes / (teamStats.red.passes + teamStats.red.lost)) * 100)}%` : '0%'}
                  rightStr={teamStats.blue.passes + teamStats.blue.lost > 0 ? `${Math.round((teamStats.blue.passes / (teamStats.blue.passes + teamStats.blue.lost)) * 100)}%` : '0%'}
                />
              </div>
            </div>

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
              <div className={styles.pitchWrapper}>
                <div className={styles.pitchContainer}>
                  <div className={styles.pitchLines} />
                  <div className={styles.pitchPenaltyAreaTop} />
                  <div className={styles.pitchPenaltyAreaBottom} />
                  
                  {/* ⚽ アニメーション用ボール */}
                  <div 
                    className={styles.ball} 
                    style={{ top: ballState.top, left: ballState.left, opacity: ballState.opacity }}
                  >
                    ⚽
                  </div>

                  {onPitch.map(p => {
                    let posKey = p.position;
                    if (match?.match_mode === 'external' && posKey) {
                       posKey = posKey.replace('red_', '').replace('blue_', '');
                       // Handle space in Ala L / Ala R
                       if (posKey === 'AlaL') posKey = 'Ala L';
                       if (posKey === 'AlaR') posKey = 'Ala R';
                    }
                    const pos = POSITIONS[posKey] || POSITIONS['default'];
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

                {/* ✨ アニメーション用エフェクト (pitchContainerの外に出すことでクリップされないようにする) */}
                {effect && effect.type === 'badge' && (
                  <div 
                    key={effect.key}
                    className={styles.effectBadge}
                    style={{ top: effect.top, left: effect.left }}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'goal' && (
                  <div 
                    key={effect.key}
                    className={styles.goalText}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'miss' && (
                  <div 
                    key={effect.key}
                    className={styles.missText}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'hattrick' && (
                  <div 
                    key={effect.key}
                    className={styles.hattrickText}
                  >
                    {effect.emoji}
                  </div>
                )}
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
