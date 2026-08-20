import { NextResponse } from 'next/server';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const workspaceDir = path.join(process.cwd(), 'workspaces', sessionId);

  if (!fs.existsSync(workspaceDir)) {
    return NextResponse.json({ error: 'Workspace not found for this session. The agent has not created any files yet.' }, { status: 404 });
  }

  // Set up the response stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  archive.on('error', (err) => {
    throw err;
  });

  // Pipe the archive data to our writable stream
  archive.on('data', (chunk) => writer.write(chunk));
  archive.on('end', () => writer.close());

  // Add the workspace directory contents to the archive
  archive.directory(workspaceDir, false);

  // Finalize the archive (this will trigger the end event when done)
  archive.finalize();

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="workspace-${sessionId}.zip"`,
    },
  });
}
