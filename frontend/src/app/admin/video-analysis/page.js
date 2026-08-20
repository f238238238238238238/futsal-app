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
  'opponent_lost': '相手のミス(ロスト)',
  'opponent_clear': '相手のクリア',
  'trap_miss': 'トラップミス',
  'period_start': 'ピリオド開始',
  'period_end': 'ピリオド終了',
};

const displayEventType = (ev) => {
  if (ev.event_type === 'period_start') return ev.period === 2 ? '後半開始' : '前半開始';
  if (ev.event_type === 'period_end') return ev.period === 2 ? '後半終了' : '前半終了';
  const name = EVENT_DISPLAY_NAMES[ev.event_type] || ev.event_type;
  if (ev.team === 'opponent') return `[相手] ${name}`;
  return name;
};

// 同一時刻のイベントはタグ付け順（配列順）を保ったまま時系列に整列する
const sortEventsChronologically = (list) =>
  list.map((ev, i) => ({ ev, i }))
    .sort((a, b) => ((a.ev.minute || 0) - (b.ev.minute || 0)) || (a.i - b.i))
    .map(x => x.ev);

const fmtTime = (sec) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;

const SHOT_LOC_TYPES = new Set(['goal', 'shot', 'shot_off', 'opponent_goal', 'opponent_shot_off', 'save', 'catch', 'block']);

const possessorAfterEvent = (ev) => {
  switch (ev.event_type) {
    case 'pass':
    case 'kickoff':
      return ev.target_user_id && ev.target_user_id !== 'opponent' ? 'own' : 'opponent';
    case 'pass_cut':
    case 'steal':
    case 'recovery':
    case 'catch':
      return ev.user_id && ev.user_id !== 'opponent' && ev.team !== 'opponent' ? 'own' : 'opponent';
    case 'opponent_steal':
    case 'intercept':
      return 'opponent';
    case 'side_out':
    case 'corner_kick':
    case 'goal_kick':
    case 'free_kick':
    case 'pk':
      return ev.team === 'opponent' ? 'opponent' : 'own';
    case 'period_start':
    case 'period_end':
    case 'lost_ball':
    case 'pass_miss':
    case 'trap_miss':
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
      return null;
    default:
      return undefined;
  }
};

function computeTagStats(events, attendeeIds) {
  const chrono = sortEventsChronologically(events || []);
  const ourGoals = chrono.filter(e => e.event_type === 'goal').length;
  const oppGoals = chrono.filter(e => e.event_type === 'opponent_goal' || e.event_type === 'concede').length;
  const ourShots = chrono.filter(e => ['goal', 'shot', 'shot_off'].includes(e.event_type)).length;
  const passes = chrono.filter(e => e.event_type === 'pass').length;
  const passMiss = chrono.filter(e => e.event_type === 'pass_miss').length;
  const passAttempts = passes + passMiss;
  const passPct = passAttempts > 0 ? Math.round((passes / passAttempts) * 100) : null;

  let ourPos = 0;
  let oppPos = 0;
  let inPlay = false;
  let side = null;
  let t0 = 0;
  const flush = (t) => {
    if (!inPlay || side == null || t <= t0) { t0 = t; return; }
    if (side === 'own') ourPos += t - t0;
    else oppPos += t - t0;
    t0 = t;
  };
  chrono.forEach(ev => {
    flush(ev.minute || 0);
    if (ev.event_type === 'period_start') { inPlay = true; side = null; t0 = ev.minute || 0; }
    else if (ev.event_type === 'period_end') { inPlay = false; side = null; }
    else {
      const next = possessorAfterEvent(ev);
      if (next !== undefined) side = next;
    }
  });
  const possTotal = ourPos + oppPos;
  const possPct = possTotal > 0 ? Math.round((ourPos / possTotal) * 100) : null;

  const byPlayer = {};
  (attendeeIds || []).forEach(uid => {
    byPlayer[uid] = { goals: 0, assists: 0, shots: 0, passes: 0, passMiss: 0, saves: 0, steals: 0, blocks: 0 };
  });
  const bump = (uid, key) => {
    if (uid == null || !byPlayer[uid]) return;
    byPlayer[uid][key]++;
  };
  chrono.forEach((ev, i) => {
    if (ev.event_type === 'goal') {
      bump(ev.user_id, 'goals');
      bump(ev.user_id, 'shots');
      for (let j = i - 1; j >= 0; j--) {
        const prevEv = chrono[j];
        if (['steal', 'opponent_pass', 'intercept', 'clear', 'opponent_block', 'lost_ball', 'pass_miss', 'trap_miss'].includes(prevEv.event_type)) break;
        if (prevEv.team === 'opponent') break;
        if ((prevEv.event_type === 'pass' || prevEv.event_type === 'kickoff') && prevEv.target_user_id === ev.user_id) {
          bump(prevEv.user_id, 'assists');
          break;
        }
      }
    }
    if (ev.event_type === 'shot' || ev.event_type === 'shot_off') bump(ev.user_id, 'shots');
    if (ev.event_type === 'pass') bump(ev.user_id, 'passes');
    if (ev.event_type === 'pass_miss') bump(ev.user_id, 'passMiss');
    if (ev.event_type === 'save' || ev.event_type === 'catch') bump(ev.user_id, 'saves');
    if (ev.event_type === 'steal' || ev.event_type === 'pass_cut') bump(ev.user_id, 'steals');
    if (ev.event_type === 'block') bump(ev.user_id, 'blocks');
  });

  return { ourGoals, oppGoals, ourShots, passes, passMiss, passAttempts, passPct, possPct, byPlayer };
}

function CourtPicker({ onPick }) {
  const handleClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onPick(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
  };
  return (
    <svg viewBox="0 0 400 200" onClick={handleClick} style={{ width: '100%', cursor: 'crosshair', borderRadius: '8px', background: '#1a4d2e', display: 'block' }}>
      <rect x="10" y="10" width="380" height="180" fill="none" stroke="#fff" strokeWidth="2" />
      <line x1="200" y1="10" x2="200" y2="190" stroke="#fff" strokeWidth="1.5" />
      <circle cx="200" cy="100" r="28" fill="none" stroke="#fff" />
      <rect x="10" y="45" width="55" height="110" fill="none" stroke="#fff" />
      <rect x="335" y="45" width="55" height="110" fill="none" stroke="#fff" />
      <rect x="2" y="80" width="8" height="40" fill="#fff" />
      <rect x="390" y="80" width="8" height="40" fill="#fff" />
      <text x="18" y="28" fill="#fff" fontSize="11">自GK</text>
      <text x="338" y="28" fill="#fff" fontSize="11">相手GK</text>
    </svg>
  );
}

