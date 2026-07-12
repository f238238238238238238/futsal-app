'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createMatch, getImageUrl, getEvents, getEventAttendances } from '@/lib/api';
import styles from './sensor.module.css';

const POSITIONS_EXTERNAL = ['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK'];
const POSITIONS_INTRA = ['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK', 'blue_Pivo', 'blue_AlaL', 'blue_AlaR', 'blue_Fixo', 'blue_GK'];

export default function SensorMatchPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  // Players
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State
  const [phase, setPhase] = useState('setup'); // setup, playing, finished
  const [matchMode, setMatchMode] = useState('external'); // external, intra
  const [isSaving, setIsSaving] = useState(false);
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
  
  // Sensor Assignments { user_id: 'Sensor_1' }
  const [sensorAssignments, setSensorAssignments] = useState({});
  
  // Context Mode
  const [contextMode, setContextMode] = useState('attack'); // 'attack' or 'defense'
  
  const [score, setScore] = useState({ us: 0, opponent: 0 });
  const [events, setEvents] = useState([]); // { type, user_id, minute }
  const [syncStatuses, setSyncStatuses] = useState({}); // { [userId]: { status: 'pending' | 'synced', data: [] } }
  
  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  // Camera & Recording
  const [stream, setStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

  const startCamera = async () => {
    try {
      const str = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true
      });
      setStream(str);
      if (videoRef.current) {
        videoRef.current.srcObject = str;
      }
      setCameraActive(true);
    } catch (err) {
      alert('カメラの起動に失敗しました: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const startRecording = () => {
    if (!stream) return;
    const options = { mimeType: 'video/webm; codecs=vp9' };
    try {
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setRecordedChunks(prev => [...prev, e.data]);
        }
      };
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (e) {
      alert('録画の開始に失敗しました。iPhoneの場合はSafariの設定を確認してください。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const downloadVideo = () => {
    // If recordedChunks is empty but we just stopped, the chunk might still be processing.
    // In React state, recordedChunks might not be fully updated here if called immediately.
    // It's handled by a timeout in endMatch, but let's be safe.
    setTimeout(() => {
      setRecordedChunks(currentChunks => {
        if (currentChunks.length === 0) return currentChunks;
        const blob = new Blob(currentChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = `futsal_match_${matchInfo.date}_${Date.now()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        return currentChunks;
      });
    }, 500);
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
            const pos = isEnemyDummy ? id.replace('dummy_', '') : (starterPositions[id] || '');
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
        const pos = isEnemyDummy ? id.replace('dummy_', '') : (starterPositions[id] || '');
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
        if (!sensorAssignments[sourceId]) {
          setSensorAssignments(prev => ({ ...prev, [sourceId]: 'SENSOR_1' })); // Default
        }
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

  const handleManualAction = (type) => {
    // This adds a manual context event from the app
    recordEvent(type, 'app');
    
    if (type === 'app_goal' && matchMode === 'external') {
      setScore(s => ({ ...s, us: s.us + 1 }));
    } else if (type === 'app_opponent_goal' && matchMode === 'external') {
      setScore(s => ({ ...s, opponent: s.opponent + 1 }));
    }
    // Intra match score will be resolved during sync based on context
  };

  const handleStartMatch = () => {
    if (matchMode === 'external' && !matchInfo.opponent_name) return alert('対戦相手を入力してください');
    if (courtIds.length === 0) return alert('スタメンを選んでください');
    
    // 全てのフィールドプレイヤーにデフォルトのセンサー割り当てを保証する
    const newAssignments = { ...sensorAssignments };
    courtIds.forEach(id => {
      const pos = starterPositions[id] || '';
      if (!pos.includes('GK') && !newAssignments[id]) {
        newAssignments[id] = 'SENSOR_1';
      }
    });
    setSensorAssignments(newAssignments);

    setInitialStarters([...courtIds]);
    setPhase('playing');
    setIsRunning(true);
  };

  const endMatch = () => {
    if(confirm('試合を終了しますか？')) {
      setIsRunning(false);
      setPhase('finished');
      if (isRecording) {
        stopRecording();
      }
      if (cameraActive) {
        stopCamera();
      }
      setTimeout(() => {
        downloadVideo();
      }, 1000);
    }
  };

  const handleMockSync = (userId) => {
    setSyncStatuses(prev => ({ ...prev, [userId]: { status: 'syncing', data: [] } }));
    setTimeout(() => {
      // Mock data: random passes and shots for this user
      const mockData = [];
      for (let i = 0; i < 15; i++) {
        mockData.push({
          type: Math.random() > 0.8 ? 'IMPACT_SHOT' : 'IMPACT_PASS',
          minute: Math.floor(Math.random() * timerSeconds)
        });
      }
      setSyncStatuses(prev => ({ ...prev, [userId]: { status: 'synced', data: mockData } }));
    }, 1500);
  };

  const mergeAndSaveMatch = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // 1. Gather all sensor events
    let allSensorEvents = [];
    Object.keys(syncStatuses).forEach(uid => {
      if (syncStatuses[uid].status === 'synced') {
        syncStatuses[uid].data.forEach(ev => {
          allSensorEvents.push({ ...ev, user_id: Number(uid) });
        });
      }
    });

    // 2. Sort both arrays by time
    const sortedSensor = allSensorEvents.sort((a,b) => a.minute - b.minute);
    const sortedApp = events.sort((a,b) => a.minute - b.minute);

    // 3. Merging Logic (Simple mock logic for now)
    const finalEvents = [];
    
    // Add GK manual saves/catches
    sortedApp.filter(e => e.event_type === 'save' || e.event_type === 'catch' || e.event_type === 'sub_in' || e.event_type === 'sub_out').forEach(e => {
      finalEvents.push({ event_type: e.event_type, user_id: e.user_id !== 'app' ? Number(e.user_id) : null, minute: e.minute });
    });

    // For every app event (goal, shot), try to find a matching sensor event nearby
    sortedApp.forEach(appEv => {
      if (['app_goal', 'app_shot_on_target', 'app_shot_miss'].includes(appEv.event_type)) {
        // Find nearest IMPACT_SHOT within 5 seconds
        const match = sortedSensor.find(se => se.type === 'IMPACT_SHOT' && !se.used && Math.abs(se.minute - appEv.minute) <= 5);
        if (match) {
          match.used = true;
          let finalType = 'shot';
          if (appEv.event_type === 'app_goal') finalType = 'goal';
          finalEvents.push({ event_type: finalType, user_id: match.user_id, minute: appEv.minute });
        }
      }
    });

    // Unmatched sensor events become normal passes/shots
    sortedSensor.forEach(se => {
      if (!se.used) {
        finalEvents.push({ event_type: se.type === 'IMPACT_SHOT' ? 'shot' : 'pass', user_id: se.user_id, minute: se.minute });
      }
    });

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

    finalEvents.forEach(ev => {
      if (ev.user_id && statsObj[ev.user_id]) {
        if (ev.event_type === 'goal') statsObj[ev.user_id].goals++;
        if (ev.event_type === 'assist') statsObj[ev.user_id].assists++;
        if (ev.event_type === 'save' || ev.event_type === 'catch') statsObj[ev.user_id].saves++;
      }
    });

    const payload = {
      date: matchInfo.date,
      opponent_name: matchMode === 'intra' ? `紅白戦 (${matchInfo.team1_name || 'RED'} vs ${matchInfo.team2_name || 'BLUE'})` : matchInfo.opponent_name,
      competition_name: matchInfo.competition_name,
      our_score: score.us,
      opponent_score: score.opponent,
      duration_seconds: timerSeconds,
      summary_text: matchMode === 'intra' ? '紅白戦（10人制）センサー記録' : 'センサー試合登録からの記録',
      mom_user_id: null,
      stats: Object.values(statsObj),
      events: finalEvents
    };

    try {
      await createMatch(payload);
      alert('センサーデータをマージして試合を保存しました！');
      router.push('/admin/matches');
    } catch (err) {
      alert('エラー: ' + err.message);
      setIsSaving(false);
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
            {isSetup && !pos.includes('GK') && (
              <select 
                value={sensorAssignments[playerId] || 'SENSOR_1'}
                onChange={(e) => setSensorAssignments(prev => ({...prev, [playerId]: e.target.value}))}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: '0.7rem', marginTop: '2px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555' }}
              >
                {[1,2,3,4,5,6,7,8].map(num => <option key={num} value={`SENSOR_${num}`}>Sensor {num}</option>)}
              </select>
            )}
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
        <div className={styles.headerTitle}>{matchMode === 'intra' ? `🔴 ${matchInfo.team1_name || 'RED'} vs ${matchInfo.team2_name || 'BLUE'} 🔵 (Sensor)` : 'LIVE MATCH (Sensor)'}</div>
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
        <div className={styles.container} style={{ paddingBottom: '120px', paddingTop: 0 }} data-drop-target="bench">
          
          <div className={styles.cameraSection}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={styles.videoPreview} 
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            {isRecording && <div className={styles.recordingBadge}>🔴 録画中 {formatTime(timerSeconds)}</div>}
            
            <div className={styles.cameraControls}>
              {!cameraActive ? (
                <button onClick={startCamera} className={styles.startBtn} style={{marginTop: 0, padding: '10px 20px'}}>📷 カメラ起動</button>
              ) : (
                <>
                  {!isRecording ? (
                    <button onClick={startRecording} className={styles.startBtn} style={{marginTop: 0, padding: '10px 20px', background: '#e03131', color: 'white'}}>🔴 録画開始</button>
                  ) : (
                    <button onClick={stopRecording} className={styles.startBtn} style={{marginTop: 0, padding: '10px 20px', background: '#343a40', color: 'white'}}>⏹ 録画停止</button>
                  )}
                  <button onClick={stopCamera} className={styles.ctrlBtn} style={{marginTop: 0}}>✖ 閉じる</button>
                </>
              )}
            </div>
          </div>

          <div className={styles.scoreboard} style={{marginTop: '20px'}}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleManualAction('app_goal')} style={{ flex: 1, padding: '20px', background: '#e03131', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}>⚽ ゴール</button>
                <button onClick={() => handleManualAction('app_shot_on_target')} style={{ flex: 1, padding: '20px', background: '#f59f00', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}>🎯 枠内</button>
                <button onClick={() => handleManualAction('app_shot_miss')} style={{ flex: 1, padding: '20px', background: '#868e96', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}>❌ 枠外</button>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => {
                   const gkId = Object.keys(starterPositions).find(id => starterPositions[id].includes('GK') && (matchMode === 'external' || starterPositions[id].startsWith('red')));
                   if (gkId) recordEvent('save', gkId);
                }} style={{ flex: 1, padding: '15px', background: '#20c997', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}>🧤 セーブ</button>
                <button onClick={() => {
                   const gkId = Object.keys(starterPositions).find(id => starterPositions[id].includes('GK') && (matchMode === 'external' || starterPositions[id].startsWith('red')));
                   if (gkId) {
                     recordEvent('catch', gkId);
                     setContextMode('attack');
                     recordEvent('context_attack', 'app');
                   }
                }} style={{ flex: 1, padding: '15px', background: '#0ca678', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}>👐 キャッチ</button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => {
                  const newMode = contextMode === 'attack' ? 'defense' : 'attack';
                  setContextMode(newMode);
                  recordEvent(`context_${newMode}`, 'app');
                }} style={{ flex: 2, padding: '15px', background: contextMode === 'attack' ? '#339af0' : '#495057', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {contextMode === 'attack' ? '⚔️ 攻撃モード中 (タップで守備へ)' : '🛡️ 守備モード中 (タップで攻撃へ)'}
                </button>
                <button onClick={() => handleManualAction('app_opponent_goal')} style={{ flex: 1, padding: '15px', background: '#000', color: '#fff', border: '1px solid #e03131', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}>💀 失点</button>
              </div>
            </div>

            {/* Substitution Lists */}
            <div style={{ marginTop: '20px', padding: '10px' }}>
              <h3 style={{ color: '#ccc', marginBottom: '10px', fontSize: '1rem' }}>出場中（タップして交代）</h3>
              <div className={styles.startersGrid}>
                {courtIds.map(id => {
                   const p = players.find(x => x.user_id === id);
                   if (!p) return null;
                   const isSelected = selectedCourtId === id || swapSourceId === id;
                   return (
                     <div key={id} className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`} onClick={() => handlePlayerTap(id, 'pitch')}>
                       <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                       <div className={styles.playerName}>{p.name}</div>
                     </div>
                   );
                })}
              </div>
            </div>

            {matchMode === 'external' ? (
              <div className={styles.benchSection} data-drop-target="bench" style={{ marginTop: '10px' }}>
                <h2 className={styles.sectionTitle} style={{fontSize:'1rem'}}>ベンチ</h2>
                <div className={styles.startersGrid}>
                  {benchIds.map(id => {
                    const p = players.find(x => x.user_id === id);
                    if (!p) return null;
                    const isSelected = swapSourceId === id;
                    return (
                      <div key={id} className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`} onClick={() => handlePlayerTap(id, 'bench')}>
                        <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                        <div className={styles.playerName}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.intraBenchLayout} data-drop-target="bench" style={{ marginTop: '10px' }}>
                <div className={styles.teamBenchCol}>
                  <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} ベンチ</h4>
                  <div className={styles.startersGrid}>
                    {benchIds.filter(id => playerTeams[id] === 'red').map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      const isSelected = swapSourceId === id;
                      return (
                        <div key={id} className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`} onClick={() => handlePlayerTap(id, 'bench')}>
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
                      const isSelected = swapSourceId === id;
                      return (
                        <div key={id} className={`${styles.playerSelectCard} ${isSelected ? styles.selected : ''}`} onClick={() => handlePlayerTap(id, 'bench')}>
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                          <div className={styles.playerName}>{p.name}</div>
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
               {events.filter(e => ['app_goal', 'app_shot_on_target', 'app_shot_miss', 'app_opponent_goal', 'save', 'catch', 'context_attack', 'context_defense', 'sub_in', 'sub_out'].includes(e.event_type)).slice(-5).reverse().map((e, i) => {
                 const p = e.user_id === 'app' ? 'アプリ入力' : (players.find(x => x.user_id === Number(e.user_id))?.name || e.user_id);
                 const min = Math.floor(e.minute / 60);
                 const sec = String(e.minute % 60).padStart(2, '0');
                 const eventNames = {
                   app_goal: '⚽ ゴール', app_shot_on_target: '🎯 枠内シュート', app_shot_miss: '❌ 枠外シュート', app_opponent_goal: '💀 失点',
                   save: '🧤 セーブ', catch: '👐 キャッチ', context_attack: '⚔️ 攻撃モード開始', context_defense: '🛡️ 守備モード開始',
                   sub_in: '🔄 IN', sub_out: '🔄 OUT'
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
          <div className={styles.summaryCard} style={{ maxWidth: '600px' }}>
            <h2 className={styles.summaryTitle}>センサーデータの吸い上げ</h2>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
              各選手のマイコンからデータを吸い上げ、アプリの手動記録と合体（マージ）させます。
            </p>
            
            <div className={styles.syncList}>
              {attendingIds.map(uid => {
                const p = players.find(x => x.user_id === uid);
                if (!p) return null;
                const assignment = sensorAssignments[uid];
                if (!assignment) return null; // Only show players with assigned sensors
                
                const syncData = syncStatuses[uid] || { status: 'pending' };
                
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} alt="" />
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>{assignment}</div>
                      </div>
                    </div>
                    
                    {syncData.status === 'pending' && (
                      <button onClick={() => handleMockSync(uid)} style={{ padding: '8px 15px', background: '#339af0', color: '#fff', border: 'none', borderRadius: '5px' }}>
                        テスト同期
                      </button>
                    )}
                    {syncData.status === 'syncing' && (
                      <span style={{ color: '#f59f00', fontWeight: 'bold' }}>同期中...</span>
                    )}
                    {syncData.status === 'synced' && (
                      <span style={{ color: '#20c997', fontWeight: 'bold' }}>完了 ({syncData.data.length}件)</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className={styles.saveMatchBtn} 
              onClick={mergeAndSaveMatch} 
              disabled={isSaving}
              style={{ marginTop: '30px' }}
            >
              {isSaving ? 'マージ保存中...' : 'データを合体して試合を保存'}
            </button>
            <button
              onClick={downloadVideo}
              style={{ marginTop: '10px', width: '100%', padding: '15px', background: '#339af0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
            >
              📹 録画した動画を再ダウンロード
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
