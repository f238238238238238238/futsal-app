const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/page.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const POSITIONS_EXTERNAL = ['Pivo', 'Ala L', 'Ala R', 'Fixo', 'GK'];",
  "const POSITIONS_EXTERNAL = ['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK'];"
);

fs.writeFileSync(file, content);
console.log('Fixed POSITIONS_EXTERNAL');
