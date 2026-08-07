'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl } from '@/lib/api';
import styles from './editor.module.css';

const EVENT_DISPLAY_NAMES = {
  'kickoff': 'キックオフ',
  'shot': 'シュート',
  'goal': 'ゴール',
  'saved': 'セーブされた',
  'shot_off': '枠外',
  'block': 'ブロック',
  'pass': 'パス',
  'pass_miss': 'パスミス',
  'pass_cut': 'インターセプト',
  'clear': 'クリア',
  'steal': 'スティール',
  'steal_miss': 'スティール失敗',
  'recovery': 'ボール回収',
  'lost_ball': 'ロスト',
  'side_out': 'キックイン',
  'corner_kick': 'コーナーキック',
  'goal_kick': 'ゴールクリアランス',
  'foul': 'ファール',
  'foul_opponent': '相手のファール',
  'sub_in': 'IN',
  'sub_out': 'OUT',
  'defense': 'ディフェンス',
  'concede': '失点',
  'catch': 'キャッチ',
  'save': 'セーブ',
  'opponent_goal': '相手のゴール',
  'opponent_shot_off': '相手のシュート枠外',
  'opponent_block': '相手のブロック',
  'opponent_pass': '相手のパス',
  'opponent_pass_fail': '相手のパスミス',
  'opponent_steal': '相手のスティール',
  'opponent_clear': '相手のクリア',
};

const displayEventType = (ev) => {
  const name = EVENT_DISPLAY_NAMES[ev.event_type] || ev.event_type;
  if (ev.team === 'opponent') return `[相手] ${name}`;
  return name;
};

const getEventIcon = (type) => {
  switch (type) {
    case 'goal': return '⚽';
    case 'shot': case 'shot_off': return '👟';
    case 'assist': case 'pass': return '🔁';
    case 'save': case 'catch': return '🧤';
    case 'block': case 'defense': case 'clear': case 'steal': case 'pass_cut': case 'opponent_block': return '🛡️';
    case 'recovery': return '🔄';
    case 'lost_ball': case 'pass_miss': return '💥';
    case 'foul': return '⚠️';
    case 'sub_in': return '🔼';
    case 'sub_out': return '🔽';
    default: return '📍';
  }
};

