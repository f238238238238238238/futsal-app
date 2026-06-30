'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl } from '@/lib/api';
import styles from './live.module.css';

export default function LiveMatchPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  // Players
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State
  const [phase, setPhase] = useState('setup'); // setup, playing, finished
  const [matchInfo, setMatchInfo] = useState({ date: new Date().toISOString().slice(0,10), opponent_name: '', competition_name: '' });
  
  const [courtIds, setCourtIds] = useState([]);
  const [benchIds, setBenchIds] = useState([]);
  const [starterPositions, setStarterPositions] = useState({});
  
  const [score, setScore] = useState({ us: 0, opponent: 0 });
  const [events, setEvents] = useState([]); // { type: 'goal'|'assist'|'save'|'sub_in'|'sub_out', user_id, minute }
  
  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  // Selection
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  
  // Modal
  const [showAssistModal, setShowAssistModal] = useState(false);
  const [goalScorerId, setGoalScorerId] = useState(null);

  useEffect(() => {
    getPlayers().then(res => {
      const ps = res.users || res || [];
      // only active players or everyone? Usually everyone.
      setPlayers(ps);
      setBenchIds(ps.map(p => p.user_id));
      setLoading(false);
    });
  }, []);

  // Timer Effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  // Handlers
  const toggleSetupStarter = (id) => {
    if (courtIds.includes(id)) {
      setCourtIds(prev => prev.filter(x => x !== id));
      setBenchIds(prev => [...prev, id]);
    } else {
      if (courtIds.length >= 5) {
        alert('スタメンは5名までです');
        return;
      }
      setBenchIds(prev => prev.filter(x => x !== id));
      setCourtIds(prev => [...prev, id]);
    }
  };

  const startMatch = () => {
    if (!matchInfo.opponent_name) return alert('対戦相手を入力してください');
    if (courtIds.length === 0) return alert('スタメンを選んでください');
    
    // We add sub_in for starters at 0 minute just so logic works nicely, but backend handles is_starter
    setPhase('playing');
    setIsRunning(true);
  };

  const currentMinute = Math.floor(timerSeconds / 60);
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const recordEvent = (type, userId, extraData = {}) => {
    setEvents(prev => [...prev, { event_type: type, user_id: userId, minute: timerSeconds, ...extraData }]);
  };

  const handleAction = (type) => {
    if (!selectedCourtId) return;

    if (type === 'goal') {
      recordEvent('goal', selectedCourtId);
      setScore(s => ({ ...s, us: s.us + 1 }));
      setGoalScorerId(selectedCourtId);
      setShowAssistModal(true);
      setSelectedCourtId(null);
    } else {
      recordEvent(type, selectedCourtId);
      setSelectedCourtId(null);
    }
  };

  const handleAssistSelection = (assistId) => {
    if (assistId) {
      recordEvent('assist', assistId);
    }
    setShowAssistModal(false);
    setGoalScorerId(null);
  };

  const handleSub = () => {
    if (!selectedCourtId || !selectedBenchId) return;
    
    const pos = starterPositions[selectedCourtId];

    recordEvent('sub_out', selectedCourtId);
    recordEvent('sub_in', selectedBenchId, pos ? { position: pos } : {});

    setCourtIds(prev => [...prev.filter(id => id !== selectedCourtId), selectedBenchId]);
    setBenchIds(prev => [...prev.filter(id => id !== selectedBenchId), selectedCourtId]);
    
    if (pos) {
      setStarterPositions(prev => ({ ...prev, [selectedBenchId]: pos }));
    }
    
    setSelectedCourtId(null);
    setSelectedBenchId(null);
  };

  const endMatch = () => {
    if(confirm('試合を終了しますか？')) {
      setIsRunning(false);
      setPhase('finished');
    }
  };

  const saveMatch = async () => {
    // Compile stats
    // We need to figure out who played, goals, assists, saves, is_starter
    // Starters are anyone who was in courtIds at phase=='setup'. Wait, courtIds changed!
    // We should compute stats dynamically from events and initial courtIds.
    // Actually, we can just look at events.
    
    try {
      // Find all players who played
      // Anyone who has sub_out, sub_in, goal, assist, save OR is currently in courtIds
      const playedSet = new Set([...courtIds]);
      events.forEach(e => playedSet.add(e.user_id));

      // Calculate starters: Those who have sub_out without a prior sub_in? 
      // Actually, we know starters because they are in courtIds at start. Wait! We lost the initial courtIds.
      // Let's reconstruct starters: Anyone who has a sub_out or is in courtIds, and DOES NOT have a sub_in before their first sub_out.
      // Even easier: add an event "sub_in" for starters at startMatch!
      // But we didn't. Let's just say we can compute it if we kept initial starters. 
      // I'll just derive it roughly or we can save initial starters.
    } catch(err) {}
  };

  // Wait, I should keep track of initial starters!
  const [initialStarters, setInitialStarters] = useState([]);
  
  const handleStartMatch = () => {
    if (!matchInfo.opponent_name) return alert('対戦相手を入力してください');
    if (courtIds.length === 0) return alert('スタメンを選んでください');
    
    setInitialStarters([...courtIds]);
    setPhase('playing');
    setIsRunning(true);
  };

  const handleSaveMatch = async () => {
    const statsObj = {};
    const playedSet = new Set([...initialStarters, ...courtIds]);
    events.forEach(e => playedSet.add(e.user_id));

    playedSet.forEach(uid => {
      statsObj[uid] = {
        user_id: uid,
        is_starter: initialStarters.includes(uid) ? 1 : 0,
        position: starterPositions[uid] || null,
        goals: 0,
        assists: 0,
        saves: 0
      };
    });

    events.forEach(ev => {
      if (ev.event_type === 'goal') statsObj[ev.user_id].goals++;
      if (ev.event_type === 'assist') statsObj[ev.user_id].assists++;
      if (ev.event_type === 'save') statsObj[ev.user_id].saves++;
    });

    const statsArray = Object.values(statsObj);

    const payload = {
      date: matchInfo.date,
      opponent_name: matchInfo.opponent_name,
      competition_name: matchInfo.competition_name,
      our_score: score.us,
      opponent_score: score.opponent,
      duration_seconds: timerSeconds,
      summary_text: 'リアルタイム試合管理からの登録',
      mom_user_id: null,
      stats: statsArray,
      events: events
    };

    try {
      await createMatch(payload);
      alert('試合を保存しました！');
      router.push('/admin/matches');
    } catch (err) {
      alert('エラー: ' + err.message);
    }
  };

  if (authLoading || loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;
  if (!isAdmin) return <div>管理者権限が必要です</div>;

  return (
    <div className={styles.livePage}>
      {/* Header */}
      <header className={styles.liveHeader}>
        <Link href="/admin/matches" className={styles.backBtn}>✕ キャンセル</Link>
        <div className={styles.headerTitle}>LIVE MATCH</div>
        <div style={{ width: '80px' }} />
      </header>

      {/* SETUP PHASE */}
      {phase === 'setup' && (
        <div className={styles.container}>
          <div className={styles.setupCard}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>日付</label>
              <input type="date" className={styles.formInput} value={matchInfo.date} onChange={e => setMatchInfo({...matchInfo, date: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>対戦相手</label>
              <input type="text" className={styles.formInput} value={matchInfo.opponent_name} onChange={e => setMatchInfo({...matchInfo, opponent_name: e.target.value})} placeholder="例: FC東京" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>大会名 (任意)</label>
              <input type="text" className={styles.formInput} value={matchInfo.competition_name} onChange={e => setMatchInfo({...matchInfo, competition_name: e.target.value})} placeholder="例: 練習試合" />
            </div>
            
            <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>スタメン選択 ({courtIds.length}/5)</h3>
            <div className={styles.startersGrid}>
              {players.map(p => {
                const isSelected = courtIds.includes(p.user_id);
                return (
                  <div 
                    key={p.user_id} 
                    className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`}
                    onClick={(e) => {
                      if (e.target.tagName.toLowerCase() !== 'select') {
                        toggleSetupStarter(p.user_id);
                      }
                    }}
                  >
                    <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} alt={p.name} className={styles.avatarSmall} />
                    <div className={styles.jersey}>#{p.jersey_number || '-'}</div>
                    <div className={styles.playerName}>{p.name}</div>
                    {isSelected && (
                      <select 
                        value={starterPositions[p.user_id] || ''}
                        onChange={(e) => setStarterPositions(prev => ({ ...prev, [p.user_id]: e.target.value }))}
                        className={styles.positionSelect}
                      >
                        <option value="">ポジション</option>
                        <option value="GK">GK (ゴレイロ)</option>
                        <option value="Fixo">Fixo (フィクソ)</option>
                        <option value="Ala L">Ala L (左アラ)</option>
                        <option value="Ala R">Ala R (右アラ)</option>
                        <option value="Pivo">Pivo (ピヴォ)</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <button className={styles.startBtn} onClick={handleStartMatch} disabled={courtIds.length === 0 || !matchInfo.opponent_name}>
              試合開始
            </button>
          </div>
        </div>
      )}

      {/* PLAYING PHASE */}
      {phase === 'playing' && (
        <div className={styles.container} style={{ paddingBottom: '120px' }}>
          
          <div className={styles.scoreboard}>
            <div className={styles.scoreBox}>
              <div className={styles.scoreLabel}>OURS</div>
              <div className={styles.scoreValue}>{score.us}</div>
            </div>
            
            <div className={styles.timerBox}>
              <div className={styles.timerValue}>{formatTime(timerSeconds)}</div>
              <div className={styles.timerControls}>
                <button className={`${styles.ctrlBtn} ${!isRunning ? styles.active : ''}`} onClick={() => setIsRunning(false)}>PAUSE</button>
                <button className={`${styles.ctrlBtn} ${isRunning ? styles.active : ''}`} onClick={() => setIsRunning(true)}>PLAY</button>
                <button className={styles.endMatchBtn} onClick={endMatch}>END</button>
              </div>
            </div>
            
            <div className={styles.scoreBox}>
              <div className={styles.scoreLabel}>OPPONENT</div>
              <div className={styles.scoreValue}>{score.opponent}</div>
              <button className={styles.oppGoalBtn} onClick={() => setScore(s => ({ ...s, opponent: s.opponent + 1 }))}>+1 失点</button>
            </div>
          </div>

          <div className={styles.eventLogContainer}>
             <h3 className={styles.eventLogTitle}>直近のアクションログ</h3>
             <div className={styles.eventLogList}>
               {events.length === 0 && <div className={styles.eventLogItem}>まだ記録はありません</div>}
               {events.slice(-5).reverse().map((e, i) => {
                 const p = players.find(x => x.user_id === e.user_id)?.name;
                 let text = `${p} - ${e.event_type}`;
                 if(e.event_type==='goal') text = `⚽ ${p} ゴール!`;
                 if(e.event_type==='assist') text = `🅰️ ${p} アシスト`;
                 if(e.event_type==='save') text = `🧤 ${p} セーブ`;
                 if(e.event_type==='shot') text = `👟 ${p} シュート(ノーゴール)`;
                 if(e.event_type==='defense') text = `🛡️ ${p} ディフェンス(奪取/ブロック)`;
                 if(e.event_type==='sub_in') text = `🔼 ${p} IN`;
                 if(e.event_type==='sub_out') text = `🔽 ${p} OUT`;
                 const min = Math.floor(e.minute / 60);
                 const sec = String(e.minute % 60).padStart(2, '0');
                 return <div key={i} className={styles.eventLogItem}>[{min}'{sec}"] {text}</div>;
               })}
             </div>
          </div>

          <div className={styles.playArea}>
            <div className={styles.courtSection}>
              <h2 className={styles.sectionTitle}>コート (出場中)</h2>
              <div className={styles.playerList}>
                {courtIds.map(id => {
                  const p = players.find(x => x.user_id === id);
                  if (!p) return null;
                  return (
                    <div 
                      key={id} 
                      className={`${styles.playerRow} ${selectedCourtId === id ? styles.selected : ''}`}
                      onClick={() => setSelectedCourtId(id === selectedCourtId ? null : id)}
                    >
                      <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                      <div className={styles.playerRowInfo}>
                        <div className={styles.playerRowName}>#{p.jersey_number} {p.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.benchSection}>
              <h2 className={styles.sectionTitle}>ベンチ</h2>
              <div className={styles.playerList}>
                {benchIds.map(id => {
                  const p = players.find(x => x.user_id === id);
                  if (!p) return null;
                  return (
                    <div 
                      key={id} 
                      className={`${styles.playerRow} ${selectedBenchId === id ? styles.selected : ''}`}
                      onClick={() => setSelectedBenchId(id === selectedBenchId ? null : id)}
                    >
                      <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                      <div className={styles.playerRowInfo}>
                        <div className={styles.playerRowName}>#{p.jersey_number} {p.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Panel */}
          {selectedCourtId && (
            <div className={styles.actionPanel}>
              <button className={`${styles.actionBtn} ${styles.btnGoal}`} onClick={() => handleAction('goal')}>
                <span style={{ fontSize: '1.5rem' }}>⚽</span> ゴール
              </button>
              <button className={`${styles.actionBtn} ${styles.btnShot}`} onClick={() => handleAction('shot')}>
                <span style={{ fontSize: '1.5rem' }}>👟</span> シュート
              </button>
              <button className={`${styles.actionBtn} ${styles.btnDefense}`} onClick={() => handleAction('defense')}>
                <span style={{ fontSize: '1.5rem' }}>🛡️</span> ディフェンス
              </button>
              <button className={`${styles.actionBtn} ${styles.btnSave}`} onClick={() => handleAction('save')}>
                <span style={{ fontSize: '1.5rem' }}>🧤</span> セーブ
              </button>
              {selectedBenchId && (
                <button className={`${styles.actionBtn} ${styles.btnSub}`} onClick={handleSub}>
                  <span style={{ fontSize: '1.5rem' }}>🔄</span> 交代する
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* FINISHED PHASE */}
      {phase === 'finished' && (
        <div className={styles.container}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>MATCH FINISHED</h2>
            
            <div className={styles.summaryStats}>
              <div className={styles.summaryStatBox}>
                <h3>最終スコア</h3>
                <p>{score.us} - {score.opponent}</p>
              </div>
              <div className={styles.summaryStatBox}>
                <h3>試合時間</h3>
                <p>{formatTime(timerSeconds)}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--color-gold)', marginBottom: '10px' }}>イベントログ</h3>
              {events.length === 0 ? <p>イベントなし</p> : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {events.map((e, i) => {
                    const p = players.find(x => x.user_id === e.user_id)?.name;
                    const min = Math.floor(e.minute / 60);
                    const sec = String(e.minute % 60).padStart(2, '0');
                    return (
                      <li key={i} style={{ borderBottom: '1px solid #333', padding: '8px 0' }}>
                        [{min}'{sec}"] {p} - {e.event_type}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button className={styles.saveMatchBtn} onClick={handleSaveMatch}>
              この内容で保存する
            </button>
          </div>
        </div>
      )}

      {/* Assist Modal */}
      {showAssistModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>アシストした選手を選択</h3>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#ccc' }}>アシストがいない場合は「なし」を選択してください。</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              <button 
                className={`${styles.modalBtn} ${styles.secondary}`} 
                onClick={() => handleAssistSelection(null)}
              >
                アシストなし
              </button>
              
              {courtIds.filter(id => id !== goalScorerId).map(id => {
                const p = players.find(x => x.user_id === id);
                return (
                  <button 
                    key={id}
                    className={`${styles.modalBtn} ${styles.primary}`}
                    onClick={() => handleAssistSelection(id)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
