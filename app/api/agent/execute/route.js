import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

const execAsync = util.promisify(exec);

const tools = [
  {
    type: "function",
    function: {
      name: "run_terminal_command",
      description: "Run a terminal command (e.g. npm install, mkdir, node script.js). Runs in the root of the project.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Path should be relative to project root.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" }
        },
        required: ["filePath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the content of a file. Path should be relative to project root.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" }
        },
        required: ["filePath"]
      }
    }
  }
];

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

    const systemPrompt = `You are an AI executor in an autonomous agent system. 
The user's overall goal is: "${session.goal}". 
Your current task to execute is: "${currentTask.description}". 
You have access to tools to run terminal commands, read files, and write files. Use them if necessary to accomplish the task.
Return a comprehensive final response in Markdown when the task is done.`;

    let messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    if (session.messages && session.messages.length > 0) {
      messages = messages.concat(
        session.messages.map(m => ({
          role: m.role === 'executor' ? 'assistant' : m.role,
          content: m.content
        }))
      );
    }

    messages.push({ role: 'user', content: `Please execute this task: ${currentTask.description}` });

    const encoder = new TextEncoder();
    const signal = request.signal;
    
    // We start the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Interval untuk mengirim ping (keep-alive) setiap 15 detik agar koneksi tidak diputus browser/Next.js
        let pingInterval = setInterval(() => {
          if (controller) {
            try {
              controller.enqueue(encoder.encode(`:\n\n`)); // Komentar SSE, diabaikan oleh client
            } catch (e) {}
          }
        }, 15000);

        const sendEvent = (type, payload) => {
          try {
            const dataStr = JSON.stringify({ type, ...payload });
            controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
          } catch (e) {
            // connection might be closed
          }
        };

        try {
          await prisma.task.updateMany({
            where: { id: taskId },
            data: { status: 'RUNNING' }
          });
          
          // Siapkan workspace directory untuk sesi ini
          const workspaceDir = path.join(process.cwd(), 'workspaces', sessionId);
          await fs.mkdir(workspaceDir, { recursive: true });
          
          sendEvent('log', { message: 'Memulai eksekusi task...' });

          let isDone = false;
          let finalOutput = "";
          let loopCount = 0;
          const maxLoops = 10;
          const executionLogs = [];

          while (!isDone && loopCount < maxLoops) {
            if (signal && signal.aborted) {
              finalOutput = "Error: Execution was manually stopped by the user.";
              sendEvent('log', { message: '⛔ Eksekusi dibatalkan oleh user.' });
              break;
            }

            loopCount++;
            sendEvent('log', { message: `\n[Loop ${loopCount}] Menunggu respons AI...` });

            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 300000); // 300 detik maksimal (5 menit)
            
            // Gabungkan signal dari user (jika user klik stop) dan timeout
            const onAbort = () => timeoutController.abort();
            if (signal) signal.addEventListener('abort', onAbort);

            let response;
            try {
              response = await fetch(`${settings.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${settings.apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'http://localhost:3000', 
                  'X-Title': 'AI Chat App'
                },
                body: JSON.stringify({
                  model: settings.modelName || 'google/gemini-2.5-pro',
                  messages: messages,
                  tools: tools,
                  tool_choice: 'auto'
                }),
                signal: timeoutController.signal
              });
            } catch (fetchErr) {
              if (fetchErr.name === 'AbortError') {
                if (signal && signal.aborted) {
                  throw new Error("Dibatalkan oleh user.");
                } else {
                  throw new Error("Timeout: AI provider memakan waktu lebih dari 5 menit untuk merespons. Proses dibatalkan agar tidak menggantung selamanya. Kemungkinan prompt terlalu besar atau API kelebihan beban.");
                }
              }
              throw fetchErr;
            }
            
            clearTimeout(timeoutId);
            if (signal) signal.removeEventListener('abort', onAbort);

            if (!response.ok) {
              const errorText = await response.text();
              sendEvent('log', { message: `❌ API Error: ${response.status} ${errorText}` });
              await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'PENDING' } });
              sendEvent('error', { error: 'Failed to communicate with API', details: errorText });
              controller.close();
              return;
            }

            let data;
            try {
              const rawText = await response.text();
              let cleanedText = rawText;
              const lastBraceIndex = cleanedText.lastIndexOf('}');
              if (lastBraceIndex !== -1) {
                cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
              }
              data = JSON.parse(cleanedText);
            } catch (parseError) {
              await prisma.task.updateMany({ where: { id: taskId }, data: { status: 'PENDING' } });
              sendEvent('error', { error: 'Invalid JSON from API' });
              controller.close();
              return;
            }

            const message = data.choices?.[0]?.message;
            if (!message) {
              throw new Error("No message returned from API");
            }

            messages.push(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
              for (const toolCall of message.tool_calls) {
                const func = toolCall.function;
                let toolResult = "";
                
                try {
                  const args = JSON.parse(func.arguments || '{}');
                  
                  if (func.name === 'run_terminal_command') {
                    sendEvent('log', { message: `> Menjalankan perintah di workspace: ${args.command}` });
                    executionLogs.push(`> ${args.command}`);
                    const { stdout, stderr } = await execAsync(args.command, { cwd: workspaceDir, timeout: 15000 });
                    const rawOutput = stdout || stderr || "Command executed successfully (no output).";
                    toolResult = rawOutput.length > 3000 ? rawOutput.substring(0, 3000) + '\n... (Output terpotong karena terlalu panjang)' : rawOutput;
                    sendEvent('log', { message: `✅ Output:\n${toolResult.substring(0, 200)}${toolResult.length > 200 ? '...' : ''}` });
                  } else if (func.name === 'write_file') {
                    sendEvent('log', { message: `> Menulis file di workspace: ${args.filePath}` });
                    // Amankan path agar tidak keluar dari workspace
                    const targetPath = path.resolve(workspaceDir, args.filePath);
                    if (!targetPath.startsWith(workspaceDir)) {
                        throw new Error("Akses ditolak: Tidak boleh menulis di luar workspace");
                    }
                    await fs.mkdir(path.dirname(targetPath), { recursive: true });
                    await fs.writeFile(targetPath, args.content, 'utf8');
                    executionLogs.push(`> Wrote to file: ${args.filePath}`);
                    toolResult = `File written successfully to ${args.filePath}`;
                    sendEvent('log', { message: `✅ Berhasil menulis ${args.filePath}` });
                  } else if (func.name === 'read_file') {
                    sendEvent('log', { message: `> Membaca file dari workspace: ${args.filePath}` });
                    const targetPath = path.resolve(workspaceDir, args.filePath);
                    if (!targetPath.startsWith(workspaceDir)) {
                        throw new Error("Akses ditolak: Tidak boleh membaca di luar workspace");
                    }
                    const content = await fs.readFile(targetPath, 'utf8');
                    executionLogs.push(`> Read file: ${args.filePath}`);
                    toolResult = content.length > 10000 ? content.substring(0, 10000) + '\n... (File content truncated to 10k chars)' : content;
                    sendEvent('log', { message: `✅ Selesai membaca file (${content.length} karakter)` });
                  } else {
                    toolResult = `Unknown tool: ${func.name}`;
                    sendEvent('log', { message: `❌ Tool tidak dikenal: ${func.name}` });
                  }
                } catch (err) {
                  toolResult = `Error: ${err.message}`;
                  executionLogs.push(`> Error in ${func.name}: ${err.message}`);
                  sendEvent('log', { message: `❌ Error: ${err.message}` });
                }
                
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: func.name,
                  content: toolResult
                });
              }
            } else {
              finalOutput = message.content || 'Task completed with no output.';
              sendEvent('log', { message: `🏁 Tugas Selesai!` });
              isDone = true;
            }
          }

          if (!isDone) {
            finalOutput = "Error: Maximum tool execution loops (10) exceeded. The task was stopped before finishing.\n\n" + (messages[messages.length - 1]?.content || '');
            sendEvent('log', { message: `⛔ Loop maksimum tercapai. Tugas dihentikan paksa.` });
          }

          let formattedOutput = finalOutput;
          if (executionLogs.length > 0) {
            formattedOutput = `**Terminal & File Execution Logs:**\n\`\`\`text\n${executionLogs.join('\n')}\n\`\`\`\n\n---\n\n${finalOutput}`;
          }

          await prisma.task.updateMany({
            where: { id: taskId },
            data: { status: 'COMPLETED', result: formattedOutput }
          });

          try {
            await prisma.message.create({
              data: {
                sessionId,
                role: 'executor',
                content: `**[Task: ${currentTask.description}]**\n\n${formattedOutput}`
              }
            });
          } catch (e) {}

          const updatedTasks = await prisma.task.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' }
          });

          sendEvent('done', { tasks: updatedTasks });
          controller.close();
          
        } catch (error) {
          sendEvent('error', { error: 'Internal server error', details: error.message });
          controller.close();
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