export default function VideoAnalysisPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef(null);
  
  const [logTab, setLogTab] = useState('all');
  
  // Step: 'setup', 'analyze', 'save'
  const [step, setStep] = useState('setup');
  
  // Setup state
  const [attendees, setAttendees] = useState(new Set());
  const [starters, setStarters] = useState(new Set());
  const [gkId, setGkId] = useState(null);
  const [positions, setPositions] = useState({});
  
  // Save state
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  const [matchDate, setMatchDate] = useState(localISOTime);
  const [opponentName, setOpponentName] = useState('');
  const [competitionName, setCompetitionName] = useState('動画解析');
  const [ourScore, setOurScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  
  // Modal State
  const [pendingAction, setPendingAction] = useState(null); // { type, step, data }
  const [wasPlaying, setWasPlaying] = useState(false);
  const [setupLoaded, setSetupLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('futsal_video_editor_setup');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.attendees) setAttendees(new Set(parsed.attendees));
        if (parsed.starters) setStarters(new Set(parsed.starters));
        if (parsed.gkId) setGkId(parsed.gkId);
        if (parsed.positions) setPositions(parsed.positions);
      }
      const savedEvents = localStorage.getItem('futsal_video_editor_events');
      if (savedEvents) {
        setEvents(JSON.parse(savedEvents));
      }
    } catch (e) {}
    setSetupLoaded(true);
  }, []);

  useEffect(() => {
    if (setupLoaded) {
      localStorage.setItem('futsal_video_editor_setup', JSON.stringify({
        attendees: Array.from(attendees),
        starters: Array.from(starters),
        gkId,
        positions
      }));
    }
  }, [attendees, starters, gkId, positions, setupLoaded]);

  useEffect(() => {
    if (setupLoaded) {
      localStorage.setItem('futsal_video_editor_events', JSON.stringify(events));
    }
  }, [events, setupLoaded]);

  useEffect(() => {
    getPlayers().then(p => setPlayers(p.users || p || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ignore inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      const key = e.key.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

      if (!pendingAction && step === 'analyze') {
        if (key === ' ' || key === '0') {
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
        } else if (key === '1') { e.preventDefault(); pauseForAction('kickoff'); }
        else if (key === '2') { e.preventDefault(); pauseForAction('shot'); }
        else if (key === '3') { e.preventDefault(); pauseForAction('pass'); }
        else if (key === '4') { e.preventDefault(); pauseForAction('lost'); }
        else if (key === '5') { e.preventDefault(); pauseForAction('foul'); }
        else if (key === '6') { e.preventDefault(); pauseForAction('sub'); }
      } else if (pendingAction) {
        if (['1','2','3','4','5','6','7','8','9','0'].includes(key)) {
          e.preventDefault();
          const btn = document.querySelector(`button[data-key="${key}"]`);
          if (btn) btn.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction, step, events, starters, positions, currentTime]);

  // Derived Active Players
  const getActivePlayers = (minute) => {
    const active = new Set(starters);
    events.forEach(ev => {
      if (ev.minute <= minute) {
        if (ev.event_type === 'substitution') {
          active.delete(ev.user_id); // Out
          active.add(ev.target_user_id); // In
        }
        if (ev.event_type === 'sub_out') active.delete(ev.user_id);
        if (ev.event_type === 'sub_in') active.add(ev.user_id);
      }
    });
    return players.filter(p => active.has(p.user_id));
  };
  
  const activePlayers = getActivePlayers(currentTime);

  // Ball Possessor Logic
  const getBallPossessor = (minute) => {
    let possessor = null;
    const sorted = [...events].sort((a,b) => a.minute - b.minute);
    for (const ev of sorted) {
      if (ev.minute > minute) break;
      switch (ev.event_type) {
        case 'pass':
        case 'kickoff':
          possessor = ev.target_user_id || 'opponent';
          break;
        case 'pass_cut':
        case 'steal':
        case 'recovery':
        case 'catch':
          possessor = ev.user_id || 'opponent';
          break;
        case 'opponent_steal':
          possessor = 'opponent';
          break;
        case 'lost_ball':
        case 'pass_miss':
        case 'goal':
        case 'opponent_goal':
        case 'shot':
        case 'shot_off':
        case 'concede':
        case 'foul':
        case 'foul_opponent':
        case 'clear':
        case 'opponent_clear':
        case 'defense':
          possessor = null; 
          break;
        case 'side_out':
        case 'corner_kick':
        case 'goal_kick':
          possessor = ev.team === 'opponent' ? 'opponent' : (ev.user_id || null);
          break;
      }
    }
    return possessor;
  };
  const currentPossessor = getBallPossessor(currentTime);

  const getPlayerPosition = (minute, userId) => {
    let pos = starters.has(userId) ? (userId === gkId ? 'GK' : positions[userId]) : null;
    const sorted = [...events].sort((a,b) => a.minute - b.minute);
    for (const ev of sorted) {
      if (ev.minute > minute) break;
      if (ev.event_type === 'sub_in' && ev.user_id === userId) {
        pos = ev.position;
      }
    }
    return pos || 'Fixo';
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoSrc(URL.createObjectURL(file));
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const pauseForAction = (actionType) => {
    let t = currentTime;
    if (videoRef.current) {
      t = videoRef.current.currentTime;
      setCurrentTime(t);
      setWasPlaying(!videoRef.current.paused);
      videoRef.current.pause();
    }
    const possessor = getBallPossessor(t);
    
    let initialStep = 1;
    let initialData = { minute: t };
    
    if (actionType === 'lost') {
      if (possessor === 'opponent') {
        initialStep = 1; // Opponent possession lost -> ask who tackled
      } else if (possessor && possessor !== 'opponent') {
        initialStep = 10;
        initialData.actor = possessor;
      }
    }
    
    if (actionType === 'pass') {
      if (possessor === 'opponent') {
        initialStep = 1;
      } else if (possessor && possessor !== 'opponent') {
        initialStep = 102;
        initialData.passer = possessor;
      }
    }
    
    if (actionType === 'shot') {
      if (possessor === 'opponent') {
        initialStep = 20;
      } else if (possessor && possessor !== 'opponent') {
        initialStep = 10;
        initialData.shooter = possessor;
      }
    }
    
    if (actionType === 'defense') {
      if (possessor && possessor !== 'opponent') {
        initialStep = 50; // Opponent defense (we have the ball)
        initialData.victim = possessor;
      }
    }
    
    setPendingAction({ type: actionType, step: initialStep, data: initialData });
  };

  const resumeVideo = () => {
    setPendingAction(null);
    if (videoRef.current) {
        videoRef.current.play().catch(e => console.log('play error', e));
    }
  };

  const addEvent = (eventObj) => {
    setEvents(prev => [...prev, { ...eventObj, minute: Math.floor(currentTime) }]);
  };

  // Setup Handlers
  const toggleAttendee = (id) => {
    const next = new Set(attendees);
    if (next.has(id)) {
      next.delete(id);
      const nextStarters = new Set(starters);
      nextStarters.delete(id);
      setStarters(nextStarters);
      if (gkId === id) setGkId(null);
    } else {
      next.add(id);
    }
    setAttendees(next);
  };

  const toggleStarter = (id) => {
    const next = new Set(starters);
    if (next.has(id)) {
      next.delete(id);
      if (gkId === id) setGkId(null);
    } else {
      if (next.size < 5) {
        next.add(id);
        const nextAttendees = new Set(attendees);
        nextAttendees.add(id);
        setAttendees(nextAttendees);
      } else {
        alert("スタメンは最大5名までです");
      }
    }
    setStarters(next);
  };

  const handlePositionChange = (id, pos) => {
    setPositions(prev => ({ ...prev, [id]: pos }));
    if (pos === 'GK') {
      setGkId(id);
    } else if (gkId === id) {
      setGkId(null);
    }
  };

  const handleSaveMatch = async () => {
    try {
      // Calculate goals, assists, saves from events
      const statsMap = {};
      Array.from(attendees).forEach(uid => {
        statsMap[uid] = { goals: 0, assists: 0, saves: 0 };
      });
      
      events.forEach((ev, i) => {
        if (ev.event_type === 'goal') {
          if (statsMap[ev.user_id]) statsMap[ev.user_id].goals++;
          
          // Auto-detect assist
          let assistFound = false;
          for (let j = i - 1; j >= 0; j--) {
            const prevEv = events[j];
            // Break chain if opponent touches or possession is lost
            if (['steal', 'opponent_pass', 'intercept', 'clear', 'opponent_block', 'lost_ball', 'pass_miss', 'trap_miss'].includes(prevEv.event_type)) {
               break;
            }
            if (prevEv.team === 'opponent') {
               break;
            }
            // If the previous valid event was a pass/kickoff to the goal scorer, grant assist
            if ((prevEv.event_type === 'pass' || prevEv.event_type === 'kickoff') && prevEv.target_user_id === ev.user_id) {
               if (prevEv.user_id && statsMap[prevEv.user_id]) {
                 statsMap[prevEv.user_id].assists++;
                 assistFound = true;
               }
               break;
            }
          }
        }
        if (ev.event_type === 'save' && statsMap[ev.user_id]) statsMap[ev.user_id].saves++;
        if (ev.event_type === 'catch' && statsMap[ev.user_id]) statsMap[ev.user_id].saves++;
      });

      const payload = {
        date: matchDate,
        opponent_name: opponentName,
        competition_name: competitionName,
        our_score: parseInt(ourScore, 10) || 0,
        opponent_score: parseInt(opponentScore, 10) || 0,
        stats: Array.from(attendees).map(uid => ({
          user_id: uid,
          is_starter: starters.has(uid) ? 1 : 0,
          position: starters.has(uid) ? (uid === gkId ? 'GK' : (positions[uid] || 'Fixo')) : null,
          goals: statsMap[uid]?.goals || 0,
          assists: statsMap[uid]?.assists || 0,
          saves: statsMap[uid]?.saves || 0,
        })),
        events: events
      };
      await createMatch(payload);
      localStorage.removeItem('futsal_video_editor_events'); // Clear saved events on success
      alert('保存しました');
      router.push('/admin/matches');
    } catch (err) {
      console.error(err);
      alert('保存エラー');
    }
  };

  return (
    <div className={styles.editorPage}>
      <header className={styles.editorHeader}>
        <div className={styles.headerTitle}>🎬 動画解析エディタ（新規作成）</div>
        {step === 'analyze' && (
          <button className={styles.saveBtn} onClick={() => setStep('save')}>保存画面へ</button>
        )}
      </header>

      <div className={styles.mainContent}>
        {step === 'setup' && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div style={{ padding: '2rem', background: '#1a1a1a', borderRadius: '8px', overflowY: 'auto', width: '100%', maxWidth: '800px', maxHeight: '100%' }}>
              <h2 style={{ marginBottom: '1rem', color: 'var(--color-gold)' }}>1. 出席者とスタメンの設定</h2>
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                {!videoSrc && (
                  <label className={styles.uploadLabel} style={{ display: 'inline-block', margin: '0 auto' }}>
                    📁 ローカル動画を選択 (MP4)
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
                  </label>
                )}
                {videoSrc && <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ 動画選択済み</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px', gap: '8px', marginBottom: '8px', textAlign: 'center', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                <div style={{ textAlign: 'left', fontWeight: 'bold' }}>選手名</div>
                <div style={{ fontWeight: 'bold' }}>出席</div>
                <div style={{ fontWeight: 'bold' }}>スタメン</div>
                <div style={{ fontWeight: 'bold' }}>ポジション</div>
              </div>
              {players.map(p => (
                <div key={p.user_id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px', gap: '8px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {p.photo_url ? <img src={getImageUrl(p.photo_url)} alt={p.name} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{p.jersey_number || '-'}</div>}
                    <span>{p.name}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}><input type="checkbox" checked={attendees.has(p.user_id)} onChange={() => toggleAttendee(p.user_id)} style={{ transform: 'scale(1.2)' }} /></div>
                  <div style={{ textAlign: 'center' }}><input type="checkbox" checked={starters.has(p.user_id)} onChange={() => toggleStarter(p.user_id)} style={{ transform: 'scale(1.2)' }} /></div>
                  <div style={{ textAlign: 'center' }}>
                    <select 
                      value={gkId === p.user_id ? 'GK' : (positions[p.user_id] || '')}
                      onChange={(e) => handlePositionChange(p.user_id, e.target.value)}
                      disabled={!starters.has(p.user_id)}
                      style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px', borderRadius: '4px', width: '100%' }}
                    >
                      <option value=""></option>
                      <option value="Fixo">Fixo</option>
                      <option value="Ala L">Ala L</option>
                      <option value="Ala R">Ala R</option>
                      <option value="Pivo">Pivo</option>
                      <option value="GK">GK</option>
                    </select>
                  </div>
                </div>
              ))}
              
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button 
                  className={styles.saveBtn} 
                  disabled={!videoSrc || starters.size === 0 || !gkId}
                  onClick={() => setStep('analyze')}
                  style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                >
                  解析を開始する
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'analyze' && (
          <div className={styles.leftColumn}>
            <div style={{ display: 'flex', gap: '1rem', height: '70vh' }}>
              <div className={styles.videoSection} style={{ flex: '2', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <video src={videoSrc} ref={videoRef} className={styles.videoElement} controls onTimeUpdate={handleTimeUpdate} style={{ flex: 1, maxHeight: '100%' }} />
              </div>
              
              <div className={styles.logSection} style={{ flex: '1', overflowY: 'auto', background: '#111', padding: '1rem' }}>
                <div style={{ padding: '0.5rem', background: '#333', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                  ⚽ 現在ボール保持: {currentPossessor === 'opponent' ? <span style={{color: '#ff6b6b'}}>相手チーム</span> : (currentPossessor ? <span style={{color: '#4CAF50'}}>{players.find(p => p.user_id === currentPossessor)?.name}</span> : <span style={{color: '#aaa'}}>不明/プレー外</span>)}
                </div>
                <h3 style={{ marginBottom: '10px' }}>アクション</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('kickoff')}>⚽ キックオフ [1]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('shot')}>🥅 シュート [2]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('pass')}>👟 パス [3]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('lost')}>🛡️ ロスト [4]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('foul')}>⚠️ ファール [5]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('sub')}>🔄 交代 [6]</button>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, flex: 1 }}>イベントログ</h3>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => setLogTab('all')} style={{ padding: '4px 10px', background: logTab === 'all' ? '#555' : '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>全イベント</button>
                    <button onClick={() => setLogTab('timeline')} style={{ padding: '4px 10px', background: logTab === 'timeline' ? '#555' : '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>選手別</button>
                  </div>
                </div>

                {logTab === 'all' ? (
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {events.slice().reverse().map((ev, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', padding: '6px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          <span style={{ color: '#aaa', fontSize: '0.75rem' }}>[{Math.floor(ev.minute / 60)}:{(ev.minute % 60).toString().padStart(2, '0')}]</span> 
                          <span style={{ color: '#74c0fc', marginLeft: '5px' }}>{displayEventType(ev)}</span>
                          {ev.user_id && <span style={{ marginLeft: '5px', color: '#eee' }}>({players.find(p=>p.user_id===ev.user_id)?.name})</span>}
                        </span>
                        <button style={{ color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} onClick={() => {
                            const newEvents = [...events];
                            newEvents.splice(events.length - 1 - i, 1);
                            setEvents(newEvents);
                        }}>削除</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px' }}>
                       {activePlayers.map(p => {
                         const playerEvents = events.filter(ev => ev.user_id === p.user_id);
                         if (playerEvents.length === 0) return null;
                         return (
                           <div key={p.user_id} style={{ display: 'contents' }}>
                             <div style={{ padding: '8px 4px', fontSize: '0.8rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>{p.name}</div>
                             <div style={{ padding: '8px 4px', borderBottom: '1px solid #333', display: 'flex', gap: '6px', overflowX: 'auto', flexWrap: 'nowrap', alignItems: 'center' }}>
                               {playerEvents.map((ev, i) => {
                                 const icon = getEventIcon(ev.event_type);
                                 return (
                                   <div key={i} title={`[${Math.floor(ev.minute / 60)}:${(ev.minute % 60).toString().padStart(2, '0')}] ${displayEventType(ev)} (クリックで削除)`} 
                                        style={{ cursor: 'pointer', padding: '4px', background: '#333', borderRadius: '4px', fontSize: '1rem', minWidth: '32px', textAlign: 'center', userSelect: 'none', transition: 'background 0.2s' }} 
                                        onMouseEnter={e => e.currentTarget.style.background = '#444'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#333'}
                                        onClick={() => {
                                     if (confirm(`[${Math.floor(ev.minute / 60)}:${(ev.minute % 60).toString().padStart(2, '0')}] イベント「${displayEventType(ev)}」を削除しますか？`)) {
                                       setEvents(events.filter(e => e !== ev));
                                     }
                                   }}>
                                     {icon}
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'save' && (
          <div style={{ padding: '2rem', background: '#1a1a1a', borderRadius: '8px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>試合データの保存</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className={styles.playerSelect} />
              <input type="text" placeholder="大会名" value={competitionName} onChange={e => setCompetitionName(e.target.value)} className={styles.playerSelect} />
              <input type="text" placeholder="相手チーム" value={opponentName} onChange={e => setOpponentName(e.target.value)} className={styles.playerSelect} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="number" placeholder="自チーム得点" value={ourScore} onChange={e => setOurScore(e.target.value)} className={styles.playerSelect} />
                <input type="number" placeholder="相手チーム得点" value={opponentScore} onChange={e => setOpponentScore(e.target.value)} className={styles.playerSelect} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className={styles.deleteBtn} onClick={() => setStep('analyze')}>戻る</button>
                <button className={styles.saveBtn} onClick={handleSaveMatch}>保存して終了</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {pendingAction && (
        <EventModal 
          action={pendingAction} 
          setAction={setPendingAction}
          addEvent={addEvent}
          resume={resumeVideo}
          activePlayers={activePlayers}
          benchPlayers={players.filter(p => attendees.has(p.user_id) && !activePlayers.find(a => a.user_id === p.user_id))}
          gkId={gkId}
          getPlayerPosition={getPlayerPosition}
          currentPossessor={currentPossessor}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// EVENT MODAL COMPONENT (State Machine)
// ----------------------------------------------------
function EventModal({ action, setAction, addEvent, resume, activePlayers, benchPlayers, gkId, getPlayerPosition, currentPossessor }) {
  const updateData = (updates) => setAction(prev => ({ ...prev, data: { ...prev.data, ...updates } }));
  const nextStep = (nextStepNum) => setAction(prev => ({ ...prev, step: nextStepNum }));
  
  const finish = (eventsToAdd) => {
    if (Array.isArray(eventsToAdd)) eventsToAdd.forEach(addEvent);
    else addEvent(eventsToAdd);
    resume();
  };

  const PlayerGrid = ({ onSelect, allowNone, players = activePlayers }) => (
    <div style={{ display: 'grid', gridTemplateColumns: players.length <= 5 ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '8px', marginTop: '1rem' }}>
      {players.map((p, index) => (
        <button key={p.user_id} data-key={index + 1 < 9 ? String(index + 1) : undefined} onClick={() => onSelect(p.user_id)} className={styles.saveBtn} style={{ position: 'relative', background: '#333', border: '1px solid #555', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {index + 1 < 9 && <span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>[{index + 1}]</span>}
          {p.photo_url ? <img src={getImageUrl(p.photo_url)} alt={p.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{p.jersey_number || '-'}</div>}
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{p.name}</span>
        </button>
      ))}
      {allowNone && <button data-key="9" onClick={() => onSelect(null)} className={styles.deleteBtn} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>[9]</span>なし</button>}
    </div>
  );

  const Title = ({ text }) => <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', textAlign: 'center' }}>{text}</h3>;

  const renderContent = () => {
    const { type, step, data } = action;

    // --- KICKOFF ---
    if (type === 'kickoff') {
      if (step === 1) return (
        <>
          <Title text="どちらのキックオフ？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button data-key="1" className={styles.saveBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => nextStep(10)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>自チーム</button>
            <button data-key="2" className={styles.deleteBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => finish({ event_type: 'kickoff', team: 'opponent' })}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>相手チーム</button>
          </div>
        </>
      );
      if (step === 10) return <><Title text="誰が蹴ったか？" /><PlayerGrid onSelect={(id) => { updateData({ kicker: id }); nextStep(11); }} /></>;
      if (step === 11) return <><Title text="誰が受けたか？" /><PlayerGrid onSelect={(id) => finish({ event_type: 'kickoff', user_id: data.kicker, target_user_id: id })} /></>;
    }

    // --- SHOT ---
    if (type === 'shot') {
      if (step === 1) return (
        <>
          <Title text="どちらのシュート？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button data-key="1" className={styles.saveBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => nextStep(10)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>自チーム</button>
            <button data-key="2" className={styles.deleteBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => nextStep(20)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>相手チーム</button>
          </div>
        </>
      );
      // Own Team
      if (step === 10) return (
        <>
          <Title text="シュートの結果は？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => { 
              if (data.shooter) finish({ event_type: 'goal', user_id: data.shooter }); 
              else { updateData({ res: 'goal' }); nextStep(11); } 
            }}>得点 [1]</button>
            <button data-key="2" className={styles.saveBtn} onClick={() => { 
              if (data.shooter) finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: 'catch', team: 'opponent' }, { event_type: 'goal_kick', team: 'opponent' }]);
              else { updateData({ res: 'catch' }); nextStep(11); }
            }}>キャッチされた [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { 
              if (data.shooter) finish([{ event_type: 'shot_off', user_id: data.shooter }, { event_type: 'goal_kick', team: 'opponent' }]);
              else { updateData({ res: 'shot_off' }); nextStep(11); }
            }}>枠外 [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ res: 'saved' }); nextStep(data.shooter ? 13 : 11); }}>セーブされた [4]</button>
            <button data-key="5" className={styles.deleteBtn} onClick={() => { updateData({ res: 'block' }); nextStep(data.shooter ? 13 : 11); }}>ブロックされた [5]</button>
          </div>
        </>
      );
      if (step === 11) return <><Title text="誰が打ったか？" /><PlayerGrid onSelect={(id) => { 
        if (data.res === 'goal') { finish({ event_type: 'goal', user_id: id }); }
        else if (data.res === 'saved' || data.res === 'block') { updateData({ shooter: id }); nextStep(13); }
        else if (data.res === 'shot_off') { finish([{ event_type: 'shot_off', user_id: id }, { event_type: 'goal_kick', team: 'opponent' }]); }
        else if (data.res === 'catch') { finish([{ event_type: 'shot', user_id: id }, { event_type: 'catch', team: 'opponent' }, { event_type: 'goal_kick', team: 'opponent' }]); }
      }} /></>;
      if (step === 13) return (
        <>
          <Title text="こぼれ球はどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(15)}>自チームが拾った [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(16); }}>サイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(16); }}>コーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(16); }}>ゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      // step 14 is intentionally skipped
      if (step === 15) return <><Title text="誰が拾ったか？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: 'recovery', user_id: id }])} /></>;
      if (step === 16) return (
        <>
          <Title text="どっちのボールになった？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
              else nextStep(17);
            }}>自チームのボール [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: data.out_type, team: 'opponent' }])}>相手チームのボール [2]</button>
          </div>
        </>
      );
      if (step === 17) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      
      // Opponent
      if (step === 20) return (
        <>
          <Title text="結果は？ (GKの記録になります)" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.deleteBtn} onClick={() => finish({ event_type: 'opponent_goal' })}>失点 [1]</button>
            <button data-key="2" className={styles.saveBtn} onClick={() => finish([{ event_type: 'catch', user_id: gkId }, { event_type: 'goal_kick', team: 'own', user_id: gkId }])}>自チームがキャッチ [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ res: 'save' }); nextStep(21); }}>自チームのセーブ [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ res: 'block' }); nextStep(22); }}>自チームのブロック [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => finish([{ event_type: 'opponent_shot_off' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }])}>枠外 [5]</button>
          </div>
        </>
      );
      if (step === 21) return (
        <>
          <Title text="セーブ後のボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(23)}>自チームが拾った [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'save', user_id: gkId }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(24); }}>サイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(24); }}>コーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(24); }}>ゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 22) return <><Title text="誰がブロックした？" /><PlayerGrid onSelect={(id) => { updateData({ blocker: id }); nextStep(25); }} /></>;
      if (step === 23) return <><Title text="誰が拾った？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'save', user_id: gkId }, { event_type: 'recovery', user_id: id }])} /></>;
      if (step === 24) return (
        <>
          <Title text="どっちのボールになった？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([{ event_type: data.res === 'block' ? 'block' : 'save', user_id: data.res === 'block' ? data.blocker : gkId }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
              else nextStep(27);
            }}>自チームのボール [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: data.res === 'block' ? 'block' : 'save', user_id: data.res === 'block' ? data.blocker : gkId }, { event_type: data.out_type, team: 'opponent' }])}>相手チームのボール [2]</button>
          </div>
        </>
      );
      if (step === 27) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: data.res === 'block' ? 'block' : 'save', user_id: data.res === 'block' ? data.blocker : gkId }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      if (step === 25) return (
        <>
          <Title text="ブロック後のボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(26)}>自チームが拾った [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'block', user_id: data.blocker }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(24); }}>サイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(24); }}>コーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(24); }}>ゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 26) return <><Title text="誰が拾った？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'block', user_id: data.blocker }, { event_type: 'recovery', user_id: id }])} /></>;
      // step 30 intentionally removed
    }

    // --- PASS ---
    if (type === 'pass') {
      if (step === 1) {
        if (currentPossessor === 'opponent') {
          return (
            <>
              <Title text="相手のパス結果は？" />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button data-key="1" className={styles.deleteBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => finish({ event_type: 'opponent_pass' })}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>成功</button>
                <button data-key="2" className={styles.saveBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => nextStep(121)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>失敗/防いだ</button>
              </div>
            </>
          );
        } else {
          return <><Title text="誰がパスした？" /><PlayerGrid onSelect={(id) => { updateData({ passer: id }); nextStep(102); }} /></>;
        }
      }

      // --- OUR POSSESSION PASS FLOW ---
      if (step === 102) return (
        <>
          <Title text="結果は？" />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button data-key="1" className={styles.saveBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => nextStep(103)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>成功</button>
            <button data-key="2" className={styles.deleteBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => nextStep(104)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>ミス</button>
          </div>
        </>
      );
      if (step === 103) return <><Title text="誰が受けた？" /><PlayerGrid onSelect={(id) => finish({ event_type: 'pass', user_id: data.passer, target_user_id: id })} /></>;
      if (step === 104) return (
        <>
          <Title text="ミスの原因は？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => { updateData({ fault: 'passer' }); nextStep(141); }}>出し手（パスがずれた等） [1]</button>
            <button data-key="2" className={styles.saveBtn} onClick={() => { updateData({ fault: 'receiver' }); nextStep(140); }}>受け手（トラップミス等） [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ fault: 'none' }); nextStep(141); }}>どちらでもない [3]</button>
          </div>
        </>
      );
      if (step === 140) return <><Title text="誰のトラップミス？" /><PlayerGrid onSelect={(id) => { updateData({ target_user_id: id }); nextStep(141); }} /></>;

      const missEvents = [];
      if (data.fault === 'receiver') {
         missEvents.push({ event_type: 'pass', user_id: data.passer, target_user_id: data.target_user_id });
         missEvents.push({ event_type: 'trap_miss', user_id: data.target_user_id });
      } else {
         // Either passer fault or none. If none, user_id is null so no one is penalized, but team stats still count it.
         missEvents.push({ event_type: 'pass_miss', user_id: data.fault === 'passer' ? data.passer : null, team: 'own' });
      }

      if (step === 141) return (
        <>
          <Title text="相手にどう防がれた？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.deleteBtn} onClick={() => finish([...missEvents, { event_type: 'intercept', team: 'opponent' }])}>インターセプトされた [1]</button>
            <button data-key="2" className={styles.saveBtn} onClick={() => { updateData({ action: 'clear' }); nextStep(105); }}>クリアされた [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => finish([...missEvents, { event_type: 'side_out', team: 'opponent' }])}>そのままサイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => finish([...missEvents, { event_type: 'corner_kick', team: 'opponent' }])}>そのままコーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => finish([...missEvents, { event_type: 'goal_kick', team: 'opponent' }])}>そのままゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 105) return (
        <>
          <Title text="クリアされたボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(106)}>自チームが拾った [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(107); }}>サイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(107); }}>コーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(107); }}>ゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 106) return <><Title text="誰が拾った？" /><PlayerGrid onSelect={(id) => finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: 'recovery', user_id: id }])} /></>;
      if (step === 107) return (
        <>
          <Title text="どっちのボールになった？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
              else nextStep(108);
            }}>自チームのボール [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: 'goal_kick', team: 'opponent' }]);
              else finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: data.out_type, team: 'opponent' }]);
            }}>相手チームのボール [2]</button>
          </div>
        </>
      );
      if (step === 108) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;

      // --- OPPONENT POSSESSION PASS FLOW ---
      if (step === 121) return (
        <>
          <Title text="自チームはどう防いだ？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => { updateData({ action: 'pass_cut' }); nextStep(122); }}>インターセプトした [1]</button>
            <button data-key="2" className={styles.saveBtn} onClick={() => { updateData({ action: 'clear' }); nextStep(123); }}>クリアした [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(128); }}>そのままサイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(128); }}>そのままコーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }])}>そのままゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 122) return <><Title text="誰が奪った？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'pass_cut', user_id: id }])} /></>;
      if (step === 123) return <><Title text="誰がクリアした？" /><PlayerGrid onSelect={(id) => { updateData({ clearer: id }); nextStep(124); }} /></>;
      if (step === 124) return (
        <>
          <Title text="クリアされたボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(125)}>自チームが拾った [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
            <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(126); }}>サイドアウトになった [3]</button>
            <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(126); }}>コーナーキックになった [4]</button>
            <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(126); }}>ゴールスロー(GK)になった [5]</button>
          </div>
        </>
      );
      if (step === 125) return <><Title text="誰が拾った？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: 'recovery', user_id: id }])} /></>;
      if (step === 126) return (
        <>
          <Title text="どっちのボールになった？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
              else nextStep(127);
            }}>自チームのボール [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => {
              if (data.out_type === 'goal_kick') finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: 'goal_kick', team: 'opponent' }]);
              else finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: data.out_type, team: 'opponent' }]);
            }}>相手チームのボール [2]</button>
          </div>
        </>
      );
      if (step === 127) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
    }

    // --- LOST (formerly DEFENSE) ---
    if (type === 'lost') {
      if (currentPossessor === 'opponent') {
        if (step === 1) return <><Title text="誰がタックルした？" /><PlayerGrid onSelect={(id) => { updateData({ actor: id }); nextStep(201); }} /></>;
        if (step === 201) return (
          <>
            <Title text="ボールはどうなった？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(202)}>自チームが拾った [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'steal', user_id: data.actor }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
              <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(203); }}>サイドアウトになった [3]</button>
              <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(203); }}>コーナーキックになった [4]</button>
              <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(203); }}>ゴールスロー(GK)になった [5]</button>
            </div>
          </>
        );
        if (step === 202) return (
          <>
            <Title text="誰が拾った？" />
            <PlayerGrid onSelect={(id) => {
              if (id === data.actor) {
                // If the tackler themselves picked it up, it's just a steal/possession change, no separate recovery needed for them
                finish([{ event_type: 'steal', user_id: data.actor }]);
              } else {
                finish([{ event_type: 'steal', user_id: data.actor }, { event_type: 'recovery', user_id: id }]);
              }
            }} />
          </>
        );
        if (step === 203) return (
          <>
            <Title text="どっちのボールになった？" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: 'steal', user_id: data.actor }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
                else nextStep(204);
              }}>自チームのボール [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: 'steal', user_id: data.actor }, { event_type: 'goal_kick', team: 'opponent' }]);
                else finish([{ event_type: 'steal', user_id: data.actor }, { event_type: data.out_type, team: 'opponent' }]);
              }}>相手チームのボール [2]</button>
            </div>
          </>
        );
        if (step === 204) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'steal', user_id: data.actor }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      } else {
        // Our possession - direct lost
        if (step === 10) return (
          <>
            <Title text="ロストとして記録しますか？" />
            <div style={{ textAlign: 'center' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'recovery', team: 'opponent' }])}>はい（相手ボールへ） [1]</button>
            </div>
          </>
        );
      }
    }

    // --- FOUL ---
    if (type === 'foul') {
      if (step === 1) return (
        <>
          <Title text="ファールの種類は？" />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button data-key="1" className={styles.saveBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => { updateData({ foul_type: 'fk' }); nextStep(301); }}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>フリーキック(FK)</button>
            <button data-key="2" className={styles.saveBtn} style={{ flex: 1, padding: '2rem', position: 'relative' }} onClick={() => { updateData({ foul_type: 'pk' }); nextStep(301); }}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>ペナルティキック(PK)</button>
          </div>
        </>
      );
      if (step === 301) return (
        <>
          <Title text="どっちのボールになった？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(302)}>自チームのボール [1]</button>
            <button data-key="2" className={styles.deleteBtn} onClick={() => {
              if (currentPossessor === 'opponent') {
                finish([{ event_type: 'foul', team: 'own' }, { event_type: data.foul_type === 'pk' ? 'pk' : 'free_kick', team: 'opponent' }]);
              } else {
                finish([{ event_type: 'foul', team: 'own' }, { event_type: data.foul_type === 'pk' ? 'pk' : 'free_kick', team: 'opponent' }]);
              }
            }}>相手チームのボール [2]</button>
          </div>
        </>
      );
      if (step === 302) return (
        <>
          <Title text="誰が蹴る？" />
          <PlayerGrid onSelect={(id) => {
            // If it became our ball, it was opponent's foul
            finish([{ event_type: 'foul_opponent' }, { event_type: data.foul_type === 'pk' ? 'pk' : 'free_kick', team: 'own', user_id: id }]);
          }} />
        </>
      );
    }

    // --- SUB ---
    if (type === 'sub') {
      if (step === 1) return <><Title text="下げる選手(OUT)" /><PlayerGrid onSelect={(id) => { updateData({ out: id }); nextStep(2); }} /></>;
      if (step === 2) return (
        <>
          <Title text="入れる選手(IN)" />
          {benchPlayers.length > 0 ? (
            <PlayerGrid players={benchPlayers} onSelect={(id) => {
                const outPos = getPlayerPosition(data.minute, data.out);
                finish([{ event_type: 'sub_out', user_id: data.out }, { event_type: 'sub_in', user_id: id, position: outPos }]);
            }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>ベンチに選手がいません</div>
          )}
        </>
      );
    }

    return <div>Unknown Action</div>;
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#222', padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '600px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        {renderContent()}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button data-key="0" className={styles.deleteBtn} style={{ background: 'transparent', border: '1px solid #ff6b6b' }} onClick={resume}>キャンセル [0]</button>
        </div>
      </div>
    </div>
  );
}
