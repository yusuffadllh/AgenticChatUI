import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file

function sanitizeName(name) {
  const base = path.basename(name || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export async function POST(request) {
  try {
    const form = await request.formData();
    let sessionId = form.get('sessionId');
    const files = form.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Create an isolated chat session/workspace if none was provided yet.
    if (!sessionId) {
      const session = await prisma.session.create({ data: { goal: 'Chat session' } });
      sessionId = session.id;
    }

    const dir = path.join(process.cwd(), 'chat-workspaces', sessionId, 'uploads');
    await fs.mkdir(dir, { recursive: true });

    const saved = [];
    for (const file of files) {
      if (typeof file === 'string') continue;
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        return NextResponse.json({ error: `File "${file.name}" terlalu besar (maks 15 MB)` }, { status: 400 });
      }
      const safe = sanitizeName(file.name);
      const unique = `${crypto.randomBytes(4).toString('hex')}-${safe}`;
      await fs.writeFile(path.join(dir, unique), buf);

      const isImage = IMAGE_MIME.has(file.type);
      const attachment = {
        type: isImage ? 'image' : 'file',
        name: safe,
        path: `uploads/${unique}`,
        mime: file.type || 'application/octet-stream',
        size: buf.length,
      };
      // For images, also embed a data URL so the model can see it via vision
      // without needing a public URL. Text files carry their content preview.
      if (isImage) {
        attachment.dataUrl = `data:${attachment.mime};base64,${buf.toString('base64')}`;
      } else if (buf.slice(0, 8000).includes(0) === false) {
        attachment.textPreview = buf.slice(0, 200000).toString('utf8');
      }
      saved.push(attachment);
    }

    return NextResponse.json({ sessionId, attachments: saved });
  } catch (error) {
    console.error('Chat upload error:', error);
    return NextResponse.json({ error: 'Upload gagal' }, { status: 500 });
  }
}
