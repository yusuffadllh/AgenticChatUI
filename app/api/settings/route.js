import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: "",
          modelName: "google/gemini-2.5-pro",
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET Settings Error:", error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey, modelName } = await request.json();
    
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: { baseUrl, apiKey, modelName },
      create: { id: 1, baseUrl, apiKey, modelName },
    });
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error("POST Settings Error:", error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
