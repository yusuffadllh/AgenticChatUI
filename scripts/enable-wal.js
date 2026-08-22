// One-off: switch dev.db into WAL journaling mode (persisted in the file) so
// concurrent agent writes stop hitting "database is locked" / "readonly
// database". Safe to run repeatedly; does not touch any data.
const path = require('node:path');
const Database = require('better-sqlite3');

const envUrl = process.env.DATABASE_URL;
let dbPath;
if (envUrl && envUrl.startsWith('file:')) {
  const p = envUrl.slice('file:'.length);
  dbPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
} else {
  dbPath = path.join(process.cwd(), 'dev.db');
}

const db = new Database(dbPath);
const mode = db.pragma('journal_mode = WAL', { simple: true });
db.pragma('busy_timeout = 15000');
const busy = db.pragma('busy_timeout', { simple: true });
db.close();

console.log(`dev.db: ${dbPath}`);
console.log(`journal_mode = ${mode}`);
console.log(`busy_timeout = ${busy}`);
if (String(mode).toLowerCase() !== 'wal') {
  console.error('WARNING: journal_mode is not WAL — check file permissions/locks.');
  process.exit(1);
}
