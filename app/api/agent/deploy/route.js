import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { runOpencode } from '@/lib/opencode';
import { buildBudgetedPrompt } from '@/lib/context';

export const dynamic = 'force-dynamic';
// Deploy can take a while (install + build + upload); allow up to ~30 min.
export const maxDuration = 1800;

// Vercel project names: lowercase, alphanumeric + dashes, <=100 chars.
function slugifyProjectName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function POST(request) {
  try {
    const { sessionId, projectName: rawProjectName } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    const projectName = slugifyProjectName(rawProjectName);

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    if (!settings.vercelToken && !settings.netlifyToken) {
      return NextResponse.json(
        { error: 'No deploy credentials configured. Set a Vercel or Netlify token in Settings.' },
        { status: 400 },
      );
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build a deploy-only instruction listing only the platforms whose token
    // is configured. The tokens themselves are injected as env vars by
    // runOpencode, so the model never sees or prints them.
    const vercelNameFlag = projectName ? ` --name "${projectName}"` : '';
    const deployTargets = [];
    if (settings.vercelToken) {
      deployTargets.push(
        `- Vercel (env VERCEL_TOKEN is set): run \`npx --yes vercel deploy --prod --yes${vercelNameFlag} --token="$VERCEL_TOKEN"\` from the project root. Vercel auto-detects the framework.${projectName ? ` The site should be reachable at https://${projectName}.vercel.app once live.` : ''}`,
      );
    }
    if (settings.netlifyToken) {
      deployTargets.push(
        `- Netlify (env NETLIFY_AUTH_TOKEN is set): build first if needed, then run \`npx --yes netlify deploy --prod --dir=<build-output-dir> --auth "$NETLIFY_AUTH_TOKEN"\` (use the correct output dir: dist/build/out/ or . for static).${projectName ? ` If Netlify asks for a site name, use "${projectName}".` : ''}`,
      );
    }

    const prompt = buildBudgetedPrompt(
      [
        {
          text: `You are deploying an already-built project that lives in the current working directory. Your ONLY job is to publish it live and report the URL.`,
          priority: 10,
          truncatable: false,
        },
        {
          text: [
            `DEPLOY INSTRUCTIONS:`,
            `- Prefer Vercel for Next.js/frontend apps, Netlify for static sites. Pick ONE platform below and deploy.`,
            ...deployTargets,
            `- The credentials are already provided via environment variables. Do NOT ask for tokens or logins, and NEVER print token values.`,
            projectName
              ? `- The desired project/site name is "${projectName}". Try to make the deployed URL use it (e.g. Vercel: pass --name "${projectName}", or add a vercel.json with {"name":"${projectName}"}, or rename the deploy). If the platform ignores the name, that's OK — just report whatever final URL it gives.`
              : `- Let the platform pick the project name automatically.`,
            `- Install dependencies and build only if the platform needs it. Keep every command small.`,
            `- If a deploy command fails, read the error and try the correct fix once; do not loop forever.`,
            `- At the very end, print the final live URL on its own line prefixed with "LIVE URL: ".`,
            `- Do NOT explore hidden/system folders. Work only in the current directory.`,
          ].join('\n'),
          priority: 9,
          truncatable: false,
        },
        { text: `Project goal (for context): ${session.goal}`, priority: 3, truncatable: true },
      ],
      120000,
    );

    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream({
      async start(controller) {
        const pingInterval = setInterval(() => {
          try { controller.enqueue(encoder.encode(`:\n\n`)); } catch {}
        }, 15000);

        const sendEvent = (type, payload) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`));
          } catch {}
        };

        const finish = () => {
          clearInterval(pingInterval);
          try { controller.close(); } catch {}
        };

        try {
          const workspaceDir = path.join(process.cwd(), 'workspaces', sessionId);
          await fs.mkdir(workspaceDir, { recursive: true });

          sendEvent('log', { message: `🚀 Memulai deploy untuk project ini...` });
          sendEvent('log', { message: `📁 Workspace: workspaces/${sessionId}` });

          const capturedLines = [];
          let exitCode = 0;

          try {
            exitCode = await runOpencode({
              prompt,
              cwd: workspaceDir,
              settings,
              signal,
              onOutput: (line) => {
                capturedLines.push(line);
                if (capturedLines.length <= 2000) {
                  sendEvent('log', { message: line });
                }
              },
            });
          } catch (runErr) {
            sendEvent('log', { message: `❌ Gagal menjalankan deploy: ${runErr.message}` });
            sendEvent('error', { error: 'Deploy failed', details: runErr.message });
            finish();
            return;
          }

          if (signal && signal.aborted) {
            sendEvent('log', { message: '⛔ Deploy dibatalkan oleh user.' });
            sendEvent('done', {});
            finish();
            return;
          }

          const rawOutput = capturedLines.join('\n');
          const truncated = rawOutput.length > 20000
            ? rawOutput.slice(-20000) + '\n... (log dipotong)'
            : rawOutput;

          // Try to surface the live URL from the output.
          const urlMatch = rawOutput.match(/LIVE URL:\s*(\S+)/i)
            || rawOutput.match(/https?:\/\/[^\s"']+\.(?:vercel\.app|netlify\.app)[^\s"']*/i);
          const liveUrl = urlMatch ? (urlMatch[1] || urlMatch[0]) : null;

          const header = exitCode === 0
            ? `✅ Deploy selesai (exit ${exitCode}).`
            : `⚠️ Deploy selesai dengan exit code ${exitCode}.`;

          const urlLine = liveUrl ? `\n\n🌐 **Live URL:** ${liveUrl}` : '';
          const formattedOutput = `${header}${urlLine}\n\n**Deploy Output:**\n\`\`\`text\n${truncated || '(tidak ada output)'}\n\`\`\``;

          try {
            await prisma.message.create({
              data: {
                sessionId,
                role: 'executor',
                content: `**[Deploy]**\n\n${formattedOutput}`,
              },
            });
          } catch {}

          if (liveUrl) sendEvent('log', { message: `🌐 Live URL: ${liveUrl}` });
          sendEvent('log', { message: '🏁 Deploy selesai.' });
          sendEvent('done', { liveUrl });
          finish();
        } catch (error) {
          sendEvent('error', { error: 'Internal server error', details: error.message });
          finish();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Deploy API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
