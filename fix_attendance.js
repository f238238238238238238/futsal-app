const fs = require('fs');
let file = 'frontend/src/app/liff/attendance/page.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  \        data.forEach(cup => {\n          initialAtt[cup.dateText] = {\n            dateStr: cup.isoDate,\n            shortTitle: cup.title.substring(0, 40),\n            timeStr: cup.dateText.match(/(\\\d{1,2}:\\\d{2}.*\\\d{1,2}:\\\d{2})/) ? cup.dateText.match(/(\\\d{1,2}:\\\d{2}.*\\\d{1,2}:\\\d{2})/)[1] : '',\n            status: 'pending' // Default\n          };\n        });\,
  \        data.forEach(cup => {\n          const key = cup.isoDate + '|' + cup.title;\n          initialAtt[key] = {\n            dateStr: cup.isoDate,\n            shortTitle: cup.title.substring(0, 40),\n            timeStr: cup.dateText.match(/(\\\d{1,2}:\\\d{2}.*\\\d{1,2}:\\\d{2})/) ? cup.dateText.match(/(\\\d{1,2}:\\\d{2}.*\\\d{1,2}:\\\d{2})/)[1] : '',\n            status: 'pending' // Default\n          };\n        });\
);

content = content.replace(
  \  const handleStatusChange = (dateText, status) => {\n    setAttendances(prev => ({\n      ...prev,\n      [dateText]: {\n        ...prev[dateText],\n        status\n      }\n    }));\n  };\,
  \  const handleStatusChange = (key, status) => {\n    setAttendances(prev => ({\n      ...prev,\n      [key]: {\n        ...prev[key],\n        status\n      }\n    }));\n  };\
);

content = content.replace(
  \            const currentStatus = attendances[cup.isoDate]?.status || 'pending';\,
  \            const key = cup.isoDate + '|' + cup.title;\n            const currentStatus = attendances[key]?.status || 'pending';\
);

content = content.replace(
  \onClick={() => handleStatusChange(cup.isoDate, 'present')}\,
  \onClick={() => handleStatusChange(key, 'present')}\
);
content = content.replace(
  \onClick={() => handleStatusChange(cup.isoDate, 'absent')}\,
  \onClick={() => handleStatusChange(key, 'absent')}\
);
content = content.replace(
  \onClick={() => handleStatusChange(cup.isoDate, 'pending')}\,
  \onClick={() => handleStatusChange(key, 'pending')}\
);

// We also need to fix where currentStatus was used with cup.dateText
content = content.replace(
  \onClick={() => handleStatusChange(cup.dateText, 'present')}\,
  \onClick={() => handleStatusChange(key, 'present')}\
);
content = content.replace(
  \onClick={() => handleStatusChange(cup.dateText, 'absent')}\,
  \onClick={() => handleStatusChange(key, 'absent')}\
);
content = content.replace(
  \onClick={() => handleStatusChange(cup.dateText, 'pending')}\,
  \onClick={() => handleStatusChange(key, 'pending')}\
);

fs.writeFileSync(file, content);
console.log('Fixed attendance keys');
