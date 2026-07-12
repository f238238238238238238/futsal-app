const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/page.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add playerTeams state
content = content.replace(
  'const [attendingIds, setAttendingIds] = useState([]);',
  'const [attendingIds, setAttendingIds] = useState([]);\n  const [playerTeams, setPlayerTeams] = useState({});'
);

// 2. toggleAttendee -> assignTeam
content = content.replace(
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
  };,
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

  const assignTeam = (id, team) => {
    setPlayerTeams(prev => {
      const next = { ...prev };
      if (!team) delete next[id];
      else next[id] = team;
      return next;
    });
    
    if (team) {
      if (!attendingIds.includes(id)) {
        setAttendingIds(prev => [...prev, id]);
        setBenchIds(prev => [...prev, id]);
      }
    } else {
      setAttendingIds(prev => prev.filter(x => x !== id));
      setCourtIds(prev => prev.filter(x => x !== id));
      setBenchIds(prev => prev.filter(x => x !== id));
      setStarterPositions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };
);

// 3. Add handlePlayerTap correction
content = content.replace(
          setStarterPositions(prev => ({ ...prev, [id]: setupSelectedPos }));
        setSetupSelectedPos(null);
      }
    } else if (phase === 'playing') {,
          setStarterPositions(prev => ({ ...prev, [id]: setupSelectedPos }));
        setSetupSelectedPos(null);
      } else if (origin === 'pitch') {
        // Remove from pitch, back to bench
        setCourtIds(prev => prev.filter(x => x !== id));
        setBenchIds(prev => [...prev, id]);
        setStarterPositions(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } else if (phase === 'playing') {
);

// 4. Update team changes on Drop in intra match
content = content.replace(
            setStarterPositions(prev => {
            const next = { ...prev };
            delete next[targetId];
            next[sourceId] = targetPos;
            return next;
          });
        } else {,
            setStarterPositions(prev => {
            const next = { ...prev };
            delete next[targetId];
            next[sourceId] = targetPos;
            return next;
          });
          if (matchMode === 'intra') {
             const newTeam = targetPos.startsWith('red_') ? 'red' : 'blue';
             setPlayerTeams(prev => ({ ...prev, [sourceId]: newTeam }));
          }
        } else {
);

content = content.replace(
            setStarterPositions(prev => {
            const next = { ...prev };
            delete next[sourceId];
            return next;
          });
        } else {,
            setStarterPositions(prev => {
            const next = { ...prev };
            delete next[sourceId];
            return next;
          });
          if (matchMode === 'intra') {
            const oldTeam = starterPositions[sourceId]?.startsWith('red_') ? 'red' : 'blue';
            setPlayerTeams(prev => ({ ...prev, [sourceId]: oldTeam }));
          }
        } else {
);

content = content.replace(
            setStarterPositions(prev => {
            const next = { ...prev };
            next[sourceId] = pos2;
            next[targetId] = pos1;
            return next;
          });
        } else if (!targetId) {,
            setStarterPositions(prev => {
            const next = { ...prev };
            next[sourceId] = pos2;
            next[targetId] = pos1;
            return next;
          });
          if (matchMode === 'intra') {
             const team1 = pos2.startsWith('red_') ? 'red' : 'blue';
             const team2 = pos1.startsWith('red_') ? 'red' : 'blue';
             setPlayerTeams(prev => ({ ...prev, [sourceId]: team1, [targetId]: team2 }));
          }
        } else if (!targetId) {
);

// 5. Add renderListSlot
content = content.replace(
    const renderPitchSlot = (pos, isSetup) => {,
    const renderListSlot = (pos) => {
    const playerIdStr = Object.keys(starterPositions).find(id => starterPositions[id] === pos);
    const playerId = playerIdStr ? Number(playerIdStr) : null;
    const player = players.find(p => p.user_id === playerId);
    
    const isSelected = setupSelectedPos === pos;
    
    return (
      <div 
        key={pos} 
        className={\\ \\}
        onClick={!player ? () => handleEmptySlotTap(pos) : () => handlePlayerTap(playerId, 'pitch')}
      >
        <div className={styles.listSlotPos}>{pos.replace('red_','').replace('blue_','')}</div>
        {player ? (
          <>
            <img src={player.photo_url ? getImageUrl(player.photo_url) : '/default-avatar.png'} className={styles.listSlotAvatar} alt={player.name} />
            <div className={styles.listSlotName}>{player.name}</div>
            <div className={styles.listSlotRemove} onClick={(e) => { e.stopPropagation(); handlePlayerTap(playerId, 'pitch'); }}>✕</div>
          </>
        ) : (
          <div className={styles.listSlotEmpty}>選択</div>
        )}
      </div>
    );
  };

  const renderPitchSlot = (pos, isSetup) => {
);

fs.writeFileSync(file, content);
console.log('Script completed successfully!');
