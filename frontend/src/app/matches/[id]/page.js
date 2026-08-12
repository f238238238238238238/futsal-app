'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMatch, getImageUrl } from '@/lib/api';
import styles from './page.module.css';

const POSITIONS = {
  'GK': { top: '90%', left: '50%' },
  'Fixo': { top: '75%', left: '47%' },
  'Ala L': { top: '50%', left: '22%' },
  'Ala R': { top: '50%', left: '78%' },
  'Pivo': { top: '25%', left: '47%' },
  'red_GK': { top: '92%', left: '50%' },
  'red_Fixo': { top: '75%', left: '50%' },
  'red_AlaL': { top: '60%', left: '25%' },
  'red_AlaR': { top: '60%', left: '75%' },
  'red_Pivo': { top: '45%', left: '50%' },
  'blue_GK': { top: '8%', left: '50%' },
  'blue_Fixo': { top: '25%', left: '50%' },
  'blue_AlaL': { top: '40%', left: '75%' },
  'blue_AlaR': { top: '40%', left: '25%' },
  'blue_Pivo': { top: '55%', left: '50%' },
  'dummy_blue_GK': { top: '10%', left: '50%' },
  'dummy_blue_Fixo': { top: '25%', left: '53%' },
  'dummy_blue_AlaL': { top: '50%', left: '82%' },
  'dummy_blue_AlaR': { top: '50%', left: '18%' },
  'dummy_blue_Pivo': { top: '75%', left: '53%' },
  'default': { top: '50%', left: '50%' }
};

