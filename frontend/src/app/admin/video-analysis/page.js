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
  
  // Japan time timezone offset applied for default date
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  
  const [matchDate, setMatchDate] = useState(localISOTime);
  const [opponentName, setOpponentName] = useState('');
  
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  
  // Drag state
  const [draggingIdx, setDraggingIdx] = useState(null);

  useEffect(() => {
    getPlayers()
      .then(p => setPlayers(p.users || p || []))
      .catch(err => console.error(err));
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

  const addEvent = (type) => {
    if (!videoRef.current) return;
    const newEvent = {
      event_type: type,
      user_id: '',
      minute: Math.floor(videoRef.current.currentTime),
      position: '' // Can be used for target_id later
    };
    setEvents([...events, newEvent]);
    setSelectedEventIndex(events.length); // select the newly added event
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
    setSelectedEventIndex(null);
  };

  const handleMarkerMouseDown = (e, index) => {
    e.stopPropagation();
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

  const handleSaveClick = () => {
    if (events.length === 0) {
      if (!confirm('イベントが一つも記録されていません。このまま保存しますか？')) return;
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

      const stats = Object.entries(userStats).map(([userId, st]) => ({
        user_id: parseInt(userId, 10),
        is_starter: false, // Default to false when created via timeline
        goals: st.goals,
        assists: st.assists,
        saves: st.saves
      }));

      const payload = {
        date: matchDate,
        opponent_name: opponentName,
        competition_name: '動画解析',
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
    if (type === 'shot' || type === 'goal') return styles.shot;
    if (type === 'block' || type === 'save' || type === 'catch') return styles.block;
    return '';
  };

  return (
    <div className={styles.editorPage}>
      <header className={styles.editorHeader}>
        <Link href="/admin" className={styles.backBtn}>← ADMIN</Link>
        <div className={styles.headerTitle}>🎬 動画解析ハブ（新規試合登録）</div>
        <button className={styles.globalSaveBtn} onClick={handleSaveClick}>登録して保存</button>
      </header>

      <div className={styles.mainContent}>
        
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
            <button className={`${styles.actionBtn} ${styles.pass}`} onClick={() => addEvent('pass')}>+ パス</button>
            <button className={`${styles.actionBtn} ${styles.shot}`} onClick={() => addEvent('shot')}>+ シュート</button>
            <button className={`${styles.actionBtn} ${styles.block}`} onClick={() => addEvent('block')}>+ ブロック</button>
            <button className={styles.actionBtn} onClick={() => addEvent('steal')}>+ 奪取</button>
            <button className={styles.actionBtn} onClick={() => addEvent('lost_ball')}>+ ロスト</button>
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
                >
                  {/* Editor Popup */}
                  {isSelected && (
                    <div className={styles.eventEditDialog} onMouseDown={(e) => e.stopPropagation()}>
                      <div className={styles.dialogTitle}>イベント編集 ({Math.floor(ev.minute/60)}:{(ev.minute%60).toString().padStart(2,'0')})</div>
                      
                      <select 
                        className={styles.playerSelect}
                        value={ev.event_type}
                        onChange={e => updateSelectedEvent('event_type', e.target.value)}
                      >
                        <option value="pass">パス</option>
                        <option value="shot">シュート</option>
                        <option value="goal">ゴール</option>
                        <option value="block">ブロック</option>
                        <option value="steal">奪取</option>
                        <option value="lost_ball">ロスト</option>
                        <option value="save">セーブ</option>
                      </select>

                      <select 
                        className={styles.playerSelect}
                        value={ev.user_id}
                        onChange={e => updateSelectedEvent('user_id', e.target.value)}
                      >
                        <option value="">-- 選手を選択 --</option>
                        <option value="opponent">相手チーム</option>
                        {players.map(p => (
                          <option key={p.user_id} value={p.user_id}>{p.name}</option>
                        ))}
                      </select>

                      <div className={styles.dialogActions}>
                        <button className={styles.deleteBtn} onClick={removeSelectedEvent}>削除</button>
                        <button className={styles.saveBtn} onClick={() => setSelectedEventIndex(null)}>閉じる</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {showSaveModal && (
        <div className={styles.uploadOverlay}>
          <div className={styles.eventEditDialog} style={{ position: 'relative', top: 0, transform: 'none', padding: '2rem' }}>
            <h2 className={styles.dialogTitle} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>試合データとして保存</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <label>試合日</label>
              <input type="date" className={styles.playerSelect} value={matchDate} onChange={e => setMatchDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <label>対戦相手</label>
              <input type="text" className={styles.playerSelect} placeholder="相手チーム名" value={opponentName} onChange={e => setOpponentName(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className={styles.deleteBtn} onClick={() => setShowSaveModal(false)}>キャンセル</button>
              <button className={styles.saveBtn} onClick={handleConfirmSave}>保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
