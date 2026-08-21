import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// Stream a file from chat-workspaces/<sessionId> for download. Path-traversal
// safe: the resolved target must stay inside the session folder.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const relPath = searchParams.get('path');

  if (!sessionId || !relPath) {
    return NextResponse.json({ error: 'sessionId and path required' }, { status: 400 });
  }

  const base = path.join(process.cwd(), 'chat-workspaces', sessionId);
  const target = path.resolve(base, relPath);
  if (target !== base && !target.startsWith(base + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const buf = await fs.readFile(target);
    const name = path.basename(target);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
