import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { taskId } = await request.json();
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Reset a failed (or any) task so the loop runs it again from scratch.
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'PENDING', result: null },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error('Retry task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
