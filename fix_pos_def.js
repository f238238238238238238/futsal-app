const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/page.js';
let content = fs.readFileSync(file, 'utf8');

const target = \  const positions = matchMode === 'intra' ? \n    [\\\$\\{matchInfo.team1_name || 'RED'\\}_Pivo\, \\\$\\{matchInfo.team1_name || 'RED'\\}_AlaL\, \\\$\\{matchInfo.team1_name || 'RED'\\}_AlaR\, \\\$\\{matchInfo.team1_name || 'RED'\\}_Fixo\, \\\$\\{matchInfo.team1_name || 'RED'\\}_GK\, \n     \\\$\\{matchInfo.team2_name || 'BLUE'\\}_Pivo\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_AlaL\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_AlaR\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_Fixo\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_GK\] \n    : POSITIONS_EXTERNAL;\;

const replacement = \  const setupPositions = matchMode === 'intra' ? \n    [\\\$\\{matchInfo.team1_name || 'RED'\\}_Pivo\, \\\$\\{matchInfo.team1_name || 'RED'\\}_AlaL\, \\\$\\{matchInfo.team1_name || 'RED'\\}_AlaR\, \\\$\\{matchInfo.team1_name || 'RED'\\}_Fixo\, \\\$\\{matchInfo.team1_name || 'RED'\\}_GK\, \n     \\\$\\{matchInfo.team2_name || 'BLUE'\\}_Pivo\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_AlaL\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_AlaR\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_Fixo\, \\\$\\{matchInfo.team2_name || 'BLUE'\\}_GK\] \n    : POSITIONS_EXTERNAL;\n\n  const positions = phase === 'setup' ? setupPositions : POSITIONS_INTRA;\;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('Fixed positions definition');
