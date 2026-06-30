'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl, getEvents, getEventAttendances } from '@/lib/api';
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
  const tapTimeoutRef = useRef(null);

  // Selection
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [tapMeta, setTapMeta] = useState({ id: null, time: 0 });
  
  const [lastPasserId, setLastPasserId] = useState(null);
  const [selectingPosition, setSelectingPosition] = useState(null);

  const [attendingIds, setAttendingIds] = useState([]);

  useEffect(() => {
    getPlayers().then(res => {
      const ps = res.users || res || [];
      setPlayers(ps);
      // Default to empty so they select attendees first
      setAttendingIds([]);
      setBenchIds([]);
      setLoading(false);
    });
  }, []);

  // Fetch attendees based on date
  useEffect(() => {
    if (!matchInfo.date) return;
    
    const fetchAttendance = async () => {
      try {
        const eventsRes = await getEvents();
        const evs = eventsRes.events || [];
        const targetEvent = evs.find(e => e.date_time && e.date_time.startsWith(matchInfo.date));
        
        if (targetEvent) {
          const attRes = await getEventAttendances(targetEvent.event_id);
          const attendances = attRes.attendances || [];
          const presentUserIds = attendances.filter(a => a.status === 'present').map(a => a.user_id);
          
          if (presentUserIds.length > 0) {
            setAttendingIds(presentUserIds);
            
            // Keep existing starters if they are present, otherwise remove them
            const newCourtIds = courtIds.filter(id => presentUserIds.includes(id));
            setCourtIds(newCourtIds);
            
            // Bench is present users minus starters
            setBenchIds(presentUserIds.filter(id => !newCourtIds.includes(id)));
          }
        }
      } catch (err) {
        console.error('Failed to fetch auto-attendances', err);
      }
    };
    
    fetchAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchInfo.date]);

  const toggleAttendee = (id) => {
    if (attendingIds.includes(id)) {
      setAttendingIds(prev => prev.filter(x => x !== id));
      if (courtIds.includes(id)) {
        setCourtIds(prev => prev.filter(x => x !== id));
        setStarterPositions(prev => {
          const newPos = { ...prev };
          delete newPos[id];
          return newPos;
        });
      }
      setBenchIds(prev => prev.filter(x => x !== id));
    } else {
      setAttendingIds(prev => [...prev, id]);
      setBenchIds(prev => [...prev, id]);
    }
  };

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

  const handleAction = (type, targetId = selectedCourtId) => {
    if (!targetId) return;

    if (type === 'goal') {
      recordEvent('goal', targetId);
      setScore(s => ({ ...s, us: s.us + 1 }));
      if (lastPasserId && lastPasserId !== targetId) {
        recordEvent('assist', lastPasserId);
      }
      setLastPasserId(null);
      setSelectedCourtId(null);
    } else if (type === 'lost_ball') {
      recordEvent('lost_ball', targetId);
      setSelectedCourtId(null);
      setLastPasserId(null); // Reset pass memory on lost ball
    } else {
      recordEvent(type, targetId);
      setSelectedCourtId(null);
    }
  };

  const handleSub = (courtIdToSub) => {
    if (!courtIdToSub || !selectedBenchId) return;
    
    const pos = starterPositions[courtIdToSub];

    recordEvent('sub_out', courtIdToSub);
    recordEvent('sub_in', selectedBenchId, pos ? { position: pos } : {});

    setCourtIds(prev => [...prev.filter(id => id !== courtIdToSub), selectedBenchId]);
    setBenchIds(prev => [...prev.filter(id => id !== selectedBenchId), courtIdToSub]);
    
    if (pos) {
      setStarterPositions(prev => ({ ...prev, [selectedBenchId]: pos }));
    }
    
    if (selectedCourtId === courtIdToSub) {
      setSelectedCourtId(null);
    }
    setSelectedBenchId(null);
  };

  const handleCourtPlayerClick = (id) => {
    const now = Date.now();
    if (tapMeta.id === id && now - tapMeta.time < 400) {
      // Double tap detected!
      clearTimeout(tapTimeoutRef.current);
      setTapMeta({ id: null, time: 0 });
      
      const pos = starterPositions[id];
      if (pos === 'GK') {
        recordEvent('save', id); // Double tap GK -> Save (block/deflect)
      } else {
        recordEvent('block', id); // Double tap Field -> Block/Pass cut
      }
      setSelectedCourtId(null);
      setLastPasserId(null);
      return;
    }
    
    // Normal tap logic (delayed to check for double tap)
    setTapMeta({ id, time: now });
    
    clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      if (selectedBenchId) {
        handleSub(id);
      } else if (selectedCourtId === id) {
        setSelectedCourtId(null);
      } else if (selectedCourtId) {
        recordEvent('pass', selectedCourtId);
        setLastPasserId(selectedCourtId); // Remember who passed
        setSelectedCourtId(id);
      } else {
        // Opponent had ball -> Steal or Catch
        const pos = starterPositions[id];
        if (pos === 'GK') {
          recordEvent('catch', id);
        } else {
          recordEvent('steal', id);
        }
        setSelectedCourtId(id);
      }
    }, 250);
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
      if (ev.event_type === 'save' || ev.event_type === 'catch') statsObj[ev.user_id].saves++;
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
            
            <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>出席者選択 ({attendingIds.length}名)</h3>
            <div className={styles.startersGrid}>
              {players.map(p => {
                const isAttending = attendingIds.includes(p.user_id);
                return (
                  <div 
                    key={p.user_id} 
                    className={`${styles.playerSelectCard} ${isAttending ? styles.selected : ''}`}
                    onClick={() => toggleAttendee(p.user_id)}
                  >
                    <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} alt={p.name} className={styles.avatarSmall} />
                    <div className={styles.jersey}>#{p.jersey_number || '-'}</div>
                    <div className={styles.playerName}>{p.name}</div>
                  </div>
                );
              })}
            </div>

            {attendingIds.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', color: 'var(--color-gold)' }}>スタメン選択 (フォーメーション)</h3>
                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>各ポジションをタップして選手を割り当ててください</p>
                <div className={styles.pitchContainer}>
                  <div className={styles.pitchCenterLine} />
                  <div className={styles.pitchCenterCircle} />
                  <div className={styles.pitchPenaltyAreaTop} />
                  <div className={styles.pitchPenaltyAreaBottom} />
                  
                  {['Pivo', 'Ala L', 'Ala R', 'Fixo', 'GK'].map(pos => {
                    const playerId = Object.keys(starterPositions).find(id => starterPositions[id] === pos);
                    const player = players.find(p => p.user_id == playerId);
                    const posClass = pos.replace(' ', ''); // e.g. Ala L -> AlaL
                    
                    return (
                      <div 
                        key={pos} 
                        className={`${styles.pitchSlot} ${styles['pos' + posClass]}`}
                        onClick={() => setSelectingPosition(pos)}
                      >
                        {player ? (
                          <>
                            <img src={player.photo_url ? getImageUrl(player.photo_url) : '/default-avatar.png'} className={styles.pitchSlotAvatar} alt={player.name} />
                            <div className={styles.pitchSlotName}>{player.name}</div>
                          </>
                        ) : (
                          <>
                            <div className={styles.pitchSlotPos}>{pos}</div>
                            <div className={styles.pitchSlotEmpty}>+</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Player Selection Modal for Pitch */}
            {selectingPosition && (
              <div className={styles.modalOverlay} onClick={() => setSelectingPosition(null)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()}>
                  <h3>{selectingPosition} を選択</h3>
                  <div className={styles.startersGrid}>
                    {players.filter(p => attendingIds.includes(p.user_id)).map(p => {
                      const isSelected = Object.keys(starterPositions).includes(String(p.user_id));
                      return (
                        <div
                          key={p.user_id}
                          className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`}
                          onClick={() => {
                            const newPositions = { ...starterPositions };
                            const oldUserId = Object.keys(newPositions).find(id => newPositions[id] === selectingPosition);
                            if (oldUserId) delete newPositions[oldUserId];
                            
                            newPositions[p.user_id] = selectingPosition;
                            setStarterPositions(newPositions);
                            
                            const currentCourt = Object.keys(newPositions).map(Number);
                            setCourtIds(currentCourt);
                            setBenchIds(attendingIds.filter(id => !currentCourt.includes(id)));
                            
                            setSelectingPosition(null);
                          }}
                        >
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} alt={p.name} className={styles.avatarSmall} />
                          <div className={styles.jersey}>#{p.jersey_number || '-'}</div>
                          <div className={styles.playerName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.modalActions}>
                    <button className={`${styles.modalBtn} ${styles.secondary}`} onClick={() => {
                      const newPositions = { ...starterPositions };
                      const oldUserId = Object.keys(newPositions).find(id => newPositions[id] === selectingPosition);
                      if (oldUserId) delete newPositions[oldUserId];
                      
                      setStarterPositions(newPositions);
                      const currentCourt = Object.keys(newPositions).map(Number);
                      setCourtIds(currentCourt);
                      setBenchIds(attendingIds.filter(id => !currentCourt.includes(id)));
                      setSelectingPosition(null);
                    }}>未選択にする</button>
                    <button className={`${styles.modalBtn} ${styles.secondary}`} onClick={() => setSelectingPosition(null)}>キャンセル</button>
                  </div>
                </div>
              </div>
            )}

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
               {events.filter(e => ['goal', 'assist', 'save', 'defense', 'catch', 'steal', 'block'].includes(e.event_type)).length === 0 && <div className={styles.eventLogItem}>まだ記録はありません</div>}
               {events.filter(e => ['goal', 'assist', 'save', 'defense', 'catch', 'steal', 'block'].includes(e.event_type)).slice(-5).reverse().map((e, i) => {
                 const p = players.find(x => x.user_id === e.user_id)?.name;
                 let text = `${p} - ${e.event_type}`;
                 if(e.event_type==='goal') text = `⚽ ${p} ゴール!`;
                 if(e.event_type==='assist') text = `🅰️ ${p} アシスト`;
                 if(e.event_type==='save') text = `🧤 ${p} セーブ(弾く)`;
                 if(e.event_type==='catch') text = `🧤 ${p} ボールキャッチ`;
                 if(e.event_type==='steal') text = `🛡️ ${p} ボール奪取`;
                 if(e.event_type==='block') text = `🛡️ ${p} ブロック/パスカット`;
                 if(e.event_type==='defense') text = `🛡️ ${p} ディフェンス`;
                 const min = Math.floor(e.minute / 60);
                 const sec = String(e.minute % 60).padStart(2, '0');
                 return <div key={i} className={styles.eventLogItem}>[{min}'{sec}"] {text}</div>;
               })}
             </div>
          </div>

          {selectedBenchId && (
            <div style={{ textAlign: 'center', marginBottom: '10px', color: 'var(--color-gold)', fontWeight: 'bold' }}>
              交代するピッチの選手をタップしてください
            </div>
          )}

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
                      onClick={() => handleCourtPlayerClick(id)}
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
              <button className={`${styles.actionBtn} ${styles.btnRecovery}`} onClick={() => handleAction('lost_ball')}>
                 <span style={{ fontSize: '1.5rem' }}>💥</span> ロスト
              </button>
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
    </div>
  );
}
