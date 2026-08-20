import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDb, getDb, closeDb } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backup() {
  console.log('Connecting to database...');
  initializeDb();
  await new Promise(r => setTimeout(r, 1000));
  const db = getDb();

  const tablesRes = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );

  const dump = {
    created_at: new Date().toISOString(),
    tables: {}
  };

  for (const { table_name } of tablesRes.rows) {
    const res = await db.query(`SELECT * FROM "${table_name}"`);
    dump.tables[table_name] = res.rows;
    console.log(`  ${table_name}: ${res.rows.length} rows`);
  }

  const backupDir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = path.join(backupDir, `backup-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf8');

  console.log(`\nBackup saved: ${filePath}`);
  await closeDb();
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
