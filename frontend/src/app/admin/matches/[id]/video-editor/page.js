'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMatch, getPlayers, updateMatch } from '@/lib/api';
import styles from './editor.module.css';
import { useParams } from 'next/navigation';

export default function VideoEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [videoSrc, setVideoSrc] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  
  // Drag state
  const [draggingIdx, setDraggingIdx] = useState(null);

  const [attendees, setAttendees] = useState(new Set());
  const [starters, setStarters] = useState(new Set());
  const [positions, setPositions] = useState({});

  const [wasPlayingBeforeEdit, setWasPlayingBeforeEdit] = useState(false);
  const [possessionUserId, setPossessionUserId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    if (id) {
      Promise.all([getMatch(id), getPlayers()])
        .then(([m, p]) => {
          setMatch(m);
          setEvents(m.events || []);
          setPlayers(p.users || p || []);
          
          if (m.stats) {
            const initialAttendees = new Set(m.stats.map(s => s.user_id));
            const initialStarters = new Set(m.stats.filter(s => s.is_starter).map(s => s.user_id));
            const initialPositions = {};
            m.stats.forEach(s => {
              if (s.position) initialPositions[s.user_id] = s.position;
            });
            setAttendees(initialAttendees);
            setStarters(initialStarters);
            setPositions(initialPositions);
          }
        })
        .catch(err => console.error(err));
    }
  }, [id]);

  // Keyboard shortcut for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
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

  const addEvent = (type) => {
    if (!videoRef.current) return;
    
    if (!pendingAction && selectedEventIndex === null) {
      setWasPlayingBeforeEdit(!videoRef.current.paused);
    }
    videoRef.current.pause();

    // Opponent / Automatic actions
    if (['opponent_goal', 'opponent_pass'].includes(type)) {
      insertEvent(type, 'opponent');
      setPossessionUserId(null); 
      setPendingAction(null);
      resumeVideoIfNeeded();
      return;
    }

    if (type === 'substitution') {
      const newEvent = { event_type: type, user_id: '', minute: Math.floor(videoRef.current.currentTime), position: '' };
      setEvents(prev => [...prev, newEvent]);
      setTimeout(() => setSelectedEventIndex(events.length), 0);
      return;
    }
    
    if (['save', 'catch'].includes(type)) {
      const gks = Array.from(starters).filter(uid => positions[uid] === 'GK');
      if (gks.length === 1) {
        insertEvent(type, gks[0]);
        setPossessionUserId(type === 'catch' ? gks[0] : null);
        resumeVideoIfNeeded();
      } else {
        setPendingAction({ type, step: 1 });
      }
      return;
    }

    if (['goal', 'shot', 'block', 'pass_cut', 'lost_ball', 'shot_off'].includes(type)) {
      if (possessionUserId && type !== 'block' && type !== 'pass_cut') {
        insertEvent(type, possessionUserId);
        if (['lost_ball', 'shot', 'goal', 'shot_off'].includes(type)) {
           setPossessionUserId(null);
        }
        resumeVideoIfNeeded();
      } else {
        setPendingAction({ type, step: 1 });
      }
      return;
    }

    if (type === 'pass') {
      if (possessionUserId) {
        setPendingAction({ type: 'pass', step: 2, actor: possessionUserId });
      } else {
        setPendingAction({ type: 'pass', step: 1 });
      }
      return;
    }
    
    if (type === 'kickoff') {
      setPendingAction({ type: 'kickoff', step: 1 });
      return;
    }
  };

  const handlePlayerIconClick = (userId) => {
    if (!pendingAction) {
      setPossessionUserId(possessionUserId === userId ? null : userId);
      return;
    }

    if (pendingAction.step === 1) {
      if (['pass', 'kickoff'].includes(pendingAction.type)) {
        setPendingAction({ type: pendingAction.type, step: 2, actor: userId });
      } else {
        insertEvent(pendingAction.type, userId);
        if (['pass_cut', 'catch'].includes(pendingAction.type)) {
           setPossessionUserId(userId);
        } else if (['lost_ball', 'shot', 'goal', 'save', 'shot_off'].includes(pendingAction.type)) {
           setPossessionUserId(null);
        } else {
           setPossessionUserId(userId);
        }
        setPendingAction(null);
        resumeVideoIfNeeded();
      }
    } else if (pendingAction.step === 2 && ['pass', 'kickoff'].includes(pendingAction.type)) {
      insertEvent(pendingAction.type, pendingAction.actor, userId);
      setPossessionUserId(userId);
      setPendingAction(null);
      resumeVideoIfNeeded();
    }
  };

  const getActionLabel = (action) => {
    switch(action?.type) {
      case 'pass': return 'パス';
      case 'kickoff': return 'キックオフ';
      case 'shot': return 'シュート';
      case 'goal': return '得点';
      case 'block': return 'ブロック';
      case 'save': return 'セーブ';
      case 'catch': return 'キャッチ';
      case 'pass_cut': return 'パスカット';
      case 'lost_ball': return 'ロスト';
      case 'shot_off': return '枠外シュート';
      default: return '';
    }
  };

  const getPendingBannerText = () => {
    if (!pendingAction) return null;
    const actionName = getActionLabel(pendingAction);
    if (pendingAction.step === 1) {
      return `${actionName} を行った選手を選択してください`;
    }
    if (pendingAction.step === 2 && ['pass', 'kickoff'].includes(pendingAction.type)) {
      const actorName = players.find(p => p.user_id === pendingAction.actor)?.name || '選手';
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

  const handleSaveClick = async () => {
    if (!match) return;
    try {
      const userStats = {};
      events.forEach(ev => {
        const uid = ev.user_id;
        if (!uid || typeof uid === 'string' || uid === 'opponent') return;
        if (!userStats[uid]) userStats[uid] = { goals: 0, assists: 0, saves: 0 };
        if (ev.event_type === 'goal') userStats[uid].goals += 1;
        if (ev.event_type === 'assist') userStats[uid].assists += 1;
        if (ev.event_type === 'save') userStats[uid].saves += 1;
      });

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
        ...match,
        events: events,
        stats: stats
      };
      await updateMatch(id, payload);
      alert('タイムラインを保存しました！');
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  };

  if (authLoading || !match) return <div className={styles.editorPage}><p>Loading...</p></div>;
  if (!isAdmin) return <div className={styles.editorPage}><p>管理者権限が必要です</p></div>;

  const getEventClass = (type) => {
    if (type === 'pass') return styles.pass;
    if (type === 'shot') return styles.shot;
    if (type === 'goal') return styles.goal;
    if (type === 'opponent_goal') return styles.opponent_goal;
    if (type === 'opponent_pass') return styles.opponent_pass;
    if (type === 'shot_off') return styles.shot_off;
    if (type === 'block') return styles.block;
    if (type === 'pass_cut') return styles.pass_cut;
    if (type === 'save' || type === 'catch') return styles.save;
    if (type === 'lost_ball') return styles.lost_ball;
    return '';
  };

  const toggleAttendee = (userId) => {
    const next = new Set(attendees);
    if (next.has(userId)) {
      next.delete(userId);
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
        <Link href={`/matches/${id}`} className={styles.backBtn}>← MATCH DETAIL</Link>
        <div className={styles.headerTitle}>🎬 動画解析エディタ（既存編集）</div>
        <button className={styles.globalSaveBtn} onClick={handleSaveClick}>上書き保存</button>
      </header>

      <div className={styles.mainContent}>
        
        <div className={styles.leftColumn}>
          {/* Video Area */}
          <div className={styles.videoSection}>
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
            <div className={styles.videoWrapper}>
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

        {/* Timeline Area */}
        <div className={styles.timelineSection}>
          <div className={styles.toolbar}>
            <button className={`${styles.actionBtn} ${styles.kickoff}`} onClick={() => addEvent('kickoff')}>📣 キックオフ</button>
            <button className={`${styles.actionBtn} ${styles.goal}`} onClick={() => addEvent('goal')}>⚽ 得点 (Goal)</button>
            <button className={`${styles.actionBtn} ${styles.opponent_goal}`} onClick={() => addEvent('opponent_goal')}>💢 失点</button>
            <button className={`${styles.actionBtn} ${styles.pass}`} onClick={() => addEvent('pass')}>🔁 パス</button>
            <button className={`${styles.actionBtn} ${styles.opponent_pass}`} onClick={() => addEvent('opponent_pass')}>🔄 相手パス</button>
            <button className={`${styles.actionBtn} ${styles.shot_off}`} onClick={() => addEvent('shot_off')}>☄️ 枠外シュート</button>
            <button className={`${styles.actionBtn} ${styles.block}`} onClick={() => addEvent('block')}>🛡️ ブロック</button>
            <button className={`${styles.actionBtn} ${styles.pass_cut}`} onClick={() => addEvent('pass_cut')}>🔶 パスカット</button>
            <button className={`${styles.actionBtn} ${styles.save}`} onClick={() => addEvent('save')}>🧤 セーブ</button>
            <button className={`${styles.actionBtn} ${styles.catch}`} onClick={() => addEvent('catch')}>🤲 キャッチ</button>
            <button className={`${styles.actionBtn} ${styles.lost_ball}`} onClick={() => addEvent('lost_ball')}>🔻 ロスト</button>
            <button className={`${styles.actionBtn}`} style={{ background: '#3b5bdb', borderColor: '#3b5bdb' }} onClick={() => addEvent('substitution')}>🔄 交代</button>
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
                    <option value="steal">奪取</option>
                    <option value="lost_ball">ロスト</option>
                    <option value="save">セーブ</option>
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
    </div>
  );
}