export default function MatchDetailPage() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [minute, setMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(-1);
  
  const [ballState, setBallState] = useState({ top: '50%', left: '50%', opacity: 0 });
  const [effect, setEffect] = useState(null);

  useEffect(() => {
    getMatch(id)
      .then(res => {
        const m = res.match || res;
        
        if ((!m.duration_seconds || m.duration_seconds === 2400) && m.events && m.events.length > 0) {
           const maxEventMin = Math.max(...m.events.map(e => e.minute));
           if (maxEventMin < 2300) {
             m.duration_seconds = Math.max(600, Math.ceil(maxEventMin / 60) * 60);
           }
        }
        
        setMatch(m);
        setMinute(m.duration_seconds || 2400);
        if (m.events && m.events.length > 0) {
           setPlayIndex(m.events.length - 1);
        }
      })
      .catch(err => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const sortedEvents = useMemo(() => {
    if (!match || !match.events) return [];
    return [...match.events].sort((a,b) => a.minute - b.minute);
  }, [match]);

  const getPlayerPosition = (userId, currentMin, evPos) => {
    if (!userId && evPos && (evPos.startsWith('dummy_') || evPos === 'opponent')) {
      return POSITIONS[evPos] || POSITIONS['default'];
    }
    if (userId && typeof userId === 'string' && (userId.startsWith('dummy_') || userId === 'opponent')) {
      return POSITIONS[userId] || POSITIONS['default'];
    }
    let pos = '';
    const starter = match.stats.find(s => s.user_id === userId);
      if (starter && (starter.is_starter === 1 || starter.is_starter === true)) {
      pos = starter.position;
      
      // Fallback for missing position bug in older matches
      if (!pos && match.match_mode !== 'intra') {
        const occupied = new Set(match.stats.map(s => s.position).filter(Boolean));
        const extPos = ['GK', 'Fixo', 'Ala L', 'Ala R', 'Pivo'];
        const missing = extPos.filter(p => !occupied.has(p));
        // We can't guarantee the EXACT slot without stateful iteration like above, 
        // but we can try to find this user's index among starters with missing positions
        const startersMissingPos = match.stats.filter(s => (s.is_starter === 1 || s.is_starter === true) && !s.position);
        const idx = startersMissingPos.findIndex(s => s.user_id === userId);
        if (idx !== -1 && missing[idx]) {
          pos = missing[idx];
        }
      }
    }
    for (const e of sortedEvents) {
      if (e.minute > currentMin) break;
      if (e.user_id === userId) {
        if (e.event_type === 'sub_in') pos = e.position;
        if (e.event_type === 'sub_out') pos = '';
        if (e.event_type === 'position_change') pos = e.position;
      }
    }
    return POSITIONS[pos] || POSITIONS['default'];
  };

  const triggerAnimation = (ev, evIndex) => {
    const pPos = getPlayerPosition(ev.user_id, ev.minute, ev.position);
    
    switch (ev.event_type) {
      case 'kickoff':
      case 'pass':
      case 'assist':
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        if (ev.target_user_id && ev.target_user_id !== 'opponent' && !ev.target_user_id.toString().startsWith('dummy_')) {
          setTimeout(() => {
            const targetPos = getPlayerPosition(ev.target_user_id, ev.minute, null);
            setBallState({ top: targetPos.top, left: targetPos.left, opacity: 1 });
          }, 300);
        } else if (ev.target_user_id === 'opponent' || (ev.target_user_id && ev.target_user_id.toString().startsWith('dummy_'))) {
          setTimeout(() => {
            setBallState({ top: '50%', left: '50%', opacity: 1 });
            setEffect({ key: Date.now(), type: 'badge', top: '50%', left: '50%', emoji: '💥' });
          }, 300);
        }
        
        if(ev.event_type === 'assist') {
          setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: '🅰️' });
        }
        break;
      case 'steal':
      case 'catch':
      case 'pass_cut':
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        if(ev.event_type === 'steal' || ev.event_type === 'catch' || ev.event_type === 'pass_cut') {
          setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: ev.event_type === 'catch' ? '🧤' : '🛡️' });
        }
        if(ev.event_type === 'assist') {
          setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: '🅰️' });
        }
        break;
      case 'lost_ball':
        setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: '💥' });
        setBallState({ top: pPos.top, left: pPos.left, opacity: 0 });
        break;
      case 'block':
      case 'save':
      case 'defense':
        setEffect({ key: Date.now(), type: 'badge', top: pPos.top, left: pPos.left, emoji: ev.event_type === 'save' ? '🧤' : '🛡️' });
        setBallState({ top: `calc(${pPos.top} + 15%)`, left: `calc(${pPos.left} + 15%)`, opacity: 0 });
        break;
      case 'goal':
        let goalCount = 0;
        if (evIndex !== undefined) {
          for(let i=0; i<=evIndex; i++) {
            if(sortedEvents[i].event_type === 'goal' && sortedEvents[i].user_id === ev.user_id) {
              goalCount++;
            }
          }
        }
        const isHattrick = goalCount === 3;

        // まずゴール決めた人へパスアニメーション(400ms)
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        setTimeout(() => {
          // パス完了後にゴールへシュート
          setBallState({ top: '0%', left: '50%', opacity: 1 });
          setTimeout(() => {
            if (isHattrick) {
              setEffect({ key: Date.now(), type: 'hattrick', top: '50%', left: '50%', emoji: 'HATTRICK!!! 🎩✨🔥' });
            } else {
              setEffect({ key: Date.now(), type: 'goal', top: '50%', left: '50%', emoji: 'GOAL!! 🎉' });
            }
            
            // 演出終了後(約1.5秒〜2秒後)にコート中央へボールをリセット
            setTimeout(() => {
              setBallState({ top: '50%', left: '50%', opacity: 1 });
            }, 2000);

          }, 400);
        }, 400);
        break;
      case 'shot':
      case 'shot_off':
        setBallState({ top: pPos.top, left: pPos.left, opacity: 1 });
        setTimeout(() => {
          setBallState({ top: '-10%', left: '70%', opacity: 0 });
          setTimeout(() => {
            if (ev.event_type === 'shot') {
              setEffect({ key: Date.now(), type: 'badge', top: '50%', left: '50%', emoji: '👟💥' });
            } else {
              setEffect({ key: Date.now(), type: 'miss', top: '50%', left: '50%', emoji: 'NO GOAL 😱' });
            }
          }, 400);
        }, 400);
        break;
      default:
        // それ以外のイベントでも必要に応じて中央リセットなどを入れるか検討
        break;
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    
    const nextIdx = playIndex + 1;
    if (nextIdx >= sortedEvents.length) {
      setIsPlaying(false);
      return;
    }
    
    const nextEvent = sortedEvents[nextIdx];
    const delay = playIndex === -1 ? 500 : 2500; // wait longer between events
    
    const timer = setTimeout(() => {
      setMinute(nextEvent.minute);
      setPlayIndex(nextIdx);
      triggerAnimation(nextEvent, nextIdx);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [isPlaying, playIndex, sortedEvents]);

  const handleSliderChange = (newMin) => {
    setMinute(newMin);
    setIsPlaying(false);
    
    let idx = -1;
    for(let i=0; i<sortedEvents.length; i++) {
      if(sortedEvents[i].minute <= newMin) idx = i;
    }
    setPlayIndex(idx);
    
    if (idx >= 0) {
      triggerAnimation(sortedEvents[idx], idx);
    } else {
      setBallState({ ...ballState, opacity: 0 });
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If at the end, restart
      if (playIndex >= sortedEvents.length - 1) {
        setPlayIndex(-1);
        setMinute(0);
        setBallState({ top: '50%', left: '50%', opacity: 0 });
      }
      setIsPlaying(true);
    }
  };

  const { onPitch, bench } = useMemo(() => {
    if (!match || !match.stats) return { onPitch: [], bench: [] };
    
    let currentOnPitch = [];
    let currentBench = [];
    const occupiedPositions = new Set(match.stats.map(st => st.position).filter(Boolean));
    const allExternalPos = ['GK', 'Fixo', 'Ala L', 'Ala R', 'Pivo'];
    let missingExternal = allExternalPos.filter(pos => !occupiedPositions.has(pos));

    match.stats.forEach(st => {
      let startingPos = st.position || '';
      
      if ((st.is_starter === 1 || st.is_starter === true) && !startingPos && match.match_mode !== 'intra') {
        if (missingExternal.length > 0) {
          startingPos = missingExternal.shift();
        }
      }

      const p = { 
        user_id: st.user_id, 
        name: st.name || st.user_name, 
        photo_url: st.photo_url, 
        jersey_number: st.jersey_number || '', 
        position: startingPos,
        sensor_id: st.sensor_id || null
      };
      if (st.is_starter === 1 || st.is_starter === true) {
        currentOnPitch.push(p);
      } else {
        currentBench.push(p);
      }
    });

    for (const ev of sortedEvents) {
      if (ev.minute > minute) break;

      if (ev.event_type === 'sub_in') {
        const idx = currentBench.findIndex(p => p.user_id === ev.user_id);
        if (idx !== -1) {
          const p = currentBench.splice(idx, 1)[0];
          p.position = ev.position || '';
          currentOnPitch.push(p);
        }
      } else if (ev.event_type === 'sub_out') {
        const idx = currentOnPitch.findIndex(p => p.user_id === ev.user_id);
        if (idx !== -1) {
          const p = currentOnPitch.splice(idx, 1)[0];
          p.position = '';
          currentBench.push(p);
        }
      } else if (ev.event_type === 'position_change') {
        const p = currentOnPitch.find(p => p.user_id === ev.user_id);
        if (p) {
          p.position = ev.position || '';
        }
      }
    }

    return { onPitch: currentOnPitch, bench: currentBench };
  }, [match, minute, sortedEvents]);

  const teamStats = useMemo(() => {
    let redStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0, fouls: 0, corners: 0, possessionSeconds: 0 };
    let blueStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0, fouls: 0, corners: 0, possessionSeconds: 0 };
    let playerPossessionSeconds = {};
    
    if (!match || !match.stats) return { red: redStats, blue: blueStats, playerPossession: playerPossessionSeconds };

    let currentOnPitch = [];
    let totalDefenseSeconds = 0;
    let defenseStartTime = null;
    let currentMode = 'setup';
    let opponentPassFails = 0;
    
    let currentPossessorId = null;
    let currentTeam = null;
    let possessionStartTime = 0;

    const getTeamForUser = (uid) => {
       if (!uid || uid === 'opponent' || String(uid).startsWith('dummy_')) return 'blue';
       if (match.match_mode === 'intra') {
         const p = currentOnPitch.find(x => x.user_id === uid);
         if (p && p.position.startsWith('red_')) return 'red';
         if (p && p.position.startsWith('blue_')) return 'blue';
         return null;
       }
       return 'red';
    };

    match.stats.forEach(st => {
      if (st.is_starter === 1 || st.is_starter === true) {
        let startingPos = st.position || '';
        if (!startingPos && match.match_mode !== 'intra') {
          const occupied = new Set(match.stats.map(s => s.position).filter(Boolean));
          const extPos = ['GK', 'Fixo', 'Ala L', 'Ala R', 'Pivo'];
          const missing = extPos.filter(p => !occupied.has(p));
          const startersMissingPos = match.stats.filter(s => (s.is_starter === 1 || s.is_starter === true) && !s.position);
          const idx = startersMissingPos.findIndex(s => s.user_id === st.user_id);
          if (idx !== -1 && missing[idx]) {
            startingPos = missing[idx];
          }
        }
        currentOnPitch.push({ user_id: st.user_id, position: startingPos });
      }
    });

    for (const ev of sortedEvents) {
      if (ev.minute > minute) break;
      
      // Calculate time elapsed since last possession change
      if (currentPossessorId && ev.minute >= possessionStartTime) {
         const duration = ev.minute - possessionStartTime;
         if (currentTeam === 'red') redStats.possessionSeconds += duration;
         else if (currentTeam === 'blue') blueStats.possessionSeconds += duration;
         
         if (!playerPossessionSeconds[currentPossessorId]) playerPossessionSeconds[currentPossessorId] = 0;
         playerPossessionSeconds[currentPossessorId] += duration;
      }
      
      possessionStartTime = ev.minute;
      
      if (ev.event_type === 'context_defense') {
        currentMode = 'defense';
        defenseStartTime = ev.minute;
      }
      if ((ev.event_type === 'context_attack' || ev.event_type === 'opponent_pass_fail') && currentMode === 'defense') {
        if (defenseStartTime !== null) {
          totalDefenseSeconds += (ev.minute - defenseStartTime);
          defenseStartTime = null;
        }
        currentMode = 'attack';
      }
      if (ev.event_type === 'opponent_pass_fail') {
         opponentPassFails++;
      }

      if (ev.event_type === 'sub_in') {
         currentOnPitch.push({ user_id: ev.user_id, position: ev.position || '' });
      } else if (ev.event_type === 'sub_out') {
         const idx = currentOnPitch.findIndex(p => p.user_id === ev.user_id);
         if (idx !== -1) currentOnPitch.splice(idx, 1);
      } else if (ev.event_type === 'position_change') {
         const p = currentOnPitch.find(p => p.user_id === ev.user_id);
         if (p) p.position = ev.position || '';
      }

      let team = null;
      if (match.match_mode === 'intra') {
         const p = currentOnPitch.find(x => x.user_id === ev.user_id);
         if (p && p.position.startsWith('red_')) team = 'red';
         else if (p && p.position.startsWith('blue_')) team = 'blue';
      } else {
         if (!ev.user_id || ev.user_id === 'opponent' || (typeof ev.user_id === 'string' && ev.user_id.startsWith('dummy_')) || (typeof ev.position === 'string' && (ev.position.startsWith('dummy_') || ev.position === 'opponent'))) {
            team = 'blue'; // opponent
         } else {
            team = 'red'; // us
         }
      }

      if (team === 'red') {
        if (ev.event_type === 'pass' || ev.event_type === 'side_out' || ev.event_type === 'corner_kick' || ev.event_type === 'goal_kick') redStats.passes++;
        if (ev.event_type === 'lost_ball' || ev.event_type === 'pass_miss' || ev.event_type === 'trap_miss') redStats.lost++;
        if (ev.event_type === 'goal') { redStats.goals++; redStats.shots++; }
        if (ev.event_type === 'shot' || ev.event_type === 'shot_off') redStats.shots++;
        if (ev.event_type === 'save' || ev.event_type === 'catch' || ev.event_type === 'block') {
          if (ev.event_type === 'save' || ev.event_type === 'catch') redStats.saves++;
          blueStats.shots++; // 私たちのセーブ・キャッチ・ブロック＝相手のシュート
        }
        if (ev.event_type === 'foul') redStats.fouls++;
        if (ev.event_type === 'corner_kick') redStats.corners++;
      } else if (team === 'blue') {
        if (ev.event_type === 'pass' || ev.event_type === 'opponent_pass' || ev.event_type === 'side_out' || ev.event_type === 'corner_kick' || ev.event_type === 'goal_kick') blueStats.passes++;
        if (ev.event_type === 'lost_ball' || ev.event_type === 'opponent_pass_fail' || ev.event_type === 'opponent_lost' || ev.event_type === 'opponent_clear' || ev.event_type === 'pass_miss' || ev.event_type === 'trap_miss') blueStats.lost++;
        if (ev.event_type === 'goal' || ev.event_type === 'opponent_goal') { blueStats.goals++; blueStats.shots++; }
        if (ev.event_type === 'shot' || ev.event_type === 'shot_off' || ev.event_type === 'opponent_shot_off') blueStats.shots++;
        if (ev.event_type === 'save' || ev.event_type === 'catch') {
          blueStats.saves++;
          redStats.shots++; // 相手のセーブ・キャッチ＝私たちのシュート
        }
        if (ev.event_type === 'block' || ev.event_type === 'opponent_block') {
          redStats.shots++; // 相手のブロック＝私たちのシュート
        }
        if (ev.event_type === 'foul' || ev.event_type === 'foul_opponent') blueStats.fouls++;
        if (ev.event_type === 'corner_kick') blueStats.corners++;
      }
      
      // Override for opponent-specific events in external matches
      if (ev.event_type === 'concede') { blueStats.goals++; blueStats.shots++; }
      if (ev.event_type === 'opponent_shot' || ev.event_type === 'opponent_shot_off') blueStats.shots++;
      if (ev.event_type === 'foul_opponent') blueStats.fouls++;
      
      switch(ev.event_type) {
         case 'pass':
           currentPossessorId = ev.target_user_id || 'opponent';
           currentTeam = getTeamForUser(currentPossessorId);
           break;
         case 'kickoff':
           currentPossessorId = ev.target_user_id || ev.user_id || 'opponent';
           currentTeam = getTeamForUser(currentPossessorId);
           break;
         case 'pass_cut':
         case 'steal':
         case 'recovery':
         case 'catch':
         case 'free_kick':
         case 'pk':
         case 'side_out':
         case 'goal_kick':
         case 'corner_kick':
         case 'clear':
         case 'opponent_clear':
           currentPossessorId = ev.user_id || 'opponent';
           currentTeam = getTeamForUser(currentPossessorId);
           break;
         case 'lost_ball':
         case 'pass_miss':
         case 'trap_miss':
         case 'goal':
         case 'opponent_goal':
         case 'shot':
         case 'shot_off':
         case 'concede':
         case 'opponent_shot_off':
         case 'foul':
         case 'foul_opponent':
         case 'opponent_pass_fail':
           currentPossessorId = null;
           currentTeam = null;
           break;
         default:
           break;
      }
    }
    
    if (currentPossessorId && minute > possessionStartTime) {
       const duration = minute - possessionStartTime;
       if (currentTeam === 'red') redStats.possessionSeconds += duration;
       else if (currentTeam === 'blue') blueStats.possessionSeconds += duration;
       if (!playerPossessionSeconds[currentPossessorId]) playerPossessionSeconds[currentPossessorId] = 0;
       playerPossessionSeconds[currentPossessorId] += duration;
    }
    
    if (currentMode === 'defense' && defenseStartTime !== null) {
      totalDefenseSeconds += (minute - defenseStartTime);
    }

    if (match.match_mode !== 'intra' && totalDefenseSeconds > 0) {
      const opponentEstimatedPasses = Math.max(0, Math.floor(totalDefenseSeconds / 4));
      const opponentTotalPasses = Math.max(opponentEstimatedPasses, opponentPassFails);
      const opponentSuccessfulPasses = opponentTotalPasses - opponentPassFails;
      
      // Override manual passes with our estimation
      blueStats.passes = opponentSuccessfulPasses;
      blueStats.lost = opponentPassFails;
    }

    return { red: redStats, blue: blueStats, playerPossession: playerPossessionSeconds };
  }, [match, minute, sortedEvents]);

  function getYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const matchMatch = url.match(regExp);
    return (matchMatch && matchMatch[2].length === 11) ? matchMatch[2] : null;
  }

  const StatBar = ({ label, leftVal, rightVal, leftStr, rightStr }) => {
    const total = leftVal + rightVal;
    const leftRatio = total > 0 ? (leftVal / total) * 100 : 50;
    const rightRatio = total > 0 ? (rightVal / total) * 100 : 50;
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <span style={{ color: 'var(--color-primary-400)' }}>{leftStr || leftVal}</span>
          <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{label}</span>
          <span style={{ color: '#fff' }}>{rightStr || rightVal}</span>
        </div>
        <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: '#333' }}>
          <div style={{ width: `${leftRatio}%`, background: 'var(--color-primary-400)' }} />
          <div style={{ width: `${rightRatio}%`, background: '#fff' }} />
        </div>
      </div>
    );
  };

  const pastEvents = useMemo(() => {
    return sortedEvents
      .filter(ev => ev.minute <= minute)
      .sort((a,b) => b.minute - a.minute);
  }, [sortedEvents, minute]);

  const getEventText = (ev) => {
    let name = ev.name || ev.user_name || '選手';
    if (!ev.user_id && ev.position && (ev.position.startsWith('dummy_') || ev.position === 'opponent')) {
      name = '相手選手';
    } else if (ev.user_id === 'opponent' || (typeof ev.user_id === 'string' && ev.user_id.startsWith('dummy_'))) {
      name = '相手選手';
    }
    switch (ev.event_type) {
      case 'goal': 
        if (ev.user_id === 'opponent') return `💢 失点 (相手ゴール)`;
        return `⚽ ${name} が得点！`;
      case 'opponent_goal': return `💢 失点 (相手ゴール)`;
      case 'assist': return `🅰️ ${name} がアシスト！`;
      case 'save': 
        if (ev.user_id === 'opponent') return `🧤 相手GKがセーブ！`;
        return `🧤 ${name} がセーブ(弾く)！`;
      case 'catch': 
        if (ev.user_id === 'opponent') return `🧤 相手GKがボールキャッチ！`;
        return `🧤 ${name} がボールキャッチ！`;
      case 'shot': return `👟 ${name} がシュート！(枠内)`;
      case 'shot_off': 
        if (ev.user_id === 'opponent') return `☄️ 相手チームのノーゴール`;
        return `👟 ${name} がシュート！(ノーゴール)`;
      case 'defense': return `🛡️ ${name} がディフェンス！`;
      case 'steal': return `🛡️ ${name} がボール奪取！`;
      case 'pass_cut': return `🛡️ ${name} がパスカット！`;
      case 'block': return `🛡️ ${name} がブロック！`;
      case 'opponent_block': return `🛡️ 相手がブロック！`;
      case 'sub_in': return `🔼 ${name} がピッチに入りました`;
      case 'sub_out': return `🔽 ${name} がベンチに下がりました`;
      case 'substitution': return `🔄 ${ev.target_user_name || '選手'} に代わって ${name} がピッチに入りました`;
      case 'position_change': return `🔄 ${name} が ${ev.position || '別ポジション'} に変更`;
      case 'kickoff':
        if (ev.target_user_name) {
          return `📣 ${name} から ${ev.target_user_name} へキックオフ！`;
        }
        return `📣 ${name} がキックオフ！`;
      case 'pass': 
        if (ev.user_id === 'opponent') return `🔁 相手チームがパスを繋ぎました`;
        if (ev.target_user_name) {
          return `🔁 ${name} が ${ev.target_user_name} にパスを繋ぎました`;
        } else if (ev.target_user_id === 'opponent' || (ev.target_user_id && String(ev.target_user_id).startsWith('dummy_'))) {
          return `💥 ${name} のパスが相手に渡りました`;
        }
        return `🔁 ${name} がパスを繋ぎました`;
      case 'dribble': return `🏃‍♂️ ${name} がドリブルで仕掛けました！`;
      case 'lost_ball': return `💥 ${name} がボールをロスト`;
      case 'trap_miss': return `💥 ${name} がトラップミス！`;
      case 'pass_miss': return `💥 ${name} がパスミス！`;
      case 'opponent_pass': return `🔁 相手チームがパスを繋ぎました`;
      case 'opponent_pass_fail': return `💥 相手チームがボールをロストしました`;
      case 'concede': return `💢 ${name} が失点`;
      case 'clear': return `🛡️ ${name} がクリア！`;
      case 'recovery': return ev.team === 'opponent' ? `🔄 相手チームがこぼれ球を拾いました` : `🔄 ${name} がこぼれ球を拾いました`;
      case 'opponent_shot_off': return `☄️ 相手チームがシュートミス(枠外)`;
      case 'side_out': return ev.team === 'opponent' ? `🚩 相手のサイドアウト` : `🚩 ${name} のサイドアウト(キックイン)`;
      case 'corner_kick': return ev.team === 'opponent' ? `🚩 相手のコーナーキック` : `🚩 ${name} のコーナーキック`;
      case 'goal_kick': return ev.team === 'opponent' ? `🚩 相手のゴールキック` : `🚩 ${name} のゴールキック`;
      default: return `${name} - ${ev.event_type}`;
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}><div className={styles.spinner} /></div>
      </div>
    );
  }

  if (errorMsg || !match) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ paddingTop: '2rem' }}>
          <p>{errorMsg || 'Match not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>MATCH DETAIL</h1>
        <div style={{ color: 'var(--color-primary-400)', fontWeight: 600, marginBottom: '1rem', letterSpacing: '0.1em', position: 'relative', zIndex: 1 }}>{match.competition_name || '練習試合'}</div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-light-100)' }}>FUMINTUS</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary-400)' }}>VS</div>
          <div style={{ flex: 1, textAlign: 'left', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-light-100)' }}>{match.opponent_name}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0.5rem auto 0' }}>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-light-100)' }}>{match.our_score}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-dark-500)' }}>-</div>
          <div style={{ flex: 1, textAlign: 'left', fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-light-100)' }}>{match.opponent_score}</div>
        </div>
      </div>

      <div className="container">
        <Link href="/matches" className={styles.backLink}>← 試合一覧に戻る</Link>

        {match.video_url && getYouTubeId(match.video_url) && (
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', backgroundColor: '#000', paddingBottom: '56.25%', position: 'relative' }}>
            <iframe 
              src={`https://www.youtube.com/embed/${getYouTubeId(match.video_url)}`} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className={styles.sliderContainer}>
          <div className={styles.sliderLabel}>⏱️ {Math.floor(minute / 60)}分{(minute % 60).toString().padStart(2, '0')}秒</div>
          <input 
            type="range" 
            min="0" 
            max={match.duration_seconds || 2400} 
            value={minute} 
            onChange={e => handleSliderChange(parseInt(e.target.value, 10))} 
            className={styles.slider} 
          />
          <div className={styles.playbackControls}>
            <button className={styles.playBtn} onClick={togglePlay}>
              {isPlaying ? '⏸ 停止' : '▶ ハイライト再生'}
            </button>
          </div>
        </div>

        <div className={styles.contentGrid}>
          {/* 左側: スタメン・ベンチ一覧 */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>チームスタッツ</h2>
              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ display: 'flex', marginBottom: '1.5rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1, padding: '0.5rem', background: 'var(--color-primary-400)', color: '#fff', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'RED' : 'FUMINTUS'}
                  </div>
                  <div style={{ flex: 1, padding: '0.5rem', background: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'BLUE' : (match?.opponent_name || 'OPPONENT')}
                  </div>
                </div>

                <StatBar 
                  label="ボール支配率 (時間)" 
                  leftVal={teamStats.red.possessionSeconds} 
                  rightVal={teamStats.blue.possessionSeconds} 
                  leftStr={teamStats.red.possessionSeconds + teamStats.blue.possessionSeconds > 0 ? `${Math.round((teamStats.red.possessionSeconds / (teamStats.red.possessionSeconds + teamStats.blue.possessionSeconds)) * 100)}%` : '50%'}
                  rightStr={teamStats.red.possessionSeconds + teamStats.blue.possessionSeconds > 0 ? `${Math.round((teamStats.blue.possessionSeconds / (teamStats.red.possessionSeconds + teamStats.blue.possessionSeconds)) * 100)}%` : '50%'}
                />
                <StatBar 
                  label="シュート数 (枠内含む)" 
                  leftVal={teamStats.red.shots} 
                  rightVal={teamStats.blue.shots} 
                />
                <StatBar 
                  label="セーブ数" 
                  leftVal={teamStats.red.saves} 
                  rightVal={teamStats.blue.saves} 
                />
                <StatBar 
                  label="パス本数" 
                  leftVal={teamStats.red.passes} 
                  rightVal={teamStats.blue.passes} 
                />
                <StatBar 
                  label="パス成功率" 
                  leftVal={teamStats.red.passes > 0 ? teamStats.red.passes / (teamStats.red.passes + teamStats.red.lost) : 0} 
                  rightVal={teamStats.blue.passes > 0 ? teamStats.blue.passes / (teamStats.blue.passes + teamStats.blue.lost) : 0} 
                  leftStr={teamStats.red.passes + teamStats.red.lost > 0 ? `${Math.round((teamStats.red.passes / (teamStats.red.passes + teamStats.red.lost)) * 100)}%` : '0%'}
                  rightStr={teamStats.blue.passes + teamStats.blue.lost > 0 ? `${Math.round((teamStats.blue.passes / (teamStats.blue.passes + teamStats.blue.lost)) * 100)}%` : '0%'}
                />
                <StatBar 
                  label="コーナーキック" 
                  leftVal={teamStats.red.corners} 
                  rightVal={teamStats.blue.corners} 
                />
                <StatBar 
                  label="ファール" 
                  leftVal={teamStats.red.fouls} 
                  rightVal={teamStats.blue.fouls} 
                />
              </div>
            </div>

            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>ピッチ上の選手 ({onPitch.length}名)</h2>
              <div className={styles.memberList}>
                {onPitch.length === 0 && <p style={{color: '#888'}}>なし</p>}
                {onPitch.map(p => (
                  <div key={p.user_id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {p.photo_url ? (
                        <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.memberImage} />
                      ) : (
                        <span className={styles.memberAvatarPlaceholder}>#{p.jersey_number}</span>
                      )}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{p.name} {p.sensor_id && <span style={{fontSize:'0.7rem', background:'#444', padding:'2px 4px', borderRadius:'4px', marginLeft:'5px'}}>{p.sensor_id}</span>}</div>
                      <div className={styles.memberPosition}>{p.position || '未設定'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>ベンチ ({bench.length}名)</h2>
              <div className={styles.memberList}>
                {bench.length === 0 && <p style={{color: '#888'}}>なし</p>}
                {bench.map(p => (
                  <div key={p.user_id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {p.photo_url ? (
                        <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.memberImage} />
                      ) : (
                        <span className={styles.memberAvatarPlaceholder}>#{p.jersey_number}</span>
                      )}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{p.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 中央: フォーメーション図 */}
          <div className={styles.middleColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>フォーメーション</h2>
              <div className={styles.pitchWrapper}>
                <div className={styles.pitchContainer}>
                  <div className={styles.pitchLines} />
                  <div className={styles.pitchPenaltyAreaTop} />
                  <div className={styles.pitchPenaltyAreaBottom} />
                  
                  {/* ⚽ アニメーション用ボール */}
                  <div 
                    className={styles.ball} 
                    style={{ top: ballState.top, left: ballState.left, opacity: ballState.opacity }}
                  >
                    ⚽
                  </div>

                  {onPitch.map(p => {
                    const posKey = p.position;
                    const pos = POSITIONS[posKey] || POSITIONS['default'];
                    return (
                      <div 
                        key={p.user_id} 
                        className={styles.playerDot}
                        style={{ top: pos.top, left: pos.left }}
                      >
                        <div className={styles.playerDotAvatar}>
                          {p.photo_url ? (
                            <img src={getImageUrl(p.photo_url)} alt={p.name} className={styles.playerDotImg} />
                          ) : (
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{p.jersey_number}</span>
                          )}
                        </div>
                        <div className={styles.playerDotLabel}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>

                {/* ✨ アニメーション用エフェクト (pitchContainerの外に出すことでクリップされないようにする) */}
                {effect && effect.type === 'badge' && (
                  <div 
                    key={effect.key}
                    className={styles.effectBadge}
                    style={{ top: effect.top, left: effect.left }}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'goal' && (
                  <div 
                    key={effect.key}
                    className={styles.goalText}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'miss' && (
                  <div 
                    key={effect.key}
                    className={styles.missText}
                  >
                    {effect.emoji}
                  </div>
                )}
                {effect && effect.type === 'hattrick' && (
                  <div 
                    key={effect.key}
                    className={styles.hattrickText}
                  >
                    {effect.emoji}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側: イベントログ (実況) */}
          <div className={styles.rightColumn}>
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>タイムライン ({Math.floor(minute / 60)}分{(minute % 60).toString().padStart(2, '0')}秒時点)</h2>
              <div className={styles.eventLogList} style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pastEvents.length === 0 && <p style={{color: '#888'}}>まだイベントはありません</p>}
                {pastEvents.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'var(--color-dark-900)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-dark-700)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-400)', minWidth: '55px' }}>{Math.floor(ev.minute / 60)}'{String(ev.minute % 60).padStart(2, '0')}"</span>
                    <span style={{ color: 'var(--color-light-100)', flex: 1, lineHeight: 1.4 }}>{getEventText(ev)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sectionBox} style={{ marginTop: '2rem' }}>
          <h2 className={styles.sectionTitle}>個人成績 (イベント集計)</h2>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#eee', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', color: '#aaa', backgroundColor: '#111' }}>
                  <th style={{ padding: '12px 8px' }}>選手</th>
                  <th style={{ padding: '12px 8px' }}>G</th>
                  <th style={{ padding: '12px 8px' }}>A</th>
                  <th style={{ padding: '12px 8px' }}>パス</th>
                  <th style={{ padding: '12px 8px' }}>シュート</th>
                  <th style={{ padding: '12px 8px' }}>ブロック</th>
                  <th style={{ padding: '12px 8px' }}>奪取・カット</th>
                  <th style={{ padding: '12px 8px' }}>セーブ</th>
                  <th style={{ padding: '12px 8px' }}>キープ(秒)</th>
                  <th style={{ padding: '12px 8px' }}>評価</th>
                </tr>
              </thead>
              <tbody>
                {match?.stats?.map(s => {
                  const pEvents = match.events ? match.events.filter(e => e.user_id === s.user_id || e.user_id === String(s.user_id)) : [];
                  
                  const goals = s.goals > 0 ? s.goals : pEvents.filter(e => e.event_type === 'goal').length;
                  let autoAssists = 0;
                  if (match.events) {
                    match.events.forEach((ev, i) => {
                      if (ev.event_type === 'goal') {
                        for (let j = i - 1; j >= 0; j--) {
                          const prevEv = match.events[j];
                          if (['steal', 'opponent_pass', 'intercept', 'clear', 'opponent_block', 'lost_ball', 'pass_miss', 'trap_miss'].includes(prevEv.event_type)) break;
                          if (prevEv.team === 'opponent') break;
                          if ((prevEv.event_type === 'pass' || prevEv.event_type === 'kickoff') && (String(prevEv.target_user_id) === String(ev.user_id))) {
                            if (String(prevEv.user_id) === String(s.user_id)) {
                              autoAssists++;
                            }
                            break;
                          }
                        }
                      }
                    });
                  }
                  const assists = s.assists > 0 ? s.assists : autoAssists;
                  
                  const passes = pEvents.filter(e => e.event_type === 'pass' || e.event_type === 'side_out' || e.event_type === 'corner_kick' || e.event_type === 'goal_kick').length;
                  const shots = pEvents.filter(e => e.event_type === 'shot' || e.event_type === 'shot_off' || e.event_type === 'goal').length;
                  const blocks = pEvents.filter(e => e.event_type === 'block').length;
                  const steals = pEvents.filter(e => e.event_type === 'steal' || e.event_type === 'pass_cut').length;
                  const saves = s.saves > 0 ? s.saves : pEvents.filter(e => e.event_type === 'save' || e.event_type === 'catch').length;
                  
                  const lostBalls = pEvents.filter(e => e.event_type === 'lost_ball').length;
                  const shotsOff = pEvents.filter(e => e.event_type === 'shot_off').length;
                  const keepTime = teamStats.playerPossession ? (teamStats.playerPossession[s.user_id] || teamStats.playerPossession[String(s.user_id)] || 0) : 0;
                  const rating = (6.0 + (goals * 1.0) + (assists * 0.5) + (passes * 0.1) + (shots * 0.1) + (blocks * 0.2) + (steals * 0.2) + (saves * 0.3) - (lostBalls * 0.2) - (shotsOff * 0.1)).toFixed(1);

                  return (
                    <tr key={s.user_id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{s.user_name || s.name || '不明'}</td>
                      <td style={{ padding: '12px 8px', fontWeight: goals > 0 ? 'bold' : 'normal', color: goals > 0 ? 'var(--color-primary-400)' : '#aaa' }}>{goals}</td>
                      <td style={{ padding: '12px 8px', color: assists > 0 ? '#fff' : '#aaa' }}>{assists}</td>
                      <td style={{ padding: '12px 8px', color: passes > 0 ? '#fff' : '#aaa' }}>{passes}</td>
                      <td style={{ padding: '12px 8px', color: shots > 0 ? '#fff' : '#aaa' }}>{shots}</td>
                      <td style={{ padding: '12px 8px', color: blocks > 0 ? '#fff' : '#aaa' }}>{blocks}</td>
                      <td style={{ padding: '12px 8px', color: steals > 0 ? '#fff' : '#aaa' }}>{steals}</td>
                      <td style={{ padding: '12px 8px', color: saves > 0 ? '#fff' : '#aaa' }}>{saves}</td>
                      <td style={{ padding: '12px 8px', color: keepTime > 0 ? '#fff' : '#aaa' }}>{keepTime}s</td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: rating >= 7.0 ? 'var(--color-gold)' : '#fff' }}>{rating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
