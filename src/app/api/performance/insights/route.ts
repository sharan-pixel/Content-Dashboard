import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildInsightsPrompt } from '@/lib/prompts';

export const maxDuration = 60;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const supabase = getServiceSupabase();

  const { data: perfData, error } = await supabase
    .from('performance')
    .select('*, topics(title, category, hook_line)')
    .order('logged_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!perfData || perfData.length === 0) {
    return NextResponse.json({
      insights: 'Not enough performance data to generate insights. Log performance for at least a few reels first.',
    });
  }

  const lines = perfData.map((p) => {
    const topic = p.topics as { title: string; category: string; hook_line: string } | null;
    return `- "${topic?.title || 'Unknown'}" (${topic?.category || '?'}) | Hook: "${topic?.hook_line || '?'}" | Views: ${p.views ?? '?'} | Likes: ${p.likes ?? '?'} | Shares: ${p.shares ?? '?'} | Saves: ${p.saves ?? '?'} | Hook Rate: ${p.hook_rate ?? '?'}% | Date: ${p.logged_at}`;
  });

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: buildInsightsPrompt(lines.join('\n')) },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  return NextResponse.json({ insights: responseText });
}
