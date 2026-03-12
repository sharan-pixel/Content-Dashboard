import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildScriptGenerationPrompt, buildPerformanceLearnings } from '@/lib/prompts';
import { Topic } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { topicId } = await request.json();

  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Fetch the topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single();

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  // Update topic status to script_requested
  await supabase
    .from('topics')
    .update({ status: 'script_requested' })
    .eq('id', topicId);

  // Fetch performance data for learnings
  const { data: perfData } = await supabase
    .from('performance')
    .select('views, likes, shares, hook_rate, topics(title, category, hook_line)')
    .order('logged_at', { ascending: false })
    .limit(50);

  const perfLearnings = perfData && perfData.length > 0
    ? buildPerformanceLearnings(
        perfData.map((p) => {
          const t = p.topics as unknown as { title: string; category: string; hook_line: string } | null;
          return {
            title: t?.title || 'Unknown',
            category: t?.category || 'Unknown',
            hook_line: t?.hook_line || '',
            views: p.views || 0,
            likes: p.likes || 0,
            shares: p.shares || 0,
            hook_rate: p.hook_rate,
          };
        })
      )
    : undefined;

  // Call Claude for script generation
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildScriptGenerationPrompt(topic as Topic, perfLearnings),
      },
    ],
  });

  const scriptContent = message.content[0].type === 'text' ? message.content[0].text : '';

  // Save the script
  const { data: script, error: scriptError } = await supabase
    .from('scripts')
    .insert({
      topic_id: topicId,
      content: scriptContent,
      status: 'pending_review',
    })
    .select()
    .single();

  if (scriptError) {
    return NextResponse.json({ error: scriptError.message }, { status: 500 });
  }

  // Update topic status to script_ready
  await supabase
    .from('topics')
    .update({ status: 'script_ready' })
    .eq('id', topicId);

  return NextResponse.json({ script });
}