function ShotMap({ events }) {
  const dots = (events || []).filter(ev => ev.loc_x != null && ev.loc_y != null).map((ev, i) => {
    const x = parseFloat(ev.loc_x);
    const y = parseFloat(ev.loc_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let fill = '#fff';
    if (ev.event_type === 'goal') fill = 'var(--color-gold, #C5A059)';
    else if (ev.event_type === 'shot_off') fill = '#888';
    else if (ev.event_type === 'opponent_goal' || ev.event_type === 'concede') fill = '#ff6b6b';
    else if (ev.event_type === 'opponent_shot_off') fill = '#c44';
    else if (ev.event_type === 'save' || ev.event_type === 'catch' || ev.event_type === 'block') fill = '#74c0fc';
    return <circle key={i} cx={x * 400} cy={y * 200} r="6" fill={fill} stroke="#111" strokeWidth="1" />;
  });
  return (
    <svg viewBox="0 0 400 200" style={{ width: '100%', borderRadius: '8px', background: '#1a4d2e', display: 'block' }}>
      <rect x="10" y="10" width="380" height="180" fill="none" stroke="#fff" strokeWidth="2" />
      <line x1="200" y1="10" x2="200" y2="190" stroke="#fff" strokeWidth="1.5" />
      <circle cx="200" cy="100" r="28" fill="none" stroke="#fff" />
      <rect x="10" y="45" width="55" height="110" fill="none" stroke="#fff" />
      <rect x="335" y="45" width="55" height="110" fill="none" stroke="#fff" />
      <rect x="2" y="80" width="8" height="40" fill="#fff" />
      <rect x="390" y="80" width="8" height="40" fill="#fff" />
      {dots}
    </svg>
  );
}

const getEventIcon = (type) => {
  switch (type) {
    case 'goal': return 'G';
    case 'shot': return 'S';
    case 'shot_off': return 'OFF';
    case 'assist':
    case 'pass': return 'P';
    case 'save':
    case 'catch': return 'SV';
    case 'block':
    case 'defense':
    case 'clear':
    case 'steal':
    case 'pass_cut':
    case 'opponent_block': return 'D';
    case 'recovery': return 'REC';
    case 'lost_ball':
    case 'pass_miss':
    case 'trap_miss': return 'MISS';
    case 'foul': return 'F';
    case 'sub_in': return 'IN';
    case 'sub_out': return 'OUT';
    case 'period_start': return 'ST';
    case 'period_end': return 'ED';
    default: return (EVENT_DISPLAY_NAMES[type] || type).slice(0, 3).toUpperCase();
  }
};

const SLOTS_KEY = 'futsal_video_editor_slots';
const ACTIVE_KEY = 'futsal_video_editor_active';
const LEGACY_SETUP = 'futsal_video_editor_setup';
const LEGACY_EVENTS = 'futsal_video_editor_events';

const createEmptySlot = (label = '新しい作業') => ({
  id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  label,
  updatedAt: Date.now(),
  attendees: [],
  starters: [],
  gkId: null,
  positions: {},
  lagOffset: 3,
  events: [],
  matchDate: '',
  opponentName: '',
  competitionName: '動画解析',
  videoUrl: '',
});

const readSlots = () => {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const setup = JSON.parse(localStorage.getItem(LEGACY_SETUP) || 'null');
    const events = JSON.parse(localStorage.getItem(LEGACY_EVENTS) || '[]');
    const slot = createEmptySlot('作業 1');
    if (setup) {
      slot.attendees = setup.attendees || [];
      slot.starters = setup.starters || [];
      slot.gkId = setup.gkId || null;
      slot.positions = setup.positions || {};
      if (typeof setup.lagOffset === 'number') slot.lagOffset = setup.lagOffset;
    }
    if (Array.isArray(events)) slot.events = events;
    return [slot];
  } catch {
    return [createEmptySlot('作業 1')];
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
  const [videoUrl, setVideoUrl] = useState('');
  const [slots, setSlots] = useState([]);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const skipPersistRef = useRef(false);
  
  // Modal State
  const [pendingAction, setPendingAction] = useState(null); // { type, step, data }
  const [wasPlaying, setWasPlaying] = useState(false);
  const [setupLoaded, setSetupLoaded] = useState(false);

  // タグ付けラグ補正（プレーを見てからボタンを押すまでの遅れ。この秒数だけ遡って記録する）
  const [lagOffset, setLagOffset] = useState(3);
  // Undo用: 直近に追加したイベントのバッチ履歴
  const [undoStack, setUndoStack] = useState([]);
  // 再生速度
  const [playbackRate, setPlaybackRate] = useState(1);
  // イベントログのその場編集
  const [editingIdx, setEditingIdx] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    try {
      const loaded = readSlots();
      setSlots(loaded);
      const savedActive = localStorage.getItem(ACTIVE_KEY);
      const slot = loaded.find(s => s.id === savedActive) || loaded[0];
      setActiveSlotId(slot.id);
      skipPersistRef.current = true;
      setAttendees(new Set(slot.attendees || []));
      setStarters(new Set(slot.starters || []));
      setGkId(slot.gkId || null);
      setPositions(slot.positions || {});
      if (typeof slot.lagOffset === 'number') setLagOffset(slot.lagOffset);
      setEvents(slot.events || []);
      if (slot.matchDate) setMatchDate(slot.matchDate);
      setOpponentName(slot.opponentName || '');
      setCompetitionName(slot.competitionName || '動画解析');
      setVideoUrl(slot.videoUrl || '');
    } catch (e) {}
    setSetupLoaded(true);
  }, []);

  const snapshotSlot = () => ({
    attendees: Array.from(attendees),
    starters: Array.from(starters),
    gkId,
    positions,
    lagOffset,
    events,
    matchDate,
    opponentName,
    competitionName,
    videoUrl,
    updatedAt: Date.now(),
  });

  const applySlot = (slot) => {
    skipPersistRef.current = true;
    setAttendees(new Set(slot.attendees || []));
    setStarters(new Set(slot.starters || []));
    setGkId(slot.gkId || null);
    setPositions(slot.positions || {});
    setLagOffset(typeof slot.lagOffset === 'number' ? slot.lagOffset : 3);
    setEvents(slot.events || []);
    setMatchDate(slot.matchDate || localISOTime);
    setOpponentName(slot.opponentName || '');
    setCompetitionName(slot.competitionName || '動画解析');
    setVideoUrl(slot.videoUrl || '');
    setUndoStack([]);
    setStep('setup');
  };

  useEffect(() => {
    if (!setupLoaded || !activeSlotId) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    setSlots(prev => {
      const next = prev.map(s => s.id === activeSlotId ? { ...s, ...snapshotSlot() } : s);
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, activeSlotId);
      return next;
    });
  }, [attendees, starters, gkId, positions, lagOffset, events, matchDate, opponentName, competitionName, videoUrl, setupLoaded, activeSlotId]);

  useEffect(() => {
    getPlayers().then(p => setPlayers(p.users || p || [])).catch(console.error);
  }, []);

  const switchSlot = (id) => {
    if (id === activeSlotId) return;
    const updated = slots.map(s => s.id === activeSlotId ? { ...s, ...snapshotSlot() } : s);
    const target = updated.find(s => s.id === id);
    if (!target) return;
    localStorage.setItem(SLOTS_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_KEY, id);
    setSlots(updated);
    setActiveSlotId(id);
    applySlot(target);
  };

  const createSlot = () => {
    const updated = slots.map(s => s.id === activeSlotId ? { ...s, ...snapshotSlot() } : s);
    const slot = createEmptySlot(`作業 ${updated.length + 1}`);
    const next = [...updated, slot];
    localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
    localStorage.setItem(ACTIVE_KEY, slot.id);
    setSlots(next);
    setActiveSlotId(slot.id);
    applySlot(slot);
  };

  const deleteSlot = (id) => {
    if (slots.length <= 1) {
      const slot = createEmptySlot('作業 1');
      localStorage.setItem(SLOTS_KEY, JSON.stringify([slot]));
      localStorage.setItem(ACTIVE_KEY, slot.id);
      setSlots([slot]);
      setActiveSlotId(slot.id);
      applySlot(slot);
      return;
    }
    const remaining = slots.filter(s => s.id !== id);
    const nextActive = id === activeSlotId ? remaining[0] : remaining.find(s => s.id === activeSlotId);
    localStorage.setItem(SLOTS_KEY, JSON.stringify(remaining));
    localStorage.setItem(ACTIVE_KEY, nextActive.id);
    setSlots(remaining);
    setActiveSlotId(nextActive.id);
    if (id === activeSlotId) applySlot(nextActive);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ignore inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      const key = e.key.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

      if (!pendingAction && step === 'analyze') {
        if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
          e.preventDefault();
          undoLast();
          return;
        }
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
        else if (key === '7') { e.preventDefault(); handlePeriodAction(); }
        else if (key === '8') { e.preventDefault(); replayLast(5); }
        else if (key === '9') { e.preventDefault(); cycleSpeed(); }
        else if (key === 'ArrowLeft') { e.preventDefault(); seekBy(e.shiftKey ? -10 : -5); }
        else if (key === 'ArrowRight') { e.preventDefault(); seekBy(e.shiftKey ? 10 : 5); }
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
  }, [pendingAction, step, events, starters, positions, currentTime, lagOffset, playbackRate]);

  // Derived Active Players
  const getActivePlayers = (minute) => {
    const active = new Set(starters);
    sortEventsChronologically(events).forEach(ev => {
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
    const sorted = sortEventsChronologically(events);
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
        case 'intercept':
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
        case 'free_kick':
        case 'pk':
          possessor = ev.team === 'opponent' ? 'opponent' : (ev.user_id || null);
          break;
        case 'period_start':
        case 'period_end':
          possessor = null;
          break;
      }
    }
    return possessor;
  };
  const currentPossessor = getBallPossessor(currentTime);

  const getPlayerPosition = (minute, userId) => {
    let pos = starters.has(userId) ? (userId === gkId ? 'GK' : positions[userId]) : null;
    const sorted = sortEventsChronologically(events);
    for (const ev of sorted) {
      if (ev.minute > minute) break;
      if (ev.event_type === 'sub_in' && ev.user_id === userId) {
        pos = ev.position;
      }
    }
    return pos || 'Fixo';
  };

  // --- ピリオド（前後半）管理 ---
  const getPeriodAt = (t) => {
    let period = null;
    let startTime = null;
    for (const ev of sortEventsChronologically(events)) {
      if (ev.minute > t) break;
      if (ev.event_type === 'period_start') { period = ev.period; startTime = ev.minute; }
      else if (ev.event_type === 'period_end') { period = null; startTime = null; }
    }
    return { period, startTime };
  };

  const currentPeriodInfo = getPeriodAt(currentTime);
  const liveStats = computeTagStats(events, Array.from(attendees));

  const goToSave = () => {
    setOurScore(String(liveStats.ourGoals));
    setOpponentScore(String(liveStats.oppGoals));
    setStep('save');
  };

  const nextPeriodAction = (() => {
    const starts = events.filter(e => e.event_type === 'period_start').length;
    const ends = events.filter(e => e.event_type === 'period_end').length;
    if (starts === 0) return { type: 'period_start', period: 1, label: '前半開始' };
    if (starts === 1 && ends === 0) return { type: 'period_end', period: 1, label: '前半終了' };
    if (starts === 1 && ends === 1) return { type: 'period_start', period: 2, label: '後半開始' };
    if (starts === 2 && ends === 1) return { type: 'period_end', period: 2, label: '後半終了' };
    return null;
  })();

  // イベント追加（バッチ単位でUndo可能。時刻はラグ補正済みの値を使用）
  const addEventBatch = (list, atTime) => {
    const t = atTime !== undefined ? atTime : Math.max(0, currentTime - lagOffset);
    const periodAt = getPeriodAt(t).period;
    const stamped = list.map(ev => ({
      ...ev,
      minute: ev.minute !== undefined ? ev.minute : Math.round(t * 1000) / 1000,
      period: ev.period !== undefined ? ev.period : periodAt,
    }));
    setEvents(prev => [...prev, ...stamped]);
    setUndoStack(prev => [...prev, stamped]);
  };

  const undoLast = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const batch = prev[prev.length - 1];
      setEvents(evts => evts.filter(e => !batch.includes(e)));
      return prev.slice(0, -1);
    });
  };

  const handlePeriodAction = () => {
    if (!nextPeriodAction) return;
    const raw = videoRef.current ? videoRef.current.currentTime : currentTime;
    const t = Math.max(0, raw - lagOffset);
    addEventBatch([{ event_type: nextPeriodAction.type, period: nextPeriodAction.period }], t);
  };

  // --- 再生コントロール ---
  const seekBy = (delta) => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || Infinity;
    videoRef.current.currentTime = Math.max(0, Math.min(dur, videoRef.current.currentTime + delta));
    setCurrentTime(videoRef.current.currentTime);
  };

  const replayLast = (sec = 5) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - sec);
    setCurrentTime(videoRef.current.currentTime);
    videoRef.current.play().catch(() => {});
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const SPEED_OPTIONS = [0.5, 1, 1.5, 2];
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    changeSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  // 指定シーンへジャンプ（少し手前から再生位置を合わせて一時停止）
  const seekToEvent = (minute) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, minute - 2);
    setCurrentTime(videoRef.current.currentTime);
    videoRef.current.pause();
  };

  // --- イベントログのその場編集 ---
  const parseTimeStr = (s) => {
    const parts = String(s).trim().split(':');
    if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
    return parseFloat(s) || 0;
  };

  const startEditEvent = (realIdx) => {
    const ev = events[realIdx];
    setEditingIdx(realIdx);
    setEditTime(`${Math.floor(ev.minute / 60)}:${(ev.minute % 60).toFixed(1).padStart(4, '0')}`);
    setEditType(ev.event_type);
  };

  const applyEditEvent = () => {
    const t = Math.max(0, parseTimeStr(editTime));
    setEvents(evts => evts.map((e, i) => i === editingIdx ? { ...e, minute: Math.round(t * 1000) / 1000, event_type: editType } : e));
    setEditingIdx(null);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoSrc(URL.createObjectURL(file));
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const pauseForAction = (actionType) => {
    let raw = currentTime;
    if (videoRef.current) {
      raw = videoRef.current.currentTime;
      setCurrentTime(raw);
      setWasPlaying(!videoRef.current.paused);
      videoRef.current.pause();
    }
    // ボタンを押すまでの反応遅れを補正した時刻で記録する
    const t = Math.max(0, raw - lagOffset);
    const possessor = getBallPossessor(t);
    
    let initialStep = 1;
    let initialData = { minute: t };
    
    if (actionType === 'lost') {
      if (possessor === 'opponent') {
        initialStep = 1; // Opponent possession lost -> ask who tackled
      } else if (possessor && possessor !== 'opponent') {
        initialStep = 1;
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
      const chronoEvents = sortEventsChronologically(events);
      const tagStats = computeTagStats(events, Array.from(attendees));
      const statsMap = tagStats.byPlayer;

      // 前後半イベントが揃っていれば実プレー時間（ハーフタイム等を除外）を採用する
      let playDuration = null;
      {
        let periodStartAt = null;
        let total = 0;
        let pairs = 0;
        chronoEvents.forEach(ev => {
          if (ev.event_type === 'period_start') periodStartAt = ev.minute;
          else if (ev.event_type === 'period_end' && periodStartAt != null) {
            total += ev.minute - periodStartAt;
            periodStartAt = null;
            pairs++;
          }
        });
        if (pairs > 0 && periodStartAt == null) playDuration = Math.round(total);
      }

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
        duration_seconds: playDuration ?? (videoRef.current ? Math.floor(videoRef.current.duration) : (events.length > 0 ? Math.max(...events.map(e => e.minute)) + 60 : 2400)),
        video_url: videoUrl || null,
        events: chronoEvents.map(ev => {
          const newEv = { ...ev };
          if (newEv.user_id === undefined) newEv.user_id = null;
          if (newEv.target_user_id === undefined) newEv.target_user_id = null;
          if (newEv.position === undefined) newEv.position = null;
          if (newEv.period === undefined) newEv.period = null;
          return newEv;
        })
      };
      await createMatch(payload);
      const remaining = slots.filter(s => s.id !== activeSlotId);
      const nextSlots = remaining.length > 0 ? remaining : [createEmptySlot('作業 1')];
      localStorage.setItem(SLOTS_KEY, JSON.stringify(nextSlots));
      localStorage.setItem(ACTIVE_KEY, nextSlots[0].id);
      localStorage.removeItem(LEGACY_EVENTS);
      localStorage.removeItem(LEGACY_SETUP);
      alert('保存しました');
      router.push('/admin/matches');
    } catch (err) {
      console.error(err);
      alert('保存エラー: ' + err.message);
    }
  };

  return (
    <div className={styles.editorPage}>
      <header className={styles.editorHeader}>
        <div className={styles.headerTitle}>動画解析エディタ（新規作成）</div>
        {step === 'analyze' && (
          <button className={styles.saveBtn} onClick={goToSave}>保存画面へ</button>
        )}
      </header>

      <div className={styles.mainContent}>
        {step === 'setup' && (
          <div className={styles.setupPanel}>
            <div className={styles.setupCard}>
              <h2 className={styles.setupHeading}>1. 出席者とスタメンの設定</h2>
              <div className={styles.draftRow}>
                {slots.map(s => (
                  <button
                    key={s.id}
                    className={`${styles.draftChip} ${s.id === activeSlotId ? styles.draftChipActive : ''}`}
                    onClick={() => switchSlot(s.id)}
                    type="button"
                  >
                    {s.label}{s.events?.length ? ` (${s.events.length})` : ''}
                  </button>
                ))}
                <button className={styles.draftChip} type="button" onClick={createSlot}>+ 新しい作業</button>
                {activeSlotId && (
                  <button className={styles.draftChip} type="button" onClick={() => deleteSlot(activeSlotId)}>この作業を削除</button>
                )}
              </div>
              <p className={styles.hint}>作業内容はブラウザに自動保存されます。試合ごとに作業を分けてください。ローカル動画は保存されないため、再開時は再選択してください。</p>
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                {!videoSrc && (
                  <label className={styles.uploadLabel} style={{ display: 'inline-block', margin: '0 auto' }}>
                    ローカル動画を選択 (MP4)
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
                  </label>
                )}
                {videoSrc && <span className={styles.uploadOk}>動画選択済み</span>}
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
                <video
                  src={videoSrc}
                  ref={videoRef}
                  className={styles.videoElement}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }}
                  style={{ flex: 1, minHeight: 0, maxHeight: '100%' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(() => {
                    const ctrlBtn = { background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' };
                    return (
                      <>
                        <button style={ctrlBtn} onClick={() => seekBy(-10)}>-10秒</button>
                        <button style={ctrlBtn} onClick={() => seekBy(-5)}>-5秒 [←]</button>
                        <button style={{ ...ctrlBtn, borderColor: 'var(--color-gold, #C5A059)' }} onClick={() => replayLast(5)}>直前5秒リプレイ [8]</button>
                        <button style={ctrlBtn} onClick={() => seekBy(5)}>+5秒 [→]</button>
                        <button style={ctrlBtn} onClick={() => seekBy(10)}>+10秒</button>
                        <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '0.8rem' }}>速度 [9]:</span>
                        {SPEED_OPTIONS.map(r => (
                          <button
                            key={r}
                            style={{
                              ...ctrlBtn,
                              fontWeight: playbackRate === r ? 'bold' : 'normal',
                              borderColor: playbackRate === r ? 'var(--color-gold, #C5A059)' : '#555',
                              color: playbackRate === r ? 'var(--color-gold, #C5A059)' : '#eee',
                            }}
                            onClick={() => changeSpeed(r)}
                          >
                            {r}x
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className={styles.logSection} style={{ flex: '1', overflowY: 'auto', background: '#111', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ flex: 1, padding: '0.5rem', background: '#333', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                    {currentPeriodInfo.period
                      ? <span style={{ color: 'var(--color-gold, #C5A059)' }}>{currentPeriodInfo.period === 2 ? '後半' : '前半'} {fmtTime(currentTime - currentPeriodInfo.startTime)}</span>
                      : <span style={{ color: '#aaa' }}>プレー時間外</span>}
                  </div>
                  <div style={{ flex: 2, padding: '0.5rem', background: '#333', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                    ボール保持: {currentPossessor === 'opponent' ? <span style={{color: '#ff6b6b'}}>相手チーム</span> : (currentPossessor ? <span style={{color: '#4CAF50'}}>{players.find(p => p.user_id === currentPossessor)?.name}</span> : <span style={{color: '#aaa'}}>不明/プレー外</span>)}
                  </div>
                </div>
                <div className={styles.liveStats}>
                  <div className={styles.statCell}>
                    <div className={styles.statLabel}>スコア</div>
                    <div className={styles.statValue}>{liveStats.ourGoals} - {liveStats.oppGoals}</div>
                  </div>
                  <div className={styles.statCell}>
                    <div className={styles.statLabel}>シュート</div>
                    <div className={styles.statValue}>{liveStats.ourShots}</div>
                  </div>
                  <div className={styles.statCell}>
                    <div className={styles.statLabel}>パス成功率</div>
                    <div className={styles.statValue}>{liveStats.passPct == null ? '-' : `${liveStats.passPct}%`}</div>
                    <div className={styles.statLabel}>{liveStats.passes}/{liveStats.passAttempts}</div>
                  </div>
                  <div className={styles.statCell}>
                    <div className={styles.statLabel}>ポゼッション</div>
                    <div className={styles.statValue}>{liveStats.possPct == null ? '-' : `${liveStats.possPct}%`}</div>
                  </div>
                </div>
                <h3 style={{ marginBottom: '10px' }}>アクション</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('kickoff')}>キックオフ [1]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('shot')}>シュート [2]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('pass')}>パス [3]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('lost')}>ロスト [4]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('foul')}>ファール [5]</button>
                  <button className={styles.actionBtn} onClick={() => pauseForAction('sub')}>交代 [6]</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <button
                    className={styles.actionBtn}
                    disabled={!nextPeriodAction}
                    style={{ borderColor: 'var(--color-gold, #C5A059)', opacity: nextPeriodAction ? 1 : 0.4 }}
                    onClick={handlePeriodAction}
                  >
                    {nextPeriodAction ? `${nextPeriodAction.label} [7]` : '試合終了済'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    disabled={undoStack.length === 0}
                    style={{ borderColor: '#ff6b6b', opacity: undoStack.length === 0 ? 0.4 : 1 }}
                    onClick={undoLast}
                  >
                    元に戻す [Ctrl+Z]
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#aaa' }}>
                  <span>記録時刻の補正:</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={lagOffset}
                    onChange={e => setLagOffset(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '60px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '4px', textAlign: 'center' }}
                  />
                  <span>秒前の時点を記録する</span>
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
                    {events.slice().reverse().map((ev, i) => {
                      const realIdx = events.length - 1 - i;
                      if (editingIdx === realIdx) {
                        return (
                          <div key={i} style={{ fontSize: '0.85rem', padding: '6px', borderBottom: '1px solid #333', display: 'flex', gap: '6px', alignItems: 'center', background: '#1f1f1f' }}>
                            <input
                              value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                              placeholder="分:秒"
                              style={{ width: '70px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '4px', textAlign: 'center' }}
                            />
                            <select
                              value={editType}
                              onChange={e => setEditType(e.target.value)}
                              style={{ flex: 1, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '4px' }}
                            >
                              {Object.entries(EVENT_DISPLAY_NAMES).map(([type, label]) => (
                                <option key={type} value={type}>{label}</option>
                              ))}
                            </select>
                            <button style={{ color: '#4CAF50', background: 'none', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }} onClick={applyEditEvent}>OK</button>
                            <button style={{ color: '#aaa', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }} onClick={() => setEditingIdx(null)}>取消</button>
                          </div>
                        );
                      }
                      return (
                        <div key={i} style={{ fontSize: '0.85rem', padding: '6px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <span
                              style={{ color: 'var(--color-gold, #C5A059)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                              title="クリックで該当シーンへジャンプ"
                              onClick={() => seekToEvent(ev.minute)}
                            >[{fmtTime(ev.minute)}]</span> 
                            <span style={{ color: '#74c0fc', marginLeft: '5px' }}>{displayEventType(ev)}</span>
                            {ev.user_id && <span style={{ marginLeft: '5px', color: '#eee' }}>({players.find(p=>p.user_id===ev.user_id)?.name})</span>}
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            <button style={{ color: '#74c0fc', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} onClick={() => startEditEvent(realIdx)}>編集</button>
                            <button style={{ color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} onClick={() => {
                                const newEvents = [...events];
                                newEvents.splice(realIdx, 1);
                                setEvents(newEvents);
                                if (editingIdx !== null && editingIdx >= realIdx) setEditingIdx(null);
                            }}>削除</button>
                          </span>
                        </div>
                      );
                    })}
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
                                   <div key={i} title={`[${fmtTime(ev.minute)}] ${displayEventType(ev)} (クリックで削除)`} 
                                        className={styles.eventBadge}
                                        style={{ cursor: 'pointer', userSelect: 'none' }} 
                                        onClick={() => {
                                     if (confirm(`[${fmtTime(ev.minute)}] イベント「${displayEventType(ev)}」を削除しますか？`)) {
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
          <div className={styles.savePanel}>
            <h2>試合データの確認・保存</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className={styles.playerSelect} />
              <input type="text" placeholder="大会名" value={competitionName} onChange={e => setCompetitionName(e.target.value)} className={styles.playerSelect} />
              <input type="text" placeholder="相手チーム" value={opponentName} onChange={e => setOpponentName(e.target.value)} className={styles.playerSelect} />
              <input type="url" placeholder="YouTube URL（任意）" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className={styles.playerSelect} />
              <p className={styles.hint}>限定公開のYouTube URLを入れると、試合詳細でイベント時刻から再生できます。タグ付けに使った動画と同じものを指定してください。</p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="number" placeholder="自チーム得点" value={ourScore} onChange={e => setOurScore(e.target.value)} className={styles.playerSelect} />
                <input type="number" placeholder="相手チーム得点" value={opponentScore} onChange={e => setOpponentScore(e.target.value)} className={styles.playerSelect} />
              </div>
              {((parseInt(ourScore, 10) || 0) !== liveStats.ourGoals || (parseInt(opponentScore, 10) || 0) !== liveStats.oppGoals) && (
                <div className={styles.scoreWarn}>
                  イベント上のスコアは {liveStats.ourGoals} - {liveStats.oppGoals} です。手入力と食い違っています。
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                シュート {liveStats.ourShots} / パス {liveStats.passPct == null ? '-' : `${liveStats.passPct}%`} ({liveStats.passes}/{liveStats.passAttempts}) / ポゼッション {liveStats.possPct == null ? '-' : `${liveStats.possPct}%`}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #444', color: '#aaa' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>選手</th>
                      <th style={{ padding: '8px' }}>G</th>
                      <th style={{ padding: '8px' }}>A</th>
                      <th style={{ padding: '8px' }}>シュート</th>
                      <th style={{ padding: '8px' }}>パス</th>
                      <th style={{ padding: '8px' }}>セーブ</th>
                      <th style={{ padding: '8px' }}>奪取</th>
                      <th style={{ padding: '8px' }}>ブロック</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(attendees).map(uid => {
                      const p = players.find(x => x.user_id === uid);
                      const st = liveStats.byPlayer[uid] || {};
                      return (
                        <tr key={uid} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '8px' }}>{p?.name || uid}{starters.has(uid) ? ' (ST)' : ''}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.goals || 0}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.assists || 0}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.shots || 0}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.passes || 0}{st.passMiss ? `/${(st.passes || 0) + st.passMiss}` : ''}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.saves || 0}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.steals || 0}</td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>{st.blocks || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {events.some(e => e.loc_x != null) && (
                <div>
                  <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '0.85rem' }}>シュートマップ</div>
                  <ShotMap events={events} />
                </div>
              )}
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
          addEvents={addEventBatch}
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
function EventModal({ action, setAction, addEvents, resume, activePlayers, benchPlayers, gkId, getPlayerPosition, currentPossessor }) {
  const updateData = (updates) => setAction(prev => ({ ...prev, data: { ...prev.data, ...updates } }));
  const nextStep = (nextStepNum) => setAction(prev => ({ ...prev, step: nextStepNum }));

  const commitEvents = (finalEvents, loc) => {
    const stamped = loc
      ? finalEvents.map(ev => SHOT_LOC_TYPES.has(ev.event_type) ? { ...ev, loc_x: loc.x, loc_y: loc.y } : ev)
      : finalEvents;
    addEvents(stamped, action?.data?.minute);
    resume();
  };
  
  const finish = (eventsToAdd, overrideHelper = undefined) => {
    let finalEvents = Array.isArray(eventsToAdd) ? [...eventsToAdd] : [eventsToAdd];
    const helperId = overrideHelper !== undefined ? overrideHelper : action?.data?.helper;
    if (helperId) {
      finalEvents.splice(finalEvents.length - 1, 0, { event_type: 'steal', user_id: helperId });
    }
    if (action.type === 'shot' && action.data?.loc_x == null && !action.data?.locSkipped) {
      updateData({ pendingFinish: finalEvents });
      nextStep(19);
      return;
    }
    const loc = action.data?.loc_x != null ? { x: action.data.loc_x, y: action.data.loc_y } : null;
    commitEvents(finalEvents, loc);
  };

  const PlayerGrid = ({ onSelect, allowNone, noneLabel = 'なし', players = activePlayers }) => (
    <div style={{ display: 'grid', gridTemplateColumns: players.length <= 5 ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '8px', marginTop: '1rem' }}>
      {players.map((p, index) => (
        <button key={p.user_id} data-key={index + 1 < 9 ? String(index + 1) : undefined} onClick={() => onSelect(p.user_id)} className={styles.saveBtn} style={{ position: 'relative', background: '#333', border: '1px solid #555', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {index + 1 < 9 && <span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>[{index + 1}]</span>}
          {p.photo_url ? <img src={getImageUrl(p.photo_url)} alt={p.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{p.jersey_number || '-'}</div>}
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{p.name}</span>
        </button>
      ))}
      {allowNone && <button data-key="9" onClick={() => onSelect(null)} className={styles.deleteBtn} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>[9]</span>{noneLabel}</button>}
    </div>
  );

  const Title = ({ text }) => <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', textAlign: 'center' }}>{text}</h3>;

  // 「ここまでの内容だけ記録して質問を打ち切る」ボタン。素早いタグ付け用
  const SkipBtn = ({ onClick }) => (
    <button
      data-key="9"
      className={styles.deleteBtn}
      style={{ marginTop: '10px', width: '100%', background: 'transparent', border: '1px dashed #777', color: '#aaa' }}
      onClick={onClick}
    >
      スキップ（ここまでの内容で記録） [9]
    </button>
  );

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
      if (step === 19) return (
        <>
          <Title text="シュート位置をタップ（左=自ゴール / 右=相手ゴール）" />
          <CourtPicker onPick={(x, y) => commitEvents(data.pendingFinish || [], { x, y })} />
          <SkipBtn onClick={() => commitEvents(data.pendingFinish || [], null)} />
        </>
      );
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
          <SkipBtn onClick={() => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }])} />
        </>
      );
      // step 14 is intentionally skipped
      if (step === 15) return <><Title text="誰が拾ったか？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: 'recovery', user_id: id }] : [{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }])} /></>;
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
      if (step === 17) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: 'shot', user_id: data.shooter }, { event_type: data.res === 'block' ? 'opponent_block' : 'save', team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      
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
          <SkipBtn onClick={() => finish([{ event_type: 'save', user_id: gkId }])} />
        </>
      );
      if (step === 22) return <><Title text="誰がブロックした？" /><PlayerGrid onSelect={(id) => { updateData({ blocker: id }); nextStep(25); }} /></>;
      if (step === 23) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: 'save', user_id: gkId }, { event_type: 'recovery', user_id: id }] : [{ event_type: 'save', user_id: gkId }])} /></>;
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
      if (step === 27) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: data.res === 'block' ? 'block' : 'save', user_id: data.res === 'block' ? data.blocker : gkId }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
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
          <SkipBtn onClick={() => finish([{ event_type: 'block', user_id: data.blocker }])} />
        </>
      );
      if (step === 26) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: 'block', user_id: data.blocker }, { event_type: 'recovery', user_id: id }] : [{ event_type: 'block', user_id: data.blocker }])} /></>;
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
      // 短縮フロー: 受け手を選択 = パス成功として即記録。ミス時のみ [9] で分岐
      if (step === 102) return (
        <>
          <Title text="誰が受けた？（選択でパス成功を記録）" />
          <PlayerGrid onSelect={(id) => finish({ event_type: 'pass', user_id: data.passer, target_user_id: id })} />
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <button data-key="9" className={styles.deleteBtn} style={{ position: 'relative', padding: '10px 24px' }} onClick={() => nextStep(104)}>
              <span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>[9]</span>
              ミス / カットされた
            </button>
          </div>
        </>
      );
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
          <SkipBtn onClick={() => finish([...missEvents])} />
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
          <SkipBtn onClick={() => finish([...missEvents, { event_type: 'clear', team: 'opponent' }])} />
        </>
      );
      if (step === 106) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: 'recovery', user_id: id }] : [...missEvents, { event_type: 'clear', team: 'opponent' }])} /></>;
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
      if (step === 108) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([...missEvents, { event_type: 'clear', team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;

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
          <SkipBtn onClick={() => finish([{ event_type: 'opponent_pass_fail' }])} />
        </>
      );
      if (step === 122) return <><Title text="誰が奪った？" /><PlayerGrid onSelect={(id) => { updateData({ actor: id }); nextStep(1225); }} /></>;
      if (step === 123) return <><Title text="誰がクリアした？" /><PlayerGrid onSelect={(id) => { updateData({ clearer: id }); nextStep(1225); }} /></>;
      if (step === 1225) return (
        <>
          <Title text="協力者（カバー等）はいた？" />
          <PlayerGrid allowNone onSelect={(id) => { 
            if (data.action === 'pass_cut') {
              finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'pass_cut', user_id: data.actor }], id);
            } else {
              updateData({ helper: id });
              nextStep(124);
            }
          }} />
        </>
      );
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
          <SkipBtn onClick={() => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }])} />
        </>
      );
      if (step === 125) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: 'recovery', user_id: id }] : [{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }])} /></>;
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
      if (step === 127) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: 'clear', user_id: data.clearer }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      if (step === 128) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
    }

    // --- LOST (formerly DEFENSE) ---
    if (type === 'lost') {
      if (currentPossessor === 'opponent') {
        // --- Opponent possession ---
        if (step === 1) return (
          <>
            <Title text="どうやって失った/防いだ？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => { updateData({ defense_type: 'tackle' }); nextStep(201); }}>自チームのタックル [1]</button>
              <button data-key="2" className={styles.saveBtn} onClick={() => { updateData({ defense_type: 'clear' }); nextStep(210); }}>自チームのクリア [2]</button>
              <button data-key="3" className={styles.deleteBtn} onClick={() => { updateData({ defense_type: 'opponent_lost' }); nextStep(220); }}>相手のミス（トラップミス・ドリブルアウト等） [3]</button>
              <button data-key="4" className={styles.deleteBtn} onClick={() => { updateData({ defense_type: 'opponent_clear' }); nextStep(220); }}>相手のクリア [4]</button>
            </div>
          </>
        );
        if (step === 201) return <><Title text="誰がタックルした？" /><PlayerGrid onSelect={(id) => { updateData({ actor: id }); nextStep(2015); }} /></>;
        if (step === 210) return <><Title text="誰がクリアした？" /><PlayerGrid onSelect={(id) => { updateData({ actor: id }); nextStep(2015); }} /></>;
        if (step === 2015) return <><Title text="協力者（カバー等）はいた？" /><PlayerGrid allowNone onSelect={(id) => { updateData({ helper: id }); nextStep(202); }} /></>;
        
        if (step === 202) return (
          <>
            <Title text="ボールはどうなった？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(203)}>自チームが拾った [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
              <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(204); }}>サイドアウトになった [3]</button>
              <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(204); }}>コーナーキックになった [4]</button>
              <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(204); }}>ゴールスロー(GK)になった [5]</button>
            </div>
            <SkipBtn onClick={() => finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }])} />
          </>
        );
        if (step === 203) return (
          <>
            <Title text="誰が拾った？" />
            <PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => {
              if (!id) {
                finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }]);
              } else if (data.defense_type === 'tackle' && id === data.actor) {
                finish([{ event_type: 'steal', user_id: data.actor }]);
              } else {
                finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: 'recovery', user_id: id }]);
              }
            }} />
          </>
        );
        if (step === 204) return (
          <>
            <Title text="どっちのボールになった？" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
                else nextStep(205);
              }}>自チームのボール [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: 'goal_kick', team: 'opponent' }]);
                else finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: data.out_type, team: 'opponent' }]);
              }}>相手チームのボール [2]</button>
            </div>
          </>
        );
        if (step === 205) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: data.defense_type === 'tackle' ? 'steal' : 'clear', user_id: data.actor }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;

        if (step === 220) return (
          <>
            <Title text="ボールはどうなった？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(221)}>自チームが拾った [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: data.defense_type, team: 'opponent' }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
              <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(222); }}>サイドアウトになった [3]</button>
              <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(222); }}>コーナーキックになった [4]</button>
              <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(222); }}>ゴールスロー(GK)になった [5]</button>
            </div>
            <SkipBtn onClick={() => finish([{ event_type: data.defense_type, team: 'opponent' }])} />
          </>
        );
        if (step === 221) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: data.defense_type, team: 'opponent' }, { event_type: 'recovery', user_id: id }] : [{ event_type: data.defense_type, team: 'opponent' }])} /></>;
        if (step === 222) return (
          <>
            <Title text="どっちのボールになった？" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: data.defense_type, team: 'opponent' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
                else nextStep(223);
              }}>自チームのボール [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: data.defense_type, team: 'opponent' }, { event_type: 'goal_kick', team: 'opponent' }]);
                else finish([{ event_type: data.defense_type, team: 'opponent' }, { event_type: data.out_type, team: 'opponent' }]);
              }}>相手チームのボール [2]</button>
            </div>
          </>
        );
        if (step === 223) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: data.defense_type, team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      } else {
        // --- Our possession ---
        if (step === 1) return (
          <>
            <Title text="どうやって失った？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_steal', team: 'opponent' }, { event_type: 'recovery', team: 'opponent' }])}>タックルされた [1]</button>
              <button data-key="2" className={styles.saveBtn} onClick={() => nextStep(102)}>クリアされた [2]</button>
            </div>
          </>
        );
        if (step === 102) return (
          <>
            <Title text="ボールはどうなった？" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => nextStep(103)}>自チームが拾った [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: 'recovery', team: 'opponent' }])}>相手が拾った [2]</button>
              <button data-key="3" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(104); }}>サイドアウトになった [3]</button>
              <button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(104); }}>コーナーキックになった [4]</button>
              <button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(104); }}>ゴールスロー(GK)になった [5]</button>
            </div>
            <SkipBtn onClick={() => finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }])} />
          </>
        );
        if (step === 103) return <><Title text="誰が拾った？" /><PlayerGrid allowNone noneLabel="不明/スキップ" onSelect={(id) => finish(id ? [{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: 'recovery', user_id: id }] : [{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }])} /></>;
        if (step === 104) return (
          <>
            <Title text="どっちのボールになった？" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button data-key="1" className={styles.saveBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: 'goal_kick', team: 'own', user_id: gkId }]);
                else nextStep(105);
              }}>自チームのボール [1]</button>
              <button data-key="2" className={styles.deleteBtn} onClick={() => {
                if (data.out_type === 'goal_kick') finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: 'goal_kick', team: 'opponent' }]);
                else finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: data.out_type, team: 'opponent' }]);
              }}>相手チームのボール [2]</button>
            </div>
          </>
        );
        if (step === 105) return <><Title text="誰が蹴る？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: 'lost_ball', team: 'own' }, { event_type: 'opponent_clear', team: 'opponent' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;
      }
    }

    // --- FOUL ---
    if (type === 'foul') {
      if (step === 1) return (
        <>
          <Title text="どっちのファール？" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button data-key="1" className={styles.deleteBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => nextStep(2)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[1]</span>自チームのファール</button>
            <button data-key="2" className={styles.saveBtn} style={{ padding: '2rem', position: 'relative' }} onClick={() => nextStep(3)}><span style={{position:'absolute', top: 5, left: 5, fontSize: '0.8rem'}}>[2]</span>相手のファール</button>
          </div>
        </>
      );
      if (step === 2) return <><Title text="誰がファールした？" /><PlayerGrid allowNone onSelect={(id) => finish([{ event_type: 'foul', user_id: id }, { event_type: 'free_kick', team: 'opponent' }])} /></>;
      if (step === 3) return <><Title text="自チームは誰から再開する？" /><PlayerGrid allowNone noneLabel="スキップ" onSelect={(id) => finish([{ event_type: 'foul_opponent', team: 'opponent' }, { event_type: 'free_kick', team: 'own', user_id: id }])} /></>;
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
      <div style={{ background: '#222', padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: action.step === 19 ? '720px' : '600px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        {renderContent()}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button data-key="0" className={styles.deleteBtn} style={{ background: 'transparent', border: '1px solid #ff6b6b' }} onClick={resume}>キャンセル [0]</button>
        </div>
      </div>
    </div>
  );
}
