import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { buildBudgetedPrompt } from '@/lib/context';

export async function POST(request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tasks: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Format previous tasks for context. Cap each result, then apply an overall
    // token budget (most recent tasks kept first) so the review prompt never
    // starts out as an oversized payload the gateway rejects.
    const taskContext = buildBudgetedPrompt(
      session.tasks
        .map((t, i) => ({
          text: `Task ${i + 1} [${t.status}]: ${t.description}\nResult: ${(t.result || 'No output').slice(0, 600)}`,
          // Newer tasks matter more for the review, so give them higher priority.
          priority: i,
          truncatable: true,
        }))
        .reverse(),
      120000,
    );

    const systemPrompt = `You are the Reviewer Agent in an autonomous AI loop.
The user's original goal is: "${session.goal}"

Here are all the tasks that have been executed so far and their results:
${taskContext}

Your job is to critically review the work done so far. Ask yourself:
1. Is the goal completely fully achieved?
2. Are there any security vulnerabilities in the proposed solutions?
3. Are there edge cases or missing components that were overlooked?
4. How can the code/solution be further optimized, refactored, or documented?

CRITICAL INSTRUCTION: You MUST NEVER respond with an empty array [].
The user wants continuous, never-ending improvements. If the current work seems perfect, you MUST find something else to improve (e.g., add advanced error handling, optimize performance, write comprehensive documentation, add security hardening, create unit tests).
ALWAYS generate 1 to 3 NEW tasks to continuously improve the project.
Respond ONLY with a valid JSON array of objects. Format: [{"description": "Refactor X to improve Y"}, {"description": "Add Z for security"}]`;

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.modelName || 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Review the progress and output new tasks if necessary (empty array if perfect).' }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: 'Failed to communicate with API', details: errorText }, { status: response.status });
    }

    let data;
    let rawText;
    try {
      rawText = await response.text();
      let cleanedText = rawText.trim();
      const lastCurly = cleanedText.lastIndexOf('}');
      if (lastCurly !== -1) {
        cleanedText = cleanedText.substring(0, lastCurly + 1);
      }
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error(parseError);
      return NextResponse.json({ error: 'Invalid JSON from API', details: rawText }, { status: 502 });
    }

    let assistantContent = data.choices?.[0]?.message?.content || "[]";
    assistantContent = assistantContent.replace(/```json/g, '').replace(/```/g, '').trim();

    let newTasksData = [];
    try {
      newTasksData = JSON.parse(assistantContent);
      if (!Array.isArray(newTasksData) && newTasksData.tasks) {
        newTasksData = newTasksData.tasks;
      }
    } catch (e) {
      console.error("Failed to parse review tasks", e);
      newTasksData = [];
    }

    const createdTasks = [];
    for (const t of newTasksData) {
      if (t && t.description) {
        const task = await prisma.task.create({
          data: {
            sessionId: session.id,
            description: t.description,
            status: 'PENDING'
          }
        });
        createdTasks.push(task);
      }
    }

    if (createdTasks.length > 0) {
      await prisma.message.create({
        data: {
          sessionId: session.id,
          role: 'planner',
          content: `Reviewer identified missing items. Generated tasks:\n` + JSON.stringify(newTasksData)
        }
      });
    }

    const allUpdatedTasks = await prisma.task.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ tasks: allUpdatedTasks, newTasksAdded: createdTasks.length > 0 });

  } catch (error) {
    console.error("Review API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
