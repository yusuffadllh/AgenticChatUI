import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Test connectivity to the gateway with the given (or saved) baseUrl + apiKey +
// model. Sends a tiny chat completion and reports latency / model echo.
export async function POST(request) {
  const started = Date.now();
  try {
    let body = {};
    try { body = await request.json(); } catch { body = {}; }

    // Fall back to saved settings for any field the caller didn't send.
    const saved = await prisma.settings.findUnique({ where: { id: 1 } });
    const baseUrl = (body.baseUrl ?? saved?.baseUrl ?? '').trim();
    const apiKey = (body.apiKey ?? saved?.apiKey ?? '').trim();
    const modelName = (body.modelName ?? saved?.modelName ?? '').trim();

    if (!baseUrl) return NextResponse.json({ ok: false, error: 'Base URL kosong' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ ok: false, error: 'API Key kosong' }, { status: 400 });
    if (!modelName) return NextResponse.json({ ok: false, error: 'Model belum diisi' }, { status: 400 });

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    // Abort if the gateway hangs.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError' ? 'Timeout (gateway tidak merespon dalam 20s)' : `Gagal konek: ${e.message}`;
      return NextResponse.json({ ok: false, error: msg, latencyMs: Date.now() - started }, { status: 502 });
    }
    clearTimeout(timer);

    const latencyMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      let detail = text.slice(0, 300);
      try { const j = JSON.parse(text); detail = j.error?.message || j.error || detail; } catch {}
      return NextResponse.json({ ok: false, status: res.status, error: `Gateway menolak (${res.status}): ${detail}`, latencyMs }, { status: 200 });
    }

    // Try to read the echoed model + a snippet of the reply.
    let model = modelName;
    let reply = '';
    try {
      const j = JSON.parse(text.slice(0, text.lastIndexOf('}') + 1) || text);
      model = j.model || model;
      reply = j.choices?.[0]?.message?.content || '';
    } catch {}

    return NextResponse.json({ ok: true, model, latencyMs, reply: String(reply).slice(0, 80) });
  } catch (error) {
    console.error('Ping error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error', latencyMs: Date.now() - started }, { status: 500 });
  }
}
