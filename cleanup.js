const { PrismaBetterSqlite3 } = require('@prisma/client');
const p = new PrismaBetterSqlite3();

async function clean() {
  await p.$queryRawUnsafe('DELETE FROM Task WHERE sessionId NOT IN (SELECT id FROM Session)');
  await p.$queryRawUnsafe('DELETE FROM Message WHERE sessionId NOT IN (SELECT id FROM Session)');
  console.log('Cleaned orphan records');
  await p.$disconnect();
}

clean().catch(e => { console.error(e.message); process.exit(1); });
