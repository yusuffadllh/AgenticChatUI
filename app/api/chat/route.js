import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { fetchChatWithRetry } from '@/lib/context';

export async function POST(request) {
  try {
    console.log("Parsing request body...");
    const { content, sessionId } = await request.json();
    console.log("Request body parsed successfully.");

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Get settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 });
    }

    // Get or create session
    let session;
    if (sessionId) {
      session = await prisma.session.findUnique({ where: { id: sessionId } });
    }
    
    if (!session) {
      session = await prisma.session.create({
        data: { goal: 'Chat session' }
      });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content,
      }
    });

    // Get previous messages for context (last 10)
    const history = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    const openRouterMessages = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Call gateway, retrying on transient 429/5xx ("busy").
    const response = await fetchChatWithRetry(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000', 
        'X-Title': 'AI Chat App',
      },
      body: JSON.stringify({
        model: settings.modelName || 'google/gemini-2.5-pro',
        messages: openRouterMessages,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", response.status, errorText);
      return NextResponse.json({ error: 'Failed to communicate with OpenRouter API', details: errorText }, { status: response.status });
    }

    let data;
    let rawText;
    try {
      console.log("Parsing response from AI provider...");
      rawText = await response.text();
      // Clean up trailing garbage like "data: [DONE]" that some providers append
      let cleanedText = rawText;
      const lastBraceIndex = cleanedText.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
      }
      data = JSON.parse(cleanedText);
      console.log("AI provider response parsed successfully.");
    } catch (parseError) {
      console.error("Failed to parse JSON from AI provider. Raw response:", rawText);
      return NextResponse.json({ error: 'Invalid JSON from AI provider', details: rawText }, { status: 502 });
    }

    const assistantContent = data.choices && data.choices[0] && data.choices[0].message 
      ? data.choices[0].message.content 
      : JSON.stringify(data);

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
      }
    });

    return NextResponse.json({ 
      session: session,
      userMessage,
      assistantMessage
    });

  } catch (error) {
    console.error("Chat API Error Caught at Outer Block:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      const type = searchParams.get('type') || 'chat';
      const whereClause = type === 'chat' 
        ? { goal: 'Chat session' } 
        : { goal: { not: 'Chat session' } };

      const sessions = await prisma.session.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'asc' }
          },
          // Agent sessions need task status so the sidebar can show progress
          // (how many tasks are done vs pending) for each project.
          ...(type === 'agent'
            ? { tasks: { select: { id: true, status: true } } }
            : {}),
        }
      });
      return NextResponse.json({ sessions });
    }

    const history = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages: history });
  } catch (error) {
    console.error("Fetch history error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.task.deleteMany({ where: { sessionId } });
    await prisma.session.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
