const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/page.js';
let content = fs.readFileSync(file, 'utf8');

const target = \      if (selectedCourtId === id) {
        setSelectedCourtId(null); 
        setSelectionTime(null);
      } else if (selectedCourtId) {
        recordEvent('pass', selectedCourtId);
        setLastPasserId(selectedCourtId);
        setSelectedCourtId(id);
        setSelectionTime(Date.now());
      } else {
        const pos = starterPositions[id] || '';
        if (pos.includes('GK')) recordEvent('catch', id);
        else recordEvent('steal', id);
        setSelectedCourtId(id);
        setLastPasserId(null);
        setSelectionTime(Date.now());
      }\;

const replacement = \      const isEnemyDummy = typeof id === 'string' && id.startsWith('dummy_');
      const isOpponent = isEnemyDummy || (matchMode === 'intra' && playerTeams[selectedCourtId] !== undefined && playerTeams[id] !== undefined && playerTeams[selectedCourtId] !== playerTeams[id]);

      if (selectedCourtId === id) {
        setSelectedCourtId(null); 
        setSelectionTime(null);
      } else if (selectedCourtId) {
        if (isOpponent) {
          recordEvent('lost_ball', selectedCourtId);
          if (matchMode === 'intra') {
            const pos = starterPositions[id] || '';
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
        if (isEnemyDummy) return;
        const pos = starterPositions[id] || '';
        if (pos.includes('GK')) recordEvent('catch', id);
        else recordEvent('steal', id);
        setSelectedCourtId(id);
        setLastPasserId(null);
        setSelectionTime(Date.now());
      }\;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('Fixed handlePlayerTap');
