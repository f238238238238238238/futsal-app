const fs = require('fs');
const file = 'frontend/src/app/admin/video-analysis/page.js';
let content = fs.readFileSync(file, 'utf8');

// 0. Add goal_kick to possessor
content = content.replace(
  /case 'side_out':\s*case 'corner_kick':/g,
  "case 'side_out':\n        case 'corner_kick':\n        case 'goal_kick':"
);
content = content.replace(
  /possessor = ev\.team === 'opponent' \? 'opponent' : null;/g,
  "possessor = ev.team === 'opponent' ? 'opponent' : (ev.user_id || null);"
);

// 1. Own Pass Miss (step 7 -> step 8)
content = content.replace(
  /onClick=\{\(\) => finish\(\[\{ event_type: 'pass_miss', user_id: data.passer \}, \{ event_type: data.out_type, team: 'own' \}\]\)\}>自チームのボール<\/button>/g,
  "onClick={() => nextStep(8)}>自チームのボール</button>"
);
content = content.replace(
  /if \(step === 7\) return \([\s\S]*?相手チームのボール<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 8) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'pass_miss', user_id: data.passer }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// 2. Opponent Pass Defense Clear (step 26 -> step 29)
content = content.replace(
  /onClick=\{\(\) => finish\(\[\{ event_type: 'clear', user_id: data.clearer \}, \{ event_type: data.out_type, team: 'own' \}\]\)\}>自チームのボール<\/button>/g,
  "onClick={() => nextStep(29)}>自チームのボール</button>"
);
content = content.replace(
  /if \(step === 26\) return \([\s\S]*?相手チームのボール<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 29) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'clear', user_id: data.clearer }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// 3. Opponent Pass Fail (step 21)
content = content.replace(
  /<button data-key="4" className=\{styles.saveBtn\} onClick=\{\(\) => finish\(\[\{ event_type: 'opponent_pass_fail' \}, \{ event_type: 'side_out', team: 'own' \}\]\)\}>サイドアウト \[4\]<\/button>/g,
  `<button data-key="4" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'side_out' }); nextStep(27); }}>サイドアウト [4]</button>`
);
content = content.replace(
  /<button data-key="5" className=\{styles.saveBtn\} onClick=\{\(\) => finish\(\[\{ event_type: 'opponent_pass_fail' \}, \{ event_type: 'goal_kick', team: 'own' \}\]\)\}>ゴールキック \[5\]<\/button>/g,
  `<button data-key="5" className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(27); }}>ゴールキック [5]</button>`
);
content = content.replace(
  /if \(step === 26\)([\s\S]*?相手チームのボール<\/button>\s*<\/div>\s*<\/>\s*\);)/g,
  `$1
      if (step === 27) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'opponent_pass_fail' }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// 4. Steal (step 3 -> step 4)
content = content.replace(
  /onClick=\{\(\) => finish\(\[\{ event_type: 'defense', user_id: data.actor \}, \{ event_type: 'side_out', team: 'own' \}\]\)\}>自チームのボール \[1\]<\/button>/g,
  "onClick={() => { updateData({ out_type: 'side_out' }); nextStep(4); }}>自チームのボール [1]</button>"
);
content = content.replace(
  /if \(step === 3\) return \([\s\S]*?相手チームのボール \[2\]<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 4) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: 'defense', user_id: data.actor }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// 5. Ball Out generic (step 2 -> step 3)
content = content.replace(
  /onClick=\{\(\) => finish\(\{ event_type: data.out_type, team: 'own' \}\)\}>自チームのボール \[1\]<\/button>/g,
  "onClick={() => nextStep(3)}>自チームのボール [1]</button>"
);
content = content.replace(
  /if \(step === 2\) return \([\s\S]*?相手チームのボール \[2\]<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 3) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish({ event_type: data.out_type, team: 'own', user_id: id })} /></>;`
);

// 6. Shot Own (step 16 -> step 17)
content = content.replace(
  /onClick=\{\(\) => finish\(\[\{ event_type: data.res === 'block' \? 'shot_off' : 'shot', user_id: data.shooter \}, \{ event_type: data.out_type, team: 'own' \}\]\)\}>自チームのボール \[1\]<\/button>/g,
  "onClick={() => nextStep(17)}>自チームのボール [1]</button>"
);
content = content.replace(
  /if \(step === 16\) return \([\s\S]*?相手チームのボール \[2\]<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 17) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: data.res === 'block' ? 'shot_off' : 'shot', user_id: data.shooter }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// 7. Shot Opponent (step 24 -> step 27)
content = content.replace(
  /onClick=\{\(\) => finish\(\[\{ event_type: data.res === 'block' \? 'block' : 'save', user_id: data.res === 'block' \? data.blocker : gkId \}, \{ event_type: data.out_type, team: 'own' \}\]\)\}>自チームのボール<\/button>/g,
  "onClick={() => nextStep(27)}>自チームのボール</button>"
);
content = content.replace(
  /if \(step === 24\) return \([\s\S]*?相手チームのボール<\/button>\s*<\/div>\s*<\/>\s*\);/g,
  `$&
      if (step === 27) return <><Title text="誰が蹴る？" /><PlayerGrid onSelect={(id) => finish([{ event_type: data.res === 'block' ? 'block' : 'save', user_id: data.res === 'block' ? data.blocker : gkId }, { event_type: data.out_type, team: 'own', user_id: id }])} /></>;`
);

// Fix missed corner/goal kick separation in step 21 of Shot
content = content.replace(
  /<button className=\{styles.saveBtn\} onClick=\{\(\) => \{ updateData\(\{ out_type: 'corner_kick' \}\); nextStep\(24\); \}\}>コーナー\/ゴールキックになった<\/button>/g,
  `<button className={styles.saveBtn} onClick={() => { updateData({ out_type: 'corner_kick' }); nextStep(24); }}>コーナーキックになった</button>
            <button className={styles.saveBtn} onClick={() => { updateData({ out_type: 'goal_kick' }); nextStep(24); }}>ゴールキックになった</button>`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
