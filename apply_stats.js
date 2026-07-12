const fs = require('fs');
let file = 'frontend/src/app/matches/[id]/page.js';
let content = fs.readFileSync(file, 'utf8');

const calcStatsStr = 
  const teamStats = useMemo(() => {
    let redStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0 };
    let blueStats = { passes: 0, lost: 0, goals: 0, shots: 0, saves: 0 };
    
    if (!match || !match.stats) return { red: redStats, blue: blueStats };

    let currentOnPitch = [];
    match.stats.forEach(st => {
      if (st.is_starter === 1 || st.is_starter === true) {
        currentOnPitch.push({ user_id: st.user_id, position: st.position || '' });
      }
    });

    for (const ev of sortedEvents) {
      if (ev.minute > minute) break;
      
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
         team = 'red'; // 'us'
      }

      if (team === 'red') {
        if (ev.event_type === 'pass') redStats.passes++;
        if (ev.event_type === 'lost_ball') redStats.lost++;
        if (ev.event_type === 'goal') redStats.goals++;
        if (ev.event_type === 'shot') redStats.shots++;
        if (ev.event_type === 'save') redStats.saves++;
      } else if (team === 'blue') {
        if (ev.event_type === 'pass') blueStats.passes++;
        if (ev.event_type === 'lost_ball') blueStats.lost++;
        if (ev.event_type === 'goal') blueStats.goals++;
        if (ev.event_type === 'shot') blueStats.shots++;
        if (ev.event_type === 'save') blueStats.saves++;
      }
    }
    
    return { red: redStats, blue: blueStats };
  }, [match, minute, sortedEvents]);

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
          <div style={{ width: \\%\, background: 'var(--color-primary-400)' }} />
          <div style={{ width: \\%\, background: '#fff' }} />
        </div>
      </div>
    );
  };
;

content = content.replace(
  'const pastEvents = useMemo(() => {',
  calcStatsStr + '\n  const pastEvents = useMemo(() => {'
);

const statRenderStr = 
            <div className={styles.sectionBox}>
              <h2 className={styles.sectionTitle}>チームスタッツ</h2>
              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ display: 'flex', marginBottom: '1.5rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1, padding: '0.5rem', background: 'var(--color-primary-400)', color: '#000', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'RED' : 'OUR TEAM'}
                  </div>
                  <div style={{ flex: 1, padding: '0.5rem', background: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center', borderRadius: '4px' }}>
                    {match?.match_mode === 'intra' ? 'BLUE' : (match?.opponent_name || 'OPPONENT')}
                  </div>
                </div>

                <StatBar 
                  label="ボール支配率" 
                  leftVal={teamStats.red.passes} 
                  rightVal={teamStats.blue.passes} 
                  leftStr={teamStats.red.passes + teamStats.blue.passes > 0 ? \\%\ : '50%'}
                  rightStr={teamStats.red.passes + teamStats.blue.passes > 0 ? \\%\ : '50%'}
                />
                <StatBar 
                  label="シュート数" 
                  leftVal={teamStats.red.goals + teamStats.red.shots} 
                  rightVal={teamStats.blue.goals + teamStats.blue.shots} 
                />
                <StatBar 
                  label="枠内シュート" 
                  leftVal={teamStats.red.goals + teamStats.red.saves} 
                  rightVal={teamStats.blue.goals + teamStats.blue.saves} 
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
                  leftStr={teamStats.red.passes + teamStats.red.lost > 0 ? \\%\ : '0%'}
                  rightStr={teamStats.blue.passes + teamStats.blue.lost > 0 ? \\%\ : '0%'}
                />
              </div>
            </div>

            <div className={styles.sectionBox}>
;

content = content.replace(
  '<div className={styles.sectionBox}>\n              <h2 className={styles.sectionTitle}>ピッチ上の選手',
  statRenderStr + '              <h2 className={styles.sectionTitle}>ピッチ上の選手'
);

fs.writeFileSync(file, content);
console.log('Added teamStats and StatBar');
