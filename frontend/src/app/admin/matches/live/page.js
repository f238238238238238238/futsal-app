'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl, getEvents, getEventAttendances } from '@/lib/api';
import styles from './live.module.css';

const POSITIONS_EXTERNAL = ['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK'];
const POSITIONS_INTRA = ['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK', 'blue_Pivo', 'blue_AlaL', 'blue_AlaR', 'blue_Fixo', 'blue_GK'];

export default function LiveMatchPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  // Players
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State
  const [phase, setPhase] = useState('setup'); // setup, playing, finished
  const [matchMode, setMatchMode] = useState('external'); // external, intra
  const [matchInfo, setMatchInfo] = useState({ 
    date: new Date().toISOString().slice(0,10), 
    opponent_name: '', 
    competition_name: '',
    team1_name: 'RED',
    team2_name: 'BLUE'
  });
  
  const [availableEvents, setAvailableEvents] = useState([]);
  
  const [courtIds, setCourtIds] = useState([]);
  const [benchIds, setBenchIds] = useState([]);
  const [starterPositions, setStarterPositions] = useState({});
  const [initialStarters, setInitialStarters] = useState([]);
  
  const [score, setScore] = useState({ us: 0, opponent: 0 });
  const [events, setEvents] = useState([]); // { type, user_id, minute }
  
  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // Selection
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [selectionTime, setSelectionTime] = useState(null);
  const [lastPasserId, setLastPasserId] = useState(null);

  const [setupSelectedPos, setSetupSelectedPos] = useState(null);
  const [attendingIds, setAttendingIds] = useState([]);
  const [playerTeams, setPlayerTeams] = useState({});

  const assignTeam = (userId, team) => {
    setPlayerTeams(prev => ({ ...prev, [userId]: team }));
    
    if (team === null) {
      // Remove from attendance
      setAttendingIds(prev => prev.filter(x => x !== userId));
      setBenchIds(prev => prev.filter(x => x !== userId));
      setCourtIds(prev => prev.filter(x => x !== userId));
      setStarterPositions(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      // Add to attendance if not already there
      setAttendingIds(prev => prev.includes(userId) ? prev : [...prev, userId]);
      // If they are not on pitch, make sure they are in bench
      setBenchIds(prev => {
        if (!prev.includes(userId) && !courtIds.includes(userId)) {
          return [...prev, userId];
        }
        return prev;
      });
    }
  };

  // Swap / Sub State
  const [swapSourceId, setSwapSourceId] = useState(null);
  const [swapSourceOrigin, setSwapSourceOrigin] = useState(null);
  const [lastTapInfo, setLastTapInfo] = useState({ id: null, time: 0 });

  useEffect(() => {
    getPlayers().then(res => {
      const ps = res.users || res || [];
      setPlayers(ps);
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
        setAvailableEvents(evs);
        
        const targetEvent = evs.find(e => e.date_time && e.date_time.startsWith(matchInfo.date));
        if (targetEvent) {
          const attRes = await getEventAttendances(targetEvent.event_id);
          const attendances = attRes.attendances || [];
          const presentUserIds = attendances.filter(a => a.status === 'present').map(a => a.user_id);
          if (presentUserIds.length > 0) {
            setAttendingIds(presentUserIds);
            const newCourtIds = courtIds.filter(id => presentUserIds.includes(id));
            setCourtIds(newCourtIds);
            setBenchIds(presentUserIds.filter(id => !newCourtIds.includes(id)));
          }
        }
      } catch (err) {}
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

  const recordEvent = (type, userId, extraData = {}) => {
    setEvents(prev => [...prev, { event_type: type, user_id: userId, minute: timerSeconds, ...extraData }]);
  };

  // (Touch Handlers Removed)

  const handlePlayerTap = (id, origin) => {
    if (phase === 'setup') {
      if (origin === 'bench') {
        if (!setupSelectedPos) {
          alert('先にピッチのポジション（＋マーク）をタップしてください');
          return;
        }
        setCourtIds(prev => [...prev, id]);
        setBenchIds(prev => prev.filter(x => x !== id));
        setStarterPositions(prev => ({ ...prev, [id]: setupSelectedPos }));
        setSetupSelectedPos(null);
      } else if (origin === 'pitch') {
        const posToRestore = starterPositions[id];
        setCourtIds(prev => prev.filter(x => x !== id));
        setBenchIds(prev => [...prev, id]);
        setStarterPositions(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (posToRestore) setSetupSelectedPos(posToRestore);
      }
    } else if (phase === 'playing') {
      const now = Date.now();
      const isDoubleTap = lastTapInfo.id === id && (now - lastTapInfo.time) < 400;
      setLastTapInfo({ id, time: now });

      if (isDoubleTap || (!swapSourceId && origin === 'bench')) {
        setSwapSourceId(id);
        setSwapSourceOrigin(origin);
        setSelectedCourtId(null);
        return;
      }

      if (swapSourceId) {
        if (swapSourceId === id) return; 
        
        if (swapSourceOrigin === 'bench' && origin === 'pitch') {
          handleDrop(swapSourceId, 'bench', starterPositions[id] || '', id);
          setSwapSourceId(null);
          return;
        } else if (swapSourceOrigin === 'pitch' && origin === 'pitch') {
          handleDrop(swapSourceId, 'pitch', null, id);
          setSwapSourceId(null);
          return;
        } else if (swapSourceOrigin === 'pitch' && origin === 'bench') {
          handleDrop(swapSourceId, 'pitch', 'bench', id);
          setSwapSourceId(null);
          return;
        } else if (swapSourceOrigin === 'bench' && origin === 'bench') {
           setSwapSourceId(id);
           return;
        }
      }

      if (origin === 'bench') {
        setSelectionTime(null);
        return;
      }

      const isEnemyDummy = typeof id === 'string' && id.startsWith('dummy_');
      const isSelectedDummy = typeof selectedCourtId === 'string' && selectedCourtId.startsWith('dummy_');
      
      let isOpponent = false;
      if (matchMode === 'intra') {
         isOpponent = playerTeams[selectedCourtId] !== undefined && playerTeams[id] !== undefined && playerTeams[selectedCourtId] !== playerTeams[id];
      } else {
         if (selectedCourtId) {
            isOpponent = (isSelectedDummy && !isEnemyDummy) || (!isSelectedDummy && isEnemyDummy);
         }
      }

      if (selectedCourtId === id) {
        setSelectedCourtId(null); 
        setSelectionTime(null);
      } else if (selectedCourtId) {
        if (isOpponent) {
          recordEvent('lost_ball', selectedCourtId);
          if (matchMode === 'intra' || matchMode === 'external') {
            const pos = id.startsWith('dummy_') ? id.replace('dummy_', '') : (starterPositions[id] || '');
            if (pos.includes('GK')) recordEvent('catch', id);
            else recordEvent('steal', id);
            setSelectedCourtId(id);
            setSelectionTime(Date.now());
          } else {
            setSelectedCourtId(null);
            setSelectionTime(null);
          }
          setLastPasserId(null);
        } else {
          recordEvent('pass', selectedCourtId);
          setLastPasserId(selectedCourtId);
          setSelectedCourtId(id);
          setSelectionTime(Date.now());
        }
      } else {
        const pos = id.startsWith('dummy_') ? id.replace('dummy_', '') : (starterPositions[id] || '');
        if (pos.includes('GK')) recordEvent('catch', id);
        else recordEvent('steal', id);
        setSelectedCourtId(id);
        setLastPasserId(null);
        setSelectionTime(Date.now());
      }
    }
  };

  const handleEmptySlotTap = (pos) => {
    if (phase === 'setup') {
      setSetupSelectedPos(pos);
    } else if (phase === 'playing') {
      if (swapSourceId && swapSourceOrigin === 'bench') {
        handleDrop(swapSourceId, 'bench', pos, null);
        setSwapSourceId(null);
      } else if (swapSourceId && swapSourceOrigin === 'pitch') {
        handleDrop(swapSourceId, 'pitch', pos, null);
        setSwapSourceId(null);
      }
    }
  };

  const handleDrop = (sourceId, origin, targetPos, targetId) => {
    if (origin === 'bench') {
      if (targetPos === 'bench') return; // dropped on bench
      
      // Sub IN
      if (targetId) {
        // Replace existing player
        recordEvent('sub_out', targetId);
        recordEvent('sub_in', sourceId, { position: targetPos });
        setCourtIds(prev => [...prev.filter(x => x !== targetId), sourceId]);
        setBenchIds(prev => [...prev.filter(x => x !== sourceId), targetId]);
        setStarterPositions(prev => {
          const next = { ...prev };
          delete next[targetId];
          next[sourceId] = targetPos;
          return next;
        });
      } else {
        // Fill empty slot
        recordEvent('sub_in', sourceId, { position: targetPos });
        setCourtIds(prev => [...prev, sourceId]);
        setBenchIds(prev => prev.filter(x => x !== sourceId));
        setStarterPositions(prev => ({ ...prev, [sourceId]: targetPos }));
      }
    } else {
      // Origin is pitch
      if (targetPos === 'bench') {
        // Sub OUT
        recordEvent('sub_out', sourceId);
        setCourtIds(prev => prev.filter(x => x !== sourceId));
        setBenchIds(prev => [...prev, sourceId]);
        setStarterPositions(prev => {
          const next = { ...prev };
          delete next[sourceId];
          return next;
        });
      } else {
        // Position Swap
        if (targetId && targetId !== sourceId) {
          const pos1 = starterPositions[sourceId];
          const pos2 = starterPositions[targetId];
          recordEvent('position_change', sourceId, { position: pos2 });
          recordEvent('position_change', targetId, { position: pos1 });
          setStarterPositions(prev => ({ ...prev, [sourceId]: pos2, [targetId]: pos1 }));
        } else if (!targetId) {
          recordEvent('position_change', sourceId, { position: targetPos });
          setStarterPositions(prev => ({ ...prev, [sourceId]: targetPos }));
        }
      }
    }
    
    // Clear selection if involved
    if (selectedCourtId === sourceId || selectedCourtId === targetId) {
      setSelectedCourtId(null);
    }
  };

  const handleAction = (type) => {
    const targetId = selectedCourtId;

    if (type === 'goal_bottom' && matchMode === 'external') {
      // Opponent scored in external match (Concede)
      setScore(s => ({ ...s, opponent: s.opponent + 1 }));
      recordEvent('concede', targetId || 'opponent');
      if (selectedCourtId) {
        setSelectedCourtId(null);
        setSelectionTime(null);
        setLastPasserId(null);
      }
      return;
    } else if (type === 'shot_bottom' && matchMode === 'external') {
      recordEvent('opponent_shot', targetId || 'opponent');
      if (selectedCourtId) {
        setSelectedCourtId(null);
        setSelectionTime(null);
        setLastPasserId(null);
      }
      return;
    }

    if (!targetId) return;

    if (type === 'goal_top' || type === 'goal_bottom') {
      recordEvent('goal', targetId);
      
      const pos = starterPositions[targetId] || '';
      if (matchMode === 'intra') {
        if (pos.startsWith('blue')) setScore(s => ({ ...s, opponent: s.opponent + 1 }));
        else setScore(s => ({ ...s, us: s.us + 1 }));
      } else {
        if (targetId.startsWith('dummy_')) setScore(s => ({ ...s, opponent: s.opponent + 1 }));
        else setScore(s => ({ ...s, us: s.us + 1 }));
      }

      if (lastPasserId && lastPasserId !== targetId) {
        recordEvent('assist', lastPasserId);
      }
      setLastPasserId(null);
      setSelectedCourtId(null);
      setSelectionTime(null);
    } else if (type === 'shot_top' || type === 'shot_bottom') {
      recordEvent('shot', targetId);
      setSelectedCourtId(null);
      setSelectionTime(null);
    }
  };

  const handleStartMatch = () => {
    if (matchMode === 'external' && !matchInfo.opponent_name) return alert('対戦相手を入力してください');
    if (courtIds.length === 0) return alert('スタメンを選んでください');
    
    setInitialStarters([...courtIds]);
    setPhase('playing');
    setIsRunning(true);
  };

  const endMatch = () => {
    if(confirm('試合を終了しますか？')) {
      setIsRunning(false);
      setPhase('finished');
    }
  };

  const handleSaveMatch = async () => {
    const statsObj = {};
    const playedSet = new Set([...attendingIds]);

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

    const payload = {
      date: matchInfo.date,
      opponent_name: matchMode === 'intra' ? `紅白戦 (${matchInfo.team1_name || 'RED'} vs ${matchInfo.team2_name || 'BLUE'})` : matchInfo.opponent_name,
      competition_name: matchInfo.competition_name,
      our_score: score.us,
      opponent_score: score.opponent,
      duration_seconds: timerSeconds,
      summary_text: matchMode === 'intra' ? '紅白戦（10人制）の記録' : 'リアルタイム試合管理からの登録',
      mom_user_id: null,
      stats: Object.values(statsObj),
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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (authLoading || loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;
  if (!isAdmin) return <div>管理者権限が必要です</div>;

  const renderListSlot = (pos) => {
    const playerIdStr = Object.keys(starterPositions).find(id => starterPositions[id] === pos);
    const playerId = playerIdStr ? Number(playerIdStr) : null;
    const player = players.find(p => p.user_id === playerId);
    
    return (
      <div 
        key={pos} 
        className={`${styles.listSlot} ${setupSelectedPos === pos ? styles.selectedSlot : ''}`}
        onClick={() => {
          if (player) {
            handlePlayerTap(playerId, 'pitch');
          } else {
            handleEmptySlotTap(pos);
          }
        }}
      >
        <div className={styles.listSlotPos}>{pos.split('_')[1]}</div>
        {player ? (
          <>
            <img src={player.photo_url ? getImageUrl(player.photo_url) : '/default-avatar.png'} className={styles.listSlotAvatar} />
            <div className={styles.listSlotName}>{player.name}</div>
            <div className={styles.listSlotRemove}>×</div>
          </>
        ) : (
          <div className={styles.listSlotEmpty}>選択してください</div>
        )}
      </div>
    );
  };

  const renderPitchSlot = (pos, isSetup) => {
    let playerIdStr = Object.keys(starterPositions).find(id => starterPositions[id] === pos);
    let playerId = playerIdStr ? Number(playerIdStr) : null;
    let player = players.find(p => p.user_id === playerId);
    const posClass = pos.replace(' ', '');
    
    if (phase === 'playing' && matchMode === 'external' && pos.startsWith('blue_')) {
      player = { user_id: 'dummy_' + pos, name: '相手', photo_url: null };
      playerId = player.user_id;
    }
    
    if (!isSetup && !player) {
      // In playing phase, render empty drop zone
      return (
        <div 
          key={pos} 
          className={`${styles.pitchSlot} ${styles['pos' + posClass]}`}
          data-drop-target={pos}
        />
      );
    }

    const isSelected = isSetup ? setupSelectedPos === pos : selectedCourtId === playerId;
    
    return (
      <div 
        key={pos} 
        className={`${styles.pitchSlot} ${styles['pos' + posClass]} ${isSelected ? styles.selectedSlot : ''}`}
        data-drop-target={pos}
        data-player-id={playerId || ''}
        onClick={!player ? () => handleEmptySlotTap(pos) : () => handlePlayerTap(playerId, 'pitch')}
      >
        {player ? (
          <>
            <img src={player.photo_url ? getImageUrl(player.photo_url) : '/default-avatar.png'} className={styles.pitchSlotAvatar} alt={player.name} />
            <div className={styles.pitchSlotName}>{player.name}</div>
            <div className={styles.pitchSlotPos}>{pos.replace('red_','').replace('blue_','')}</div>
          </>
        ) : (
          <>
            <div className={styles.pitchSlotPos}>{pos.replace('red_','').replace('blue_','')}</div>
            <div className={styles.pitchSlotEmpty}>+</div>
          </>
        )}
      </div>
    );
  };

  const setupPositions = matchMode === 'intra' ? 
    [`${matchInfo.team1_name || 'RED'}_Pivo`, `${matchInfo.team1_name || 'RED'}_AlaL`, `${matchInfo.team1_name || 'RED'}_AlaR`, `${matchInfo.team1_name || 'RED'}_Fixo`, `${matchInfo.team1_name || 'RED'}_GK`, 
     `${matchInfo.team2_name || 'BLUE'}_Pivo`, `${matchInfo.team2_name || 'BLUE'}_AlaL`, `${matchInfo.team2_name || 'BLUE'}_AlaR`, `${matchInfo.team2_name || 'BLUE'}_Fixo`, `${matchInfo.team2_name || 'BLUE'}_GK`] 
    : POSITIONS_EXTERNAL;

  const positions = phase === 'setup' ? setupPositions : POSITIONS_INTRA;

  return (
    <div className={styles.livePage}>
      <header className={styles.liveHeader}>
        <Link href="/admin/matches" className={styles.backBtn}>✕</Link>
        <div className={styles.headerTitle}>{matchMode === 'intra' ? `🔴 ${matchInfo.team1_name || 'RED'} vs ${matchInfo.team2_name || 'BLUE'} 🔵` : 'LIVE MATCH'}</div>
        <div style={{ width: '40px' }} />
      </header>

      {/* SETUP PHASE */}
      {phase === 'setup' && (
        <div className={styles.container}>
          <div className={styles.setupCard}>
            
            <div className={styles.btnGroup}>
              <button className={`${styles.modeBtn} ${matchMode === 'external' ? styles.active : ''}`} onClick={() => { setMatchMode('external'); setCourtIds([]); setStarterPositions({}); }}>対外試合 (5人)</button>
              <button className={`${styles.modeBtn} ${matchMode === 'intra' ? styles.active : ''}`} onClick={() => { setMatchMode('intra'); setCourtIds([]); setStarterPositions({}); }}>紅白戦 (10人)</button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>日付</label>
              <input type="date" className={styles.formInput} value={matchInfo.date} onChange={e => setMatchInfo({...matchInfo, date: e.target.value})} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>大会名 / イベント名</label>
              <input 
                type="text" 
                list="competitions"
                className={styles.formInput} 
                value={matchInfo.competition_name} 
                onChange={e => setMatchInfo({...matchInfo, competition_name: e.target.value})} 
                placeholder="大会名を入力・選択" 
              />
              <datalist id="competitions">
                {availableEvents.map(e => (
                  <option key={e.event_id} value={e.title.replace(/^\[大会\]\s*/, '')} />
                ))}
              </datalist>
            </div>

            {matchMode === 'external' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>対戦相手</label>
                <input type="text" className={styles.formInput} value={matchInfo.opponent_name} onChange={e => setMatchInfo({...matchInfo, opponent_name: e.target.value})} placeholder="例: FC東京" />
              </div>
            )}

            {matchMode === 'intra' && (
              <div style={{display: 'flex', gap: '10px'}}>
                <div className={styles.formGroup} style={{flex: 1}}>
                  <label className={styles.formLabel}>チーム1 (RED)</label>
                  <input type="text" className={styles.formInput} value={matchInfo.team1_name} onChange={e => setMatchInfo({...matchInfo, team1_name: e.target.value})} placeholder="RED" />
                </div>
                <div className={styles.formGroup} style={{flex: 1}}>
                  <label className={styles.formLabel}>チーム2 (BLUE)</label>
                  <input type="text" className={styles.formInput} value={matchInfo.team2_name} onChange={e => setMatchInfo({...matchInfo, team2_name: e.target.value})} placeholder="BLUE" />
                </div>
              </div>
            )}
            
            {matchMode === 'external' ? (
              <>
                <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>出席者選択 ({attendingIds.length}名)</h3>
                <div className={styles.startersGrid}>
                  {players.map(p => {
                    const isAttending = attendingIds.includes(p.user_id);
                    return (
                      <div key={p.user_id} className={`${styles.playerSelectCard} ${isAttending ? styles.selected : ''}`} onClick={() => toggleAttendee(p.user_id)}>
                        <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                        <div className={styles.playerName}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>チーム分け（参加者選択）</h3>
                <div className={styles.teamAssignGrid}>
                  {players.map(p => {
                    const team = playerTeams[p.user_id];
                    return (
                      <div key={p.user_id} className={styles.teamAssignCard}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                          <div className={styles.playerName}>{p.name}</div>
                        </div>
                        <div className={styles.teamBtns}>
                          <button 
                            className={`${styles.teamBtn} ${team === 'red' ? styles.activeRed : ''}`}
                            onClick={() => assignTeam(p.user_id, 'red')}
                          >RED</button>
                          <button 
                            className={`${styles.teamBtn} ${team === 'blue' ? styles.activeBlue : ''}`}
                            onClick={() => assignTeam(p.user_id, 'blue')}
                          >BLUE</button>
                          <button 
                            className={`${styles.teamBtn} ${!team ? styles.activeNone : ''}`}
                            onClick={() => assignTeam(p.user_id, null)}
                          >休</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {attendingIds.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', color: 'var(--color-gold)' }}>スタメン配置</h3>
                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>
                  {matchMode === 'external' ? 'ピッチ上の（＋）を押してからベンチメンバーをタップ' : 'ポジションを押してからベンチメンバーをタップ'}
                </p>
                
                {matchMode === 'external' ? (
                  <div className={styles.pitchContainer}>
                    <div className={styles.pitchCenterLine} />
                    <div className={styles.pitchCenterCircle} />
                    <div className={styles.pitchPenaltyAreaTop} />
                    <div className={styles.pitchPenaltyAreaBottom} />
                    {positions.map(pos => renderPitchSlot(pos, true))}
                  </div>
                ) : (
                  <div className={styles.intraSetupLayout}>
                    <div className={styles.teamSetupCol}>
                       <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} スタメン</h4>
                       <div className={styles.listSlotContainer}>
                         {['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK'].map(pos => renderListSlot(pos))}
                       </div>
                    </div>
                    <div className={styles.teamSetupCol}>
                       <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} スタメン</h4>
                       <div className={styles.listSlotContainer}>
                         {['blue_Pivo', 'blue_AlaL', 'blue_AlaR', 'blue_Fixo', 'blue_GK'].map(pos => renderListSlot(pos))}
                       </div>
                    </div>
                  </div>
                )}

                <h3 style={{ marginTop: '20px', color: '#ccc' }}>ベンチメンバー</h3>
                {matchMode === 'external' ? (
                  <div className={styles.startersGrid}>
                    {benchIds.map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      return (
                        <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                          <div className={styles.playerName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.intraBenchLayout}>
                    <div className={styles.teamBenchCol}>
                      <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} ベンチ</h4>
                      <div className={styles.startersGrid}>
                        {benchIds.filter(id => playerTeams[id] === 'red').map(id => {
                          const p = players.find(x => x.user_id === id);
                          if (!p) return null;
                          return (
                            <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                              <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                              <div className={styles.playerName}>{p.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.teamBenchCol}>
                      <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} ベンチ</h4>
                      <div className={styles.startersGrid}>
                        {benchIds.filter(id => playerTeams[id] === 'blue').map(id => {
                          const p = players.find(x => x.user_id === id);
                          if (!p) return null;
                          return (
                            <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                              <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                              <div className={styles.playerName}>{p.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <button className={styles.startBtn} onClick={handleStartMatch}>試合開始</button>
          </div>
        </div>
      )}

      {/* PLAYING PHASE */}
      {phase === 'playing' && (
        <div className={styles.container} style={{ paddingBottom: '120px' }} data-drop-target="bench">
          
          <div className={styles.scoreboard}>
            <div className={styles.scoreBox}>
              <div className={styles.scoreLabel}>{matchMode === 'intra' ? (matchInfo.team1_name || 'RED') : 'OURS'}</div>
              <div className={styles.scoreValue}>{score.us}</div>
            </div>
            <div className={styles.timerBox}>
              <div className={styles.timerValue}>{formatTime(timerSeconds)}</div>
              <div className={styles.timerControls}>
                <button className={`${styles.ctrlBtn} ${!isRunning ? styles.active : ''}`} onClick={() => setIsRunning(false)}>⏸️</button>
                <button className={`${styles.ctrlBtn} ${isRunning ? styles.active : ''}`} onClick={() => setIsRunning(true)}>▶️</button>
                <button className={styles.endMatchBtn} onClick={endMatch}>END</button>
              </div>
            </div>
            <div className={styles.scoreBox}>
              <div className={styles.scoreLabel}>{matchMode === 'intra' ? (matchInfo.team2_name || 'BLUE') : 'OPPONENT'}</div>
              <div className={styles.scoreValue}>{score.opponent}</div>
            </div>
          </div>

          <div className={styles.playArea}>
            <div className={styles.pitchContainer}>
              <div className={styles.pitchCenterLine} />
              <div className={styles.pitchCenterCircle} />
              <div className={styles.pitchPenaltyAreaTop} />
              <div className={styles.pitchPenaltyAreaBottom} />
              
              {/* Action Zones Overlay (TOP) */}
              <div className={styles.actionZoneGoal} style={{ pointerEvents: selectedCourtId ? 'auto' : 'none', opacity: selectedCourtId ? 1 : 0.4 }} onClick={() => handleAction('goal_top')}>⚽ ゴール</div>
              <div className={styles.actionZoneMissL} style={{ pointerEvents: selectedCourtId ? 'auto' : 'none', opacity: selectedCourtId ? 1 : 0.4 }} onClick={() => handleAction('shot_top')}>ノーゴール</div>
              <div className={styles.actionZoneMissR} style={{ pointerEvents: selectedCourtId ? 'auto' : 'none', opacity: selectedCourtId ? 1 : 0.4 }} onClick={() => handleAction('shot_top')}>ノーゴール</div>
              
              {/* Action Zones Overlay (BOTTOM) */}
              <div className={styles.actionZoneGoalOpponent} style={{ pointerEvents: (matchMode === 'external' || selectedCourtId) ? 'auto' : 'none', opacity: (matchMode === 'external' || selectedCourtId) ? 1 : 0.4 }} onClick={() => handleAction('goal_bottom')}>⚽ ゴール</div>
              <div className={styles.actionZoneMissLOpponent} style={{ pointerEvents: selectedCourtId ? 'auto' : 'none', opacity: selectedCourtId ? 1 : 0.4 }} onClick={() => handleAction('shot_bottom')}>ノーゴール</div>
              <div className={styles.actionZoneMissROpponent} style={{ pointerEvents: selectedCourtId ? 'auto' : 'none', opacity: selectedCourtId ? 1 : 0.4 }} onClick={() => handleAction('shot_bottom')}>ノーゴール</div>

              {positions.map(pos => renderPitchSlot(pos, false))}
            </div>

            {matchMode === 'external' ? (
              <div className={styles.benchSection} data-drop-target="bench">
                <h2 className={styles.sectionTitle} style={{fontSize:'1rem'}}>ベンチ</h2>
                <div className={styles.playerList}>
                  {benchIds.map(id => {
                    const p = players.find(x => x.user_id === id);
                    if (!p) return null;
                    const isSelected = swapSourceId === id;
                    return (
                      <div 
                        key={id} 
                        className={`${styles.playerRow} ${isSelected ? styles.selected : ''}`}
                        onClick={() => handlePlayerTap(id, 'bench')}
                      >
                        <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                        <div className={styles.playerRowName}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.intraBenchLayout} data-drop-target="bench">
                <div className={styles.teamBenchCol}>
                  <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} ベンチ</h4>
                  <div className={styles.playerList}>
                    {benchIds.filter(id => playerTeams[id] === 'red').map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      const isSelected = swapSourceId === id;
                      return (
                        <div 
                          key={id} 
                          className={`${styles.playerRow} ${isSelected ? styles.selected : ''}`}
                          onClick={() => handlePlayerTap(id, 'bench')}
                        >
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                          <div className={styles.playerRowName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.teamBenchCol}>
                  <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} ベンチ</h4>
                  <div className={styles.playerList}>
                    {benchIds.filter(id => playerTeams[id] === 'blue').map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      const isSelected = swapSourceId === id;
                      return (
                        <div 
                          key={id} 
                          className={`${styles.playerRow} ${isSelected ? styles.selected : ''}`}
                          onClick={() => handlePlayerTap(id, 'bench')}
                        >
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                          <div className={styles.playerRowName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.eventLogContainer} style={{marginTop: '20px'}}>
             <h3 className={styles.eventLogTitle}>直近のアクションログ</h3>
             <div className={styles.eventLogList}>
               {events.filter(e => ['goal', 'assist', 'save', 'catch', 'steal', 'block', 'pass_cut', 'sub_in', 'sub_out', 'position_change', 'lost_ball'].includes(e.event_type)).slice(-5).reverse().map((e, i) => {
                 const p = players.find(x => x.user_id === e.user_id)?.name;
                 const min = Math.floor(e.minute / 60);
                 const sec = String(e.minute % 60).padStart(2, '0');
                 const eventNames = {
                   goal: '⚽ ゴール', assist: '🅰️ アシスト', save: '🧤 セーブ', catch: '👐 キャッチ',
                   steal: '⚔️ 奪取', block: '🛡️ ブロック', pass_cut: '✂️ パスカット', lost_ball: '💥 ロスト',
                   sub_in: '🔄 IN', sub_out: '🔄 OUT', position_change: '↔️ 配置変更'
                 };
                 return <div key={i} className={styles.eventLogItem}>[{min}&apos;{sec}&quot;] {p} - {eventNames[e.event_type] || e.event_type}</div>;
               })}
             </div>
          </div>
        </div>
      )}

      {/* FINISHED PHASE */}
      {phase === 'finished' && (
        <div className={styles.container}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>MATCH FINISHED</h2>
            <div className={styles.summaryStats}>
              <div className={styles.summaryStatBox}><h3>最終スコア</h3><p>{score.us} - {score.opponent}</p></div>
              <div className={styles.summaryStatBox}><h3>試合時間</h3><p>{formatTime(timerSeconds)}</p></div>
            </div>
            <button className={styles.saveMatchBtn} onClick={handleSaveMatch}>この内容で保存する</button>
          </div>
        </div>
      )}
    </div>
  );
}
