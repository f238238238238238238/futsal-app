'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl } from '@/lib/api';
import styles from './editor.module.css';

export default function VideoAnalysisPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef(null);
  
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

  useEffect(() => {
    getPlayers().then(p => setPlayers(p.users || p || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !pendingAction && step === 'analyze') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction, step]);

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
        case 'lost_ball':
        case 'pass_miss':
        case 'goal':
        case 'opponent_goal':
        case 'shot':
        case 'shot_off':
        case 'concede':
        case 'foul':
        case 'foul_opponent':
        case 'side_out':
        case 'corner_kick':
          possessor = null; 
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
    if (videoRef.current) {
      setWasPlaying(!videoRef.current.paused);
      videoRef.current.pause();
    }
    const possessor = getBallPossessor(currentTime);
    
    let initialStep = 1;
    let initialData = { minute: currentTime };
    
    if (actionType === 'pass' && possessor && possessor !== 'opponent') {
      initialStep = 2;
      initialData.passer = possessor;
    }
    
    if (actionType === 'shot') {
      if (possessor === 'opponent') {
        initialStep = 20;
      } else if (possessor && possessor !== 'opponent') {
        initialStep = 10;
        initialData.shooter = possessor;
      }
    }
    
    setPendingAction({ type: actionType, step: initialStep, data: initialData });
  };

  const resumeVideo = () => {
    setPendingAction(null);
    if (wasPlaying && videoRef.current) {
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
      
      events.forEach(ev => {
        if (ev.event_type === 'goal' && statsMap[ev.user_id]) statsMap[ev.user_id].goals++;
        if (ev.event_type === 'goal' && ev.target_user_id && statsMap[ev.target_user_id]) statsMap[ev.target_user_id].assists++;
        if (ev.event_type === 'save' && statsMap[ev.user_id]) statsMap[ev.user_id].saves++;
        if (ev.event_type === 'catch' && statsMap[ev.user_id]) statsMap[ev.user_id].saves++; // Count catches as saves for stat box? Yes
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
                  <button className={styles.actionBtn} onClick={() => pauseForAction('kickoff')}>⚽ キックオフ</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('shot')}>🥅 シュート</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('pass')}>👟 パス</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('defense')}>🛡️ ディフェンス</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('ball_out')}>🚩 ボールアウト</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('free_kick')}>🎯 FK/PK</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('foul')}>⚠️ ファール</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('sub')}>🔄 交代</button>
                </div>
                
                <h3 style={{ marginBottom: '10px' }}>イベントログ</h3>
                {events.slice().reverse().map((ev, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', padding: '6px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      [{Math.floor(ev.minute / 60)}:{(ev.minute % 60).toString().padStart(2, '0')}] 
                      <span style={{ color: '#74c0fc', marginLeft: '5px' }}>{ev.event_type}</span>
                      {ev.user_id && <span style={{ marginLeft: '5px' }}>({players.find(p=>p.user_id===ev.user_id)?.name})</span>}
                    </span>
                    <button style={{ color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => {
                        const newEvents = [...events];
                        newEvents.splice(events.length - 1 - i, 1);
                        setEvents(newEvents);
                    }}>削除</button>
                  </div>
                ))}
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
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// EVENT MODAL COMPONENT (State Machine)
// ----------------------------------------------------
function EventModal({ action, setAction, addEvent, resume, activePlayers, benchPlayers, gkId, getPlayerPosition }) {
  const updateData = (updates) => setAction(prev => ({ ...prev, data: { ...prev.data, ...updates } }));
  const nextStep = (nextStepNum) => setAction(prev => ({ ...prev, step: nextStepNum }));
  
  const finish = (eventsToAdd) => {
    if (Array.isArray(eventsToAdd)) eventsToAdd.forEach(addEvent);
    else addEvent(eventsToAdd);
    resume();
  };

  const PlayerGrid = ({ onSelect, allowNone, players = activePlayers }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '1rem' }}>
      {players.map(p => (
        <button key={p.user_id} onClick={() => onSelect(p.user_id)} className={styles.saveBtn} style={{ background: '#333', border: '1px solid #555', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          {p.photo_url ? <img src={getImageUrl(p.photo_url)} alt={p.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{p.jersey_number || '-'}</div>}
          <span style={{ fontSize: '0.8rem' }}>{p.name}</span>
        </button>
      ))}
      {allowNone && <button onClick={() => onSelect(null)} className={styles.deleteBtn}>なし</button>}
    </div>
  );

  const Title = ({ text }) => <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', textAlign: 'center' }}>{text}</h3>;

  const renderContent = () => {
    const { type, step, data } = action;

    // --- KICKOFF ---
    if (type === 'kickoff') {
      if (step === 1) return <><Title text="誰が蹴ったか？" /><PlayerGrid onSelect={(id) => { updateData({ kicker: id }); nextStep(2); }} /></>;
      if (step === 2) return <><Title text="誰が受けたか？" /><PlayerGrid onSelect={(id) => finish({ event_type: 'kickoff', user_id: data.kicker, target_user_id: id })} /></>;
    }

    // --- SHOT ---
    if (type === 'shot') {
      if (step === 1) return (
        <>
          <Title text="どちらのシュート？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button className={styles.saveBtn} style={{ padding: '2rem' }} onClick={() => nextStep(10)}>自チーム</button>
            <button className={styles.deleteBtn} style={{ padding: '2rem' }} onClick={() => nextStep(20)}>相手チーム</button>
          </div>
        </>
      );
      // Own Team
      if (step === 10) return (
        <>
          <Title text="シュートの結果は？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'goal' }); nextStep(data.shooter ? 12 : 11); }}>得点</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'shot' }); nextStep(data.shooter ? 14 : 11); }}>キャッチされた</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'shot_off' }); nextStep(data.shooter ? 14 : 11); }}>枠外</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'saved' }); nextStep(data.shooter ? 13 : 11); }}>セーブされた</button>
          </div>
        </>
      );
      if (step === 11) return <><Title text="誰が打ったか？" /><PlayerGrid onSelect={(id) => { updateData({ shooter: id }); nextStep(data.res === 'goal' ? 12 : (data.res === 'saved' ? 13 : 14)); }} /></>;
      if (step === 12) return <><Title text="アシストは？" /><PlayerGrid allowNone onSelect={(id) => finish({ event_type: 'goal', user_id: data.shooter, target_user_id: id })} /></>;
      if (step === 13) return (
        <>
          <Title text="こぼれ球はどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: 'side_out' }])}>ボールアウト(サイド等)</button>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: 'corner_kick' }])}>コーナーキック</button>
            <button className={styles.saveBtn} onClick={() => nextStep(15)}>こぼれ球を誰かが拾った</button>
          </div>
        </>
      );
      if (step === 14) return <><Title text="確定します" /><button className={styles.saveBtn} style={{ width: '100%', padding: '1rem' }} onClick={() => finish({ event_type: data.res, user_id: data.shooter })}>保存</button></>;
      if (step === 15) return <><Title text="誰が拾ったか？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: 'pass', user_id: data.shooter, target_user_id: id }])} /></>;
      
      // Opponent
      if (step === 20) return (
        <>
          <Title text="結果は？ (GKの記録になります)" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.deleteBtn} onClick={() => finish({ event_type: 'concede', user_id: gkId })}>失点</button>
            <button className={styles.saveBtn} onClick={() => finish({ event_type: 'save', user_id: gkId })}>自チームがセーブ</button>
            <button className={styles.saveBtn} onClick={() => finish({ event_type: 'catch', user_id: gkId })}>自チームがキャッチ</button>
          </div>
        </>
      );
    }

    // --- PASS ---
    if (type === 'pass') {
      if (step === 1) return <><Title text="誰がパスした？" /><PlayerGrid onSelect={(id) => { updateData({ passer: id }); nextStep(2); }} /></>;
      if (step === 2) return (
        <>
          <Title text="結果は？" />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={styles.saveBtn} style={{ flex: 1, padding: '2rem' }} onClick={() => nextStep(3)}>成功</button>
            <button className={styles.deleteBtn} style={{ flex: 1, padding: '2rem' }} onClick={() => nextStep(4)}>ミス</button>
          </div>
        </>
      );
      if (step === 3) return <><Title text="誰が受けた？" /><PlayerGrid onSelect={(id) => finish({ event_type: 'pass', user_id: data.passer, target_user_id: id })} /></>;
      if (step === 4) return (
        <>
          <Title text="ボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.deleteBtn} onClick={() => finish({ event_type: 'pass_miss', user_id: data.passer })}>相手に奪われた</button>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'pass_miss', user_id: data.passer }, { event_type: 'side_out' }])}>サイドアウト</button>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'pass_miss', user_id: data.passer }, { event_type: 'corner_kick' }])}>相手のコーナーキック</button>
          </div>
        </>
      );
    }

    // --- DEFENSE ---
    if (type === 'defense') {
      if (step === 1) return (
        <>
          <Title text="どちらがボールを持っていた？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button className={styles.saveBtn} style={{ padding: '2rem' }} onClick={() => nextStep(20)}>自チーム<br/><small>(守備された)</small></button>
            <button className={styles.deleteBtn} style={{ padding: '2rem' }} onClick={() => nextStep(10)}>相手チーム<br/><small>(守備した)</small></button>
          </div>
        </>
      );
      // Own Team Defending (Opponent has ball)
      if (step === 10) return (
        <>
          <Title text="アクションは？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'block' }); nextStep(11); }}>ブロック</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'defense' }); nextStep(11); }}>クリア</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'pass_cut' }); nextStep(11); }}>インターセプト</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'steal' }); nextStep(11); }}>スティール</button>
          </div>
        </>
      );
      if (step === 11) return <><Title text="誰が行った？" /><PlayerGrid onSelect={(id) => finish({ event_type: data.action, user_id: id })} /></>;
      
      // Opponent Defending (Own Team has ball)
      if (step === 20) return <><Title text="誰がボールを持っていた？" /><PlayerGrid onSelect={(id) => { updateData({ actor: id }); nextStep(21); }} /></>;
      if (step === 21) return (
        <>
          <Title text="何をされた？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'block' }); nextStep(22); }}>ブロックされた(シュートミス)</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ action: 'defense' }); nextStep(22); }}>クリアされた</button>
            <button className={styles.deleteBtn} onClick={() => finish({ event_type: 'pass_miss', user_id: data.actor })}>インターセプトされた(パスミス扱い)</button>
            <button className={styles.deleteBtn} onClick={() => finish({ event_type: 'lost_ball', user_id: data.actor })}>スティールされた(ロスト扱い)</button>
          </div>
        </>
      );
      if (step === 22) return (
        <>
          <Title text="その後のボールはどうなった？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: data.action === 'block' ? 'shot_off' : 'defense', user_id: data.actor }, { event_type: 'side_out' }])}>ボールアウト(サイド等)</button>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: data.action === 'block' ? 'shot_off' : 'defense', user_id: data.actor }, { event_type: 'corner_kick' }])}>コーナーキック</button>
          </div>
        </>
      );
    }

    // --- BALL OUT ---
    if (type === 'ball_out') {
      return (
        <>
          <Title text="ボールアウト" />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={styles.saveBtn} style={{ flex: 1, padding: '2rem' }} onClick={() => finish({ event_type: 'corner_kick' })}>コーナーキック</button>
            <button className={styles.saveBtn} style={{ flex: 1, padding: '2rem' }} onClick={() => finish({ event_type: 'side_out' })}>サイドアウト</button>
          </div>
        </>
      );
    }

    // --- FREE KICK / PK ---
    if (type === 'free_kick') {
      if (step === 1) return <><Title text="誰が蹴った？" /><PlayerGrid onSelect={(id) => { updateData({ kicker: id }); nextStep(2); }} /></>;
      if (step === 2) return (
        <>
          <Title text="結果は？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => finish({ event_type: 'goal', user_id: data.kicker })}>ゴール</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'pass' }); nextStep(3); }}>パス成功</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ res: 'shot' }); nextStep(4); }}>セーブ/キャッチされた</button>
            <button className={styles.saveBtn} onClick={() => finish({ event_type: 'side_out' })}>ボールアウト</button>
            <button className={styles.deleteBtn} onClick={() => finish({ event_type: 'pass_miss', user_id: data.kicker })}>パスカット/ブロックされた</button>
          </div>
        </>
      );
      if (step === 3) return <><Title text="誰が受けた？" /><PlayerGrid onSelect={(id) => finish({ event_type: 'pass', user_id: data.kicker, target_user_id: id })} /></>;
      if (step === 4) return (
        <>
          <Title text="こぼれ球は？" />
          <div style={{ display: 'grid', gap: '8px' }}>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.kicker }, { event_type: 'side_out' }])}>ボールアウト</button>
            <button className={styles.saveBtn} onClick={() => finish([{ event_type: 'shot', user_id: data.kicker }, { event_type: 'corner_kick' }])}>コーナーキック</button>
          </div>
        </>
      );
    }

    // --- FOUL ---
    if (type === 'foul') {
      if (step === 1) return (
        <>
          <Title text="誰のファール？" />
          <PlayerGrid onSelect={(id) => finish({ event_type: 'foul', user_id: id })} />
          <button className={styles.deleteBtn} style={{ marginTop: '1rem', width: '100%', padding: '1rem' }} onClick={() => finish({ event_type: 'foul_opponent' })}>相手のファール</button>
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
          <button className={styles.deleteBtn} style={{ background: 'transparent', border: '1px solid #ff6b6b' }} onClick={resume}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
