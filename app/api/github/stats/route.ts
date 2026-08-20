import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const githubSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Missing owner or repo parameter' },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      stats: {
        stars: data.stargazers_count,
        forks: data.forks_count,
        watchers: data.watchers_count,
        lastUpdated: data.pushed_at,
        description: data.description,
        language: data.language,
        updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('GitHub stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub repository stats' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const { owner, repo } = githubSchema.parse(body);
    
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      stats: {
        stars: data.stargazers_count,
        forks: data.forks_count,
        watchers: data.watchers_count,
        lastUpdated: data.pushed_at,
        description: data.description,
        language: data.language,
        updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('GitHub stats polling error:', error);
    return NextResponse.json(
      { error: 'Failed to poll GitHub stats' },
      { status: 500 }
    );
  }
}