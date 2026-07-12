const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/live.module.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '.actionZoneMissROpponent:active { background: rgba(231, 76, 60, 0.6); }.pitchSlotAvatar {',
  '.actionZoneMissROpponent:active { background: rgba(231, 76, 60, 0.6); }\n\n/* Team Colors for Intra Match */\n[class*=\"posred_\"] .pitchSlotAvatar { border-color: #e74c3c; box-shadow: 0 0 10px rgba(231, 76, 60, 0.5); }\n[class*=\"posblue_\"] .pitchSlotAvatar { border-color: #3498db; box-shadow: 0 0 10px rgba(52, 152, 219, 0.5); }\n\n.pitchSlotAvatar_DUMMY_REMOVE {'
);

fs.writeFileSync(file, content);
console.log('Fixed CSS and added team colors');
