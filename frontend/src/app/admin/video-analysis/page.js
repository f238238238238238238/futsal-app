'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch } from '@/lib/api';
import styles from './editor.module.css';

export default function StandaloneVideoEditorPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [videoSrc, setVideoSrc] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  
  // Japan time timezone offset applied for default date
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  
  const [matchDate, setMatchDate] = useState(localISOTime);
  const [opponentName, setOpponentName] = useState('');
  const [competitionName, setCompetitionName] = useState('動画解析');
  const [ourScore, setOurScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  
  const [ourFeature, setOurFeature] = useState('緑のビブス');
  const [oppFeature, setOppFeature] = useState('白のシャツ');
  const [attackDir, setAttackDir] = useState('左から右');

  // Drag state
  const [draggingIdx, setDraggingIdx] = useState(null);

  const [attendees, setAttendees] = useState(new Set());
  const [starters, setStarters] = useState(new Set());
  const [positions, setPositions] = useState({});

  const [wasPlayingBeforeEdit, setWasPlayingBeforeEdit] = useState(false);
  const [possessionUserId, setPossessionUserId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    getPlayers()
      .then(p => {
        const users = p.users || p || [];
        setPlayers(users);
        // By default, everyone is unselected, or maybe auto-select? Let's leave empty.
      })
      .catch(err => console.error(err));
  }, []);

  // Keyboard shortcut for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        // Prevent default spacebar scrolling unless we are typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const resumeVideoIfNeeded = () => {
    if (wasPlayingBeforeEdit && videoRef.current) {
      videoRef.current.play();
    }
    setWasPlayingBeforeEdit(false);
  };

  const insertEvent = (type, actorId, targetId = '') => {
    if (!videoRef.current) return;
    const newEvent = {
      event_type: type,
      user_id: actorId || '',
      target_user_id: targetId,
      minute: Math.floor(videoRef.current.currentTime),
      position: '' // Can be used for target_id later
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const isKickoffAvailable = () => {
    const rev = [...events].reverse();
    const lastKickoffIdx = rev.findIndex(e => e.event_type === 'kickoff');
    const lastGoalIdx = rev.findIndex(e => e.event_type === 'goal');
    if (lastKickoffIdx === -1) return true;
    if (lastGoalIdx === -1) return false;
    return lastGoalIdx < lastKickoffIdx; // index is reversed, so smaller index means more recent
  };

  const addEvent = (type) => {
    if (!videoRef.current) return;
    
    const pauseForAction = () => {
      if (!pendingAction && selectedEventIndex === null) setWasPlayingBeforeEdit(!videoRef.current.paused);
      videoRef.current.pause();
    };

    if (type === 'kickoff') {
      pauseForAction();
      setPendingAction({ type: 'kickoff', step: 1 });
      return;
    }

    if (type === 'substitution') {
      pauseForAction();
      const newEvent = { event_type: type, user_id: '', minute: Math.floor(videoRef.current.currentTime), position: '' };
      setEvents(prev => [...prev, newEvent]);
      setTimeout(() => setSelectedEventIndex(events.length), 0);
      return;
    }
    
    if (type === 'goal' || type === 'shot_off') {
      const uid = possessionUserId || 'opponent';
      insertEvent(type, uid);
      setPossessionUserId(null);
      setPendingAction(null);
      return;
    }

    if (type === 'pass') {
      if (possessionUserId) {
        pauseForAction();
        setPendingAction({ type: 'pass', step: 2, actor: possessionUserId });
      } else {
        insertEvent('pass', 'opponent', 'opponent');
      }
      return;
    }

    if (type === 'pass_miss') {
      if (possessionUserId) {
        insertEvent('pass_miss', possessionUserId);
        setPossessionUserId(null);
      } else {
        pauseForAction();
        setPendingAction({ type: 'recovery', from: 'pass_miss', actor: 'opponent', step: 1 });
      }
      return;
    }

    if (type === 'lost_ball') {
      const uid = possessionUserId || 'opponent';
      insertEvent('lost_ball', uid);
      setPossessionUserId(null);
      setPendingAction(null);
      return;
    }

    if (type === 'block') {
      pauseForAction();
      if (possessionUserId) {
        insertEvent('shot', possessionUserId);
        setPendingAction({ type: 'recovery', from: 'block', actor: 'opponent', step: 1 });
      } else {
        setPendingAction({ type: 'block_and_recovery', step: 1 });
      }
      return;
    }

    if (type === 'save') {
      pauseForAction();
      if (possessionUserId) {
        insertEvent('shot', possessionUserId);
        setPendingAction({ type: 'recovery', from: 'save', actor: 'opponent', step: 1 });
      } else {
        const gks = Array.from(starters).filter(uid => positions[uid] === 'GK');
        if (gks.length === 1) {
          setPendingAction({ type: 'recovery', from: 'save', actor: gks[0], step: 1 });
        } else {
          setPendingAction({ type: 'save_and_recovery', step: 1 });
        }
      }
      return;
    }

    if (type === 'catch') {
      if (possessionUserId) {
        insertEvent('shot', possessionUserId);
        insertEvent('catch', 'opponent');
        setPossessionUserId(null);
      } else {
        const gks = Array.from(starters).filter(uid => positions[uid] === 'GK');
        const gkId = gks.length > 0 ? gks[0] : (Array.from(starters)[0] || 'dummy');
        insertEvent('catch', gkId);
        setPossessionUserId(gkId);
      }
      return;
    }

    if (type === 'pass_cut' || type === 'steal') {
      if (possessionUserId) {
        insertEvent(type, 'opponent');
        setPossessionUserId(null);
      } else {
        pauseForAction();
        setPendingAction({ type: type, step: 1 });
      }
      return;
    }
  };

  const handlePlayerIconClick = (userId) => {
    if (!pendingAction) {
      if (userId === 'opponent') {
        setPossessionUserId(null);
      } else {
        setPossessionUserId(possessionUserId === userId ? null : userId);
      }
      return;
    }

    if (pendingAction.step === 1) {
      if (['pass', 'kickoff'].includes(pendingAction.type)) {
        setPendingAction({ type: pendingAction.type, step: 2, actor: userId });
      } else if (pendingAction.type === 'block_and_recovery') {
        setPendingAction({ type: 'recovery', from: 'block', actor: userId, step: 1 });
      } else if (pendingAction.type === 'save_and_recovery') {
        setPendingAction({ type: 'recovery', from: 'save', actor: userId, step: 1 });
      } else if (pendingAction.type === 'recovery') {
        insertEvent(pendingAction.from, pendingAction.actor);
        insertEvent('recovery', userId === 'opponent' ? 'opponent' : userId);
        setPossessionUserId(userId === 'opponent' ? null : userId);
        setPendingAction(null);
        resumeVideoIfNeeded();
      } else {
        insertEvent(pendingAction.type, userId);
        if (['pass_cut', 'catch', 'steal'].includes(pendingAction.type)) {
           setPossessionUserId(userId === 'opponent' ? null : userId);
        } else if (['lost_ball', 'shot', 'goal', 'save', 'shot_off'].includes(pendingAction.type)) {
           setPossessionUserId(null);
        } else {
           setPossessionUserId(userId === 'opponent' ? null : userId);
        }
        setPendingAction(null);
        resumeVideoIfNeeded();
      }
    } else if (pendingAction.step === 2 && ['pass', 'kickoff'].includes(pendingAction.type)) {
      insertEvent(pendingAction.type, pendingAction.actor, userId);
      setPossessionUserId(userId === 'opponent' ? null : userId);
      setPendingAction(null);
      resumeVideoIfNeeded();
    }
  };

  const getActionLabel = (action) => {
    const type = action?.type || action?.event_type;
    switch(type) {
      case 'pass': return 'パス';
      case 'kickoff': return 'キックオフ';
      case 'shot': return 'シュート';
      case 'goal': return '得点';
      case 'block': return 'ブロック';
      case 'save': return 'セーブ';
      case 'catch': return 'キャッチ';
      case 'pass_cut': return 'パスカット';
      case 'steal': return 'スティール';
      case 'lost_ball': return 'ロスト';
      case 'shot_off': return '枠外シュート';
      case 'pass_miss': return 'パスミス';
      case 'recovery': return 'リカバリー(こぼれ球回収)';
      default: return '';
    }
  };

  const getPendingBannerText = () => {
    if (!pendingAction) return null;
    const actionName = getActionLabel(pendingAction);
    
    if (pendingAction.type === 'block_and_recovery') return 'ブロックした選手を選択してください';
    if (pendingAction.type === 'save_and_recovery') return 'セーブしたGKを選択してください';
    if (pendingAction.type === 'recovery') return 'こぼれ球を拾った選手(または相手)を選択してください';

    if (pendingAction.step === 1) {
      return `${actionName} を行った選手を選択してください`;
    }
    if (pendingAction.step === 2 && ['pass', 'kickoff'].includes(pendingAction.type)) {
      const actorName = pendingAction.actor === 'opponent' ? '相手' : (players.find(p => p.user_id === pendingAction.actor)?.name || '選手');
      return `${actorName} からの ${actionName} の受け手を選択してください`;
    }
    return null;
  };

  const closeEditor = () => {
    setSelectedEventIndex(null);
    if (wasPlayingBeforeEdit && videoRef.current) {
      videoRef.current.play();
    }
    setWasPlayingBeforeEdit(false);
  };

  const handleTrackClick = (e) => {
    // If we are dragging, don't seek
    if (draggingIdx !== null) return;
    if (!trackRef.current || !videoRef.current || duration === 0) return;
    
    // Ignore clicks on markers themselves
    if (e.target !== trackRef.current && e.target.className !== styles.currentTimeIndicator) {
        return;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    closeEditor();
  };

  const handleMarkerMouseDown = (e, index) => {
    e.stopPropagation();
    if (videoRef.current && selectedEventIndex === null) {
      setWasPlayingBeforeEdit(!videoRef.current.paused);
      videoRef.current.pause();
    }
    setSelectedEventIndex(index);
    setDraggingIdx(index);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingIdx === null || !trackRef.current || duration === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const newTime = Math.floor((x / rect.width) * duration);
      
      setEvents(prev => {
        const next = [...prev];
        next[draggingIdx].minute = newTime;
        return next;
      });
    };

    const handleMouseUp = () => {
      if (draggingIdx !== null) {
        setDraggingIdx(null);
      }
    };

    if (draggingIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIdx, duration]);

  const updateSelectedEvent = (field, value) => {
    if (selectedEventIndex === null) return;
    setEvents(prev => {
      const next = [...prev];
      next[selectedEventIndex][field] = value;
      return next;
    });
  };

  const removeSelectedEvent = () => {
    if (selectedEventIndex === null) return;
    setEvents(prev => prev.filter((_, i) => i !== selectedEventIndex));
    setSelectedEventIndex(null);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) throw new Error("JSONは配列である必要があります");
      
      const importedEvents = parsed.map(ev => ({
        event_type: ev.event_type || 'pass',
        user_id: ev.user_id || '',
        target_user_id: ev.target_user_id || '',
        minute: ev.minute || 0,
        position: ev.position || ''
      }));
      
      setEvents(prev => [...prev, ...importedEvents]);
      setShowImportModal(false);
      setImportJsonText('');
      alert(`${importedEvents.length}件のイベントをインポートしました`);
    } catch (err) {
      alert("インポート失敗: " + err.message);
    }
  };

  const handleSaveClick = () => {
    if (events.length === 0) {
      if (!confirm('イベントが一つも記録されていません。このまま保存しますか？')) return;
    }
    
    if (ourScore === '') {
       const goals = events.filter(e => e.event_type === 'goal').length;
       setOurScore(goals.toString());
    }
    if (opponentScore === '') {
       const oppGoals = events.filter(e => e.event_type === 'opponent_goal').length;
       setOpponentScore(oppGoals.toString());
    }
    
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!matchDate || !opponentName) {
      alert('日付と対戦相手を入力してください');
      return;
    }
    
    try {
      // Aggregate stats from events
      const userStats = {};
      
      events.forEach(ev => {
        if (!ev.user_id || ev.user_id === 'opponent' || typeof ev.user_id === 'string') return;
        const uid = parseInt(ev.user_id, 10);
        if (!userStats[uid]) {
          userStats[uid] = { goals: 0, assists: 0, saves: 0 };
        }
        
        if (ev.event_type === 'goal') userStats[uid].goals += 1;
        if (ev.event_type === 'assist') userStats[uid].assists += 1;
        if (ev.event_type === 'save') userStats[uid].saves += 1;
      });

      // Combine attendees and userStats
      // Anyone in attendees is added to stats. Anyone in userStats is also added.
      const allStatsUsers = new Set([...Array.from(attendees), ...Object.keys(userStats).map(id => parseInt(id, 10))]);
      
      const stats = Array.from(allStatsUsers).map(userId => {
        const st = userStats[userId] || { goals: 0, assists: 0, saves: 0 };
        return {
          user_id: parseInt(userId, 10),
          is_starter: starters.has(parseInt(userId, 10)) ? 1 : 0,
          position: positions[userId] || null,
          goals: st.goals,
          assists: st.assists,
          saves: st.saves
        };
      });

      const payload = {
        date: matchDate,
        opponent_name: opponentName,
        competition_name: competitionName,
        our_score: ourScore !== '' ? parseInt(ourScore, 10) : null,
        opponent_score: opponentScore !== '' ? parseInt(opponentScore, 10) : null,
        duration_seconds: Math.floor(duration),
        events: events,
        stats: stats
      };
      
      const res = await createMatch(payload);
      alert('タイムラインと試合データを保存しました！');
      setShowSaveModal(false);
      router.push(`/matches/${res.match_id}`);
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  };

  if (authLoading) return <div className={styles.editorPage}><p>Loading...</p></div>;
  if (!isAdmin) return <div className={styles.editorPage}><p>管理者権限が必要です</p></div>;

  const getEventClass = (type) => {
    if (type === 'pass') return styles.pass;
    if (type === 'shot') return styles.shot;
    if (type === 'goal') return styles.goal;
    if (type === 'opponent_goal') return styles.opponent_goal;
    if (type === 'opponent_pass') return styles.opponent_pass;
    if (type === 'shot_off') return styles.shot_off;
    if (type === 'block') return styles.block;
    if (type === 'pass_cut' || type === 'steal') return styles.pass_cut;
    if (type === 'save' || type === 'catch') return styles.save;
    if (type === 'lost_ball' || type === 'pass_miss') return styles.lost_ball;
    return '';
  };

  const toggleAttendee = (userId) => {
    const next = new Set(attendees);
    if (next.has(userId)) {
      next.delete(userId);
      // If removed from attendees, also remove from starters
      const nextStarters = new Set(starters);
      nextStarters.delete(userId);
      setStarters(nextStarters);
    } else {
      next.add(userId);
    }
    setAttendees(next);
  };

  const toggleStarter = (userId) => {
    const next = new Set(starters);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
      // If added to starters, also add to attendees
      const nextAttendees = new Set(attendees);
      nextAttendees.add(userId);
      setAttendees(nextAttendees);
    }
    setStarters(next);
  };

  const updatePosition = (userId, pos) => {
    setPositions(prev => ({ ...prev, [userId]: pos }));
  };

  const getActivePlayers = (minute) => {
    if (starters.size === 0) return players;
    const active = new Set(starters);
    events.forEach(ev => {
      if (ev.minute <= minute) {
        if (ev.event_type === 'substitution') {
          active.delete(ev.target_user_id);
          if (ev.user_id) active.add(ev.user_id);
        } else if (ev.event_type === 'sub_in') {
          if (ev.user_id) active.add(ev.user_id);
        } else if (ev.event_type === 'sub_out') {
          active.delete(ev.user_id);
        }
      }
    });
    return players.filter(p => active.has(p.user_id));
  };

  return (
    <div className={styles.editorPage}>
      <header className={styles.editorHeader}>
        <Link href="/admin" className={styles.backBtn}>← ADMIN</Link>
        <div className={styles.headerTitle}>🎬 動画解析ハブ（新規試合登録）</div>
        <button className={styles.globalSaveBtn} onClick={handleSaveClick}>登録して保存</button>
      </header>

      <div className={styles.mainContent}>
        
        <div className={styles.leftColumn}>
          <div style={{ display: 'flex', gap: '1rem', height: '50vh', marginBottom: '1rem' }}>
            {/* Video Area */}
            <div className={styles.videoSection} style={{ flex: '1', height: '100%', borderRadius: 'var(--radius-lg)' }}>
              {!videoSrc && (
                <div className={styles.uploadOverlay}>
                <label className={styles.uploadLabel}>
                  📁 ローカル動画を選択 (MP4)
                  <input type="file" accept="video/*" className={styles.fileInput} onChange={handleVideoUpload} />
                </label>
                <p style={{marginTop: '1rem', color: '#aaa', fontSize: '0.9rem'}}>※サーバーにはアップロードされません。ブラウザ上で即座に再生されます。</p>
              </div>
            )}
            {videoSrc && (
              <div className={styles.videoWrapper} style={{ height: '100%', maxHeight: '100%' }}>
                <video 
                  ref={videoRef}
                  src={videoSrc} 
                  className={styles.videoElement}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                />
              </div>
            )}
            </div>

            {/* Event Log Section */}
            <div className={styles.logSection}>
              <div className={styles.sidebarTitle}>📜 イベントログ</div>
              {events.slice().reverse().map((ev, i) => {
                const pName = players.find(p => p.user_id === ev.user_id)?.name || ev.user_id;
                const tName = players.find(p => p.user_id === ev.target_user_id)?.name || ev.target_user_id;
                
                let text = getActionLabel(ev);
                if (ev.user_id === 'opponent') text = `(相手) ${text}`;
                else if (ev.event_type === 'substitution') text = '交代';
                else if (ev.event_type === 'pass' || ev.event_type === 'kickoff') text = `${pName} から ${tName} へ${text}`;
                else text = `${pName} が${text}`;

                const min = Math.floor(ev.minute / 60);
                const sec = (ev.minute % 60).toString().padStart(2, '0');

                return (
                  <div key={`log-${i}`} className={styles.logItem}>
                    <span className={styles.logItemTime}>{min}:{sec}</span>
                    <span>{text}</span>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div style={{ color: '#aaa', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>まだ記録はありません</div>
              )}
            </div>
          </div>

        {/* Timeline Area */}
        <div className={styles.timelineSection}>
          <div className={styles.toolbar}>
            <button className={`${styles.actionBtn} ${styles.kickoff}`} onClick={() => addEvent('kickoff')} disabled={!isKickoffAvailable()}>📣 キックオフ</button>
            <button className={`${styles.actionBtn} ${styles.goal}`} onClick={() => addEvent('goal')}>⚽ 得点 (Goal)</button>
            <button className={`${styles.actionBtn} ${styles.pass}`} onClick={() => addEvent('pass')}>🔁 パス</button>
            <button className={`${styles.actionBtn} ${styles.pass_miss}`} onClick={() => addEvent('pass_miss')}>💥 パスミス</button>
            <button className={`${styles.actionBtn} ${styles.shot_off}`} onClick={() => addEvent('shot_off')}>☄️ 枠外シュート</button>
            <button className={`${styles.actionBtn} ${styles.block}`} onClick={() => addEvent('block')}>🛡️ ブロック</button>
            <button className={`${styles.actionBtn} ${styles.pass_cut}`} onClick={() => addEvent('pass_cut')}>🛡️ パスカット</button>
            <button className={`${styles.actionBtn} ${styles.pass_cut}`} onClick={() => addEvent('steal')}>🛡️ スティール</button>
            <button className={`${styles.actionBtn} ${styles.save}`} onClick={() => addEvent('save')}>🧤 セーブ</button>
            <button className={`${styles.actionBtn} ${styles.catch}`} onClick={() => addEvent('catch')}>🤲 キャッチ</button>
            <button className={`${styles.actionBtn} ${styles.lost_ball}`} onClick={() => addEvent('lost_ball')}>🔻 ロスト</button>
            <button className={`${styles.actionBtn}`} style={{ background: '#3b5bdb', borderColor: '#3b5bdb' }} onClick={() => addEvent('substitution')}>🔄 交代</button>
            
            <div style={{ flex: 1 }} />
            <button className={styles.actionBtn} style={{ background: '#333', color: '#fff', border: '1px solid #555' }} onClick={() => setShowImportModal(true)}>🤖 AIデータを取り込む</button>
          </div>

          <div className={styles.activePlayersArea}>
            {getPendingBannerText() && (
              <div className={styles.pendingActionBanner}>{getPendingBannerText()}</div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {players.filter(p => starters.has(p.user_id)).map(p => {
                const isPossessor = possessionUserId === p.user_id;
                const isPendingTarget = pendingAction?.step === 2 && ['pass', 'kickoff'].includes(pendingAction?.type) && pendingAction?.actor !== p.user_id;
                return (
                  <div 
                    key={p.user_id} 
                    className={`${styles.activePlayer} ${isPossessor ? styles.isPossessor : ''} ${isPendingTarget ? styles.isPendingTarget : ''}`}
                    onClick={() => handlePlayerIconClick(p.user_id)}
                  >
                    <div className={styles.activePlayerAvatar}>
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className={styles.activePlayerImg} />
                      ) : (
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{p.jersey_number}</span>
                      )}
                    </div>
                    <div className={styles.activePlayerName}>{p.name}</div>
                  </div>
                );
              })}
              
              <div 
                className={`${styles.activePlayer} ${styles.opponent} ${possessionUserId === null ? styles.isPossessor : ''} ${pendingAction?.step === 2 && pendingAction?.actor !== 'opponent' ? styles.isPendingTarget : ''}`}
                onClick={() => handlePlayerIconClick('opponent')}
              >
                <div className={styles.activePlayerAvatar}>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>相手</span>
                </div>
                <div className={styles.activePlayerName}>Opponent</div>
              </div>

              {players.filter(p => starters.has(p.user_id)).length === 0 && (
                <div style={{ color: '#aaa', fontSize: '0.9rem', padding: '1rem' }}>右側のパネルから「先発」にチェックを入れてください</div>
              )}
            </div>
          </div>

          <div 
            className={styles.trackContainer} 
            ref={trackRef}
            onMouseDown={handleTrackClick}
          >
            {/* Current Time Indicator */}
            {duration > 0 && (
              <div 
                className={styles.currentTimeIndicator} 
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            )}

            {/* Events */}
            {duration > 0 && events.map((ev, idx) => {
              const leftPercent = (ev.minute / duration) * 100;
              const isSelected = selectedEventIndex === idx;
              return (
                <div 
                  key={idx}
                  className={`${styles.eventMarker} ${getEventClass(ev.event_type)} ${isSelected ? styles.selected : ''}`}
                  style={{ left: `${leftPercent}%` }}
                  onMouseDown={(e) => handleMarkerMouseDown(e, idx)}
                />
              );
            })}

            {/* Editor Popup (Rendered outside the marker to avoid clipping issues) */}
            {selectedEventIndex !== null && events[selectedEventIndex] && duration > 0 && (() => {
              const ev = events[selectedEventIndex];
              const leftPercent = (ev.minute / duration) * 100;
              const activePlayersList = getActivePlayers(ev.minute);
              return (
                <div 
                  className={styles.eventEditDialog} 
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    left: `${leftPercent}%`,
                    transform: leftPercent < 15 ? 'translateX(0)' : (leftPercent > 85 ? 'translateX(-100%)' : 'translateX(-50%)'),
                    top: (ev.event_type === 'pass' || ev.event_type === 'substitution') ? '-210px' : '-160px'
                  }}
                >
                  <div className={styles.dialogTitle}>イベント編集 ({Math.floor(ev.minute/60)}:{(ev.minute%60).toString().padStart(2,'0')})</div>
                  
                  <select 
                    className={styles.playerSelect}
                    value={ev.event_type}
                    onChange={e => updateSelectedEvent('event_type', e.target.value)}
                  >
                    <option value="pass">パス</option>
                    <option value="shot">シュート (枠内)</option>
                    <option value="shot_off">枠外シュート</option>
                    <option value="goal">ゴール</option>
                    <option value="block">ブロック</option>
                    <option value="pass_cut">パスカット</option>
                    <option value="steal">スティール</option>
                    <option value="recovery">リカバリー(こぼれ球回収)</option>
                    <option value="lost_ball">ロスト</option>
                    <option value="pass_miss">パスミス</option>
                    <option value="save">セーブ</option>
                    <option value="catch">キャッチ</option>
                    <option value="substitution">交代</option>
                  </select>

                  {ev.event_type === 'substitution' ? (
                    <>
                      <select 
                        className={styles.playerSelect}
                        value={ev.target_user_id || ''}
                        onChange={e => updateSelectedEvent('target_user_id', e.target.value)}
                      >
                        <option value="">-- 下がる選手 (Out) --</option>
                        {activePlayersList.map(p => (
                          <option key={p.user_id} value={p.user_id}>{p.name}</option>
                        ))}
                      </select>
                      <select 
                        className={styles.playerSelect}
                        value={ev.user_id || ''}
                        onChange={e => updateSelectedEvent('user_id', e.target.value)}
                      >
                        <option value="">-- 入る選手 (In) --</option>
                        {players.filter(p => !activePlayersList.find(a => a.user_id === p.user_id)).map(p => (
                          <option key={p.user_id} value={p.user_id}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <select 
                        className={styles.playerSelect}
                        value={ev.user_id || ''}
                        onChange={e => updateSelectedEvent('user_id', e.target.value)}
                      >
                        <option value="">-- {ev.event_type === 'pass' ? '出し手' : '選手'}を選択 --</option>
                        <option value="opponent">相手チーム</option>
                        {activePlayersList.map(p => (
                          <option key={p.user_id} value={p.user_id}>{p.name}</option>
                        ))}
                      </select>

                      {ev.event_type === 'pass' && (
                        <select 
                          className={styles.playerSelect}
                          value={ev.target_user_id || ''}
                          onChange={e => updateSelectedEvent('target_user_id', e.target.value)}
                        >
                          <option value="">-- 受け手を選択 --</option>
                          <option value="opponent">相手チーム</option>
                          {activePlayersList.map(p => (
                            <option key={p.user_id} value={p.user_id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}

                  <div className={styles.dialogActions}>
                    <button className={styles.deleteBtn} onClick={() => {
                      removeSelectedEvent();
                      closeEditor();
                    }}>削除</button>
                    <button className={styles.saveBtn} onClick={closeEditor}>閉じる</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        </div>

        {/* Sidebar */}
        <div className={styles.rightSidebar} style={{ width: '300px' }}>
          <div className={styles.sidebarTitle}>👥 参加メンバー設定</div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '8px' }}>
            参加とスタメンを設定できます。<br/>
            (イベントを追加した選手は自動で集計されます)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 30px 70px', gap: '4px', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '4px', fontSize: '0.8rem', color: '#ccc', textAlign: 'center' }}>
            <div style={{ textAlign: 'left' }}>選手名</div>
            <div>参加</div>
            <div>先発</div>
            <div>Pos</div>
          </div>
          {players.map(p => (
            <div key={p.user_id} style={{ display: 'grid', gridTemplateColumns: '1fr 30px 30px 70px', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
              <div style={{ fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </div>
              <div style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={attendees.has(p.user_id)} 
                  onChange={() => toggleAttendee(p.user_id)} 
                  style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={starters.has(p.user_id)} 
                  onChange={() => toggleStarter(p.user_id)} 
                  style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                />
              </div>
              <div>
                {starters.has(p.user_id) && (
                  <select 
                    style={{ width: '100%', fontSize: '0.75rem', padding: '2px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}
                    value={positions[p.user_id] || ''}
                    onChange={e => updatePosition(p.user_id, e.target.value)}
                  >
                    <option value="">--</option>
                    <option value="FIXO">FIXO</option>
                    <option value="ALA">ALA</option>
                    <option value="PIVO">PIVO</option>
                    <option value="GOLEIRO">GK</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {showSaveModal && (
        <div className={styles.uploadOverlay}>
          <div className={styles.eventEditDialog} style={{ position: 'relative', top: 0, transform: 'none', padding: '2rem', minWidth: '400px' }}>
            <h2 className={styles.dialogTitle} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>試合データとして保存</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>試合日</label>
                <input type="date" className={styles.playerSelect} value={matchDate} onChange={e => setMatchDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>試合名 / 大会名</label>
                <input type="text" className={styles.playerSelect} placeholder="例: 練習試合" value={competitionName} onChange={e => setCompetitionName(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <label>対戦相手</label>
              <input type="text" className={styles.playerSelect} placeholder="相手チーム名" value={opponentName} onChange={e => setOpponentName(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>自チーム 得点 (任意)</label>
                <input type="number" min="0" className={styles.playerSelect} placeholder="0" value={ourScore} onChange={e => setOurScore(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>相手チーム 得点 (任意)</label>
                <input type="number" min="0" className={styles.playerSelect} placeholder="0" value={opponentScore} onChange={e => setOpponentScore(e.target.value)} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className={styles.deleteBtn} onClick={() => setShowSaveModal(false)}>キャンセル</button>
              <button className={styles.saveBtn} onClick={handleConfirmSave}>保存する</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (() => {
        const promptTemplate = `あなたはプロのフットサルアナリストです。
アップロードされた動画を解析し、以下の条件に従ってイベントを時系列でJSON配列として出力してください。

【チーム情報】
・自チームの特徴: ${ourFeature}
・相手チームの特徴: ${oppFeature}
・前半の自チームの攻める方向: ${attackDir}

【出力フォーマット】
[
  { "minute": 15, "event_type": "pass" },
  { "minute": 45, "event_type": "shot" }
]
※ event_typeは以下から選択してください: pass, shot, shot_off, goal, block, pass_cut, steal, lost_ball, save
※ minuteは動画開始からの秒数です。`;

        return (
        <div className={styles.uploadOverlay}>
          <div className={styles.eventEditDialog} style={{ position: 'relative', top: 0, transform: 'none', padding: '2rem', minWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className={styles.dialogTitle} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>AIデータをインポート</h2>
            
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#111', borderRadius: '4px', border: '1px solid #333' }}>
              <h3 style={{ fontSize: '1rem', color: '#74c0fc', marginBottom: '0.5rem' }}>🤖 AI用プロンプト作成</h3>
              <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem' }}>ChatGPTやGeminiに動画を渡す際、以下の指示文を一緒に送信すると精度が上がります。</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#ccc' }}>自チームの特徴</label>
                  <input type="text" className={styles.playerSelect} value={ourFeature} onChange={e => setOurFeature(e.target.value)} placeholder="例: 緑のビブス" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#ccc' }}>相手チームの特徴</label>
                  <input type="text" className={styles.playerSelect} value={oppFeature} onChange={e => setOppFeature(e.target.value)} placeholder="例: 白のシャツ" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#ccc' }}>前半の攻める方向</label>
                  <input type="text" className={styles.playerSelect} value={attackDir} onChange={e => setAttackDir(e.target.value)} placeholder="例: 左から右" />
                </div>
              </div>
              
              <div style={{ position: 'relative' }}>
                <textarea 
                  readOnly 
                  value={promptTemplate} 
                  style={{ width: '100%', height: '120px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', resize: 'none' }} 
                />
                <button 
                  onClick={() => { navigator.clipboard.writeText(promptTemplate); alert('コピーしました！'); }}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#74c0fc', color: '#000', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  📋 コピー
                </button>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.5rem' }}>📥 解析結果(JSON)の貼り付け</h3>
            <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem' }}>
              AIが出力したJSON形式の配列を貼り付けてください。
            </p>
            <textarea 
              className={styles.playerSelect} 
              style={{ height: '150px', resize: 'vertical', fontFamily: 'monospace' }}
              placeholder="JSONデータをここにペースト..."
              value={importJsonText}
              onChange={e => setImportJsonText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button className={styles.deleteBtn} onClick={() => setShowImportModal(false)}>キャンセル</button>
              <button className={styles.saveBtn} onClick={handleImportJson}>反映する</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
