import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { runOpencode } from '@/lib/opencode';

export const dynamic = 'force-dynamic';
// Executor runs long-lived agent processes; allow up to ~30 min.
export const maxDuration = 1800;

export async function POST(request) {
  try {
    const { sessionId, taskId } = await request.json();
    if (!sessionId || !taskId) {
      return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json({ error: 'Task no longer exists' }, { status: 404 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tasks: { orderBy: { createdAt: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const currentTask = session.tasks.find(t => t.id === taskId);
    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found in session' }, { status: 404 });
    }

    // Build a compact prompt: overall goal + only the last 2 completed tasks
    // for continuity. Injecting every prior result bloats the prompt (and can
    // stall the gateway), so keep it short.
    const priorContext = session.tasks
      .filter((t) => t.id !== taskId && t.status === 'COMPLETED' && t.result)
      .slice(-2)
      .map((t, i) => `Previous task ${i + 1}: ${t.description}\nResult summary: ${(t.result || '').slice(0, 300)}`)
      .join('\n\n');

    const prompt = [
      `Overall goal: ${session.goal}`,
      priorContext ? `\nContext from earlier tasks:\n${priorContext}` : '',
      `\nYour current task: ${currentTask.description}`,
      `\nIMPORTANT RULES:`,
      `- You are running fully autonomously with NO human to answer questions. NEVER ask for confirmation or reply with a question like "Would you like me to...". Just DO the work.`,
      `- Actually create and modify real files and run the commands needed to COMPLETE this task now. Do not merely plan, describe, or propose.`,
      `- Work only inside the current directory.`,
      `- When the task is fully done, end with a short summary of the concrete files you created/changed.`,
    ]
      .filter(Boolean)
      .join('\n');

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
          await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'RUNNING' } });

          // Isolated workspace directory for this session.
          const workspaceDir = path.join(process.cwd(), 'workspaces', sessionId);
          await fs.mkdir(workspaceDir, { recursive: true });

          sendEvent('log', { message: `🚀 Menjalankan OpenCode untuk task: ${currentTask.description}` });
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
                // Cap forwarded log volume to keep the UI responsive.
                if (capturedLines.length <= 2000) {
                  sendEvent('log', { message: line });
                }
              },
            });
          } catch (runErr) {
            const hint = /ENOENT/.test(runErr.message)
              ? ' — Pastikan "opencode" terinstall & ada di PATH (set OPENCODE_BIN bila perlu).'
              : '';
            sendEvent('log', { message: `❌ Gagal menjalankan OpenCode: ${runErr.message}${hint}` });
            await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'PENDING' } });
            sendEvent('error', { error: 'OpenCode execution failed', details: runErr.message });
            finish();
            return;
          }

          if (signal && signal.aborted) {
            sendEvent('log', { message: '⛔ Eksekusi dibatalkan oleh user.' });
            await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'PENDING' } });
            sendEvent('done', { tasks: session.tasks });
            finish();
            return;
          }

          const rawOutput = capturedLines.join('\n');
          const truncated = rawOutput.length > 20000
            ? rawOutput.slice(-20000) + '\n... (log dipotong)'
            : rawOutput;

          const header = exitCode === 0
            ? `✅ OpenCode selesai (exit ${exitCode}).`
            : `⚠️ OpenCode selesai dengan exit code ${exitCode}.`;

          const formattedOutput = `${header}\n\n**OpenCode Output:**\n\`\`\`text\n${truncated || '(tidak ada output)'}\n\`\`\``;

          await prisma.task.updateMany({
            where: { id: taskId },
            data: { status: 'COMPLETED', result: formattedOutput },
          });

          try {
            await prisma.message.create({
              data: {
                sessionId,
                role: 'executor',
                content: `**[Task: ${currentTask.description}]**\n\n${formattedOutput}`,
              },
            });
          } catch {}

          const updatedTasks = await prisma.task.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
          });

          sendEvent('log', { message: '🏁 Task selesai.' });
          sendEvent('done', { tasks: updatedTasks });
          finish();
        } catch (error) {
          sendEvent('error', { error: 'Internal server error', details: error.message });
          finish();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Execute API Error:", error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
