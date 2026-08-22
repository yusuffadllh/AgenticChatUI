import path from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = global;

// Resolve the SQLite file. Prefer an explicit absolute DATABASE_URL (set this in
// the server's .env, e.g. DATABASE_URL="file:/home/cupserver/AgenticChatUI/dev.db")
// so Prisma never depends on the PM2 process CWD, which may point at a
// different (often read-only) directory and cause "readonly database" errors.
function resolveDbUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('file:')) {
    const p = envUrl.slice('file:'.length);
    if (path.isAbsolute(p)) return `file:${p}`;
  }
  return `file:${path.join(process.cwd(), 'dev.db')}`;
}

// timeout = SQLite busy_timeout (ms): when the DB is briefly locked by another
// concurrent write, wait/retry instead of throwing "database is locked" or
// "readonly database". Agent tasks fire many writes, so this matters. WAL mode
// itself is persisted in the DB file and enabled once via `npm run db:wal`.
const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl(), timeout: 15000 });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
