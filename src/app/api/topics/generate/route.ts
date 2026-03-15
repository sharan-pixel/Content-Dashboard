import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildTopicGenerationPrompt } from '@/lib/prompts';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get today's date in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  // Check if batch already exists for today
  const { data: existing } = await supabase
    .from('topic_batches')
    .select('id')
    .eq('generated_date', today)
    .eq('source_type', 'daily_cron')
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ message: 'Batch already exists for today', batchId: existing.id });
  }

  // Build performance context from last 30 days
  let performanceContext = '';
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: perfData } = await supabase
    .from('performance')
    .select('views, topics(category, hook_line)')
    .gte('logged_at', thirtyDaysAgo);

  if (perfData && perfData.length > 0) {
    const categoryStats: Record<string, { totalViews: number; count: number }> = {};
    const hookStyles: Record<string, number> = {};

    for (const p of perfData) {
      const topic = p.topics as unknown as { category: string; hook_line: string } | null;
      if (!topic) continue;

      if (!categoryStats[topic.category]) {
        categoryStats[topic.category] = { totalViews: 0, count: 0 };
      }
      categoryStats[topic.category].totalViews += p.views || 0;
      categoryStats[topic.category].count += 1;

      // Track hook style patterns
      const hookStart = topic.hook_line.split(' ').slice(0, 3).join(' ');
      hookStyles[hookStart] = (hookStyles[hookStart] || 0) + (p.views || 0);
    }

    const lines: string[] = [];
    for (const [cat, stats] of Object.entries(categoryStats)) {
      const avg = Math.round(stats.totalViews / stats.count);
      lines.push(`- ${cat} scripts: avg ${avg.toLocaleString()} views`);
    }

    // Find best hook style
    const sortedHooks = Object.entries(hookStyles).sort((a, b) => b[1] - a[1]);
    if (sortedHooks.length > 0) {
      lines.push(`- Best performing hook style: "${sortedHooks[0][0]}..."`);
    }
    if (sortedHooks.length > 1) {
      lines.push(`- Lowest performing: hooks starting with "${sortedHooks[sortedHooks.length - 1][0]}..."`);
    }

    performanceContext = lines.join('\n');
  }

  // Call Claude for topic generation
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildTopicGenerationPrompt(performanceContext),
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse JSON response
  let topics;
  try {
    // Strip markdown fencing if present
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    topics = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse Claude response', raw: responseText },
      { status: 500 }
    );
  }

  // Save batch to Supabase
  const { data: batch, error: batchError } = await supabase
    .from('topic_batches')
    .insert({
      generated_date: today,
      source_type: 'daily_cron',
      performance_context: performanceContext || null,
    })
    .select()
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  // Save individual topics
  const topicRows = topics.map((t: Record<string, unknown>, i: number) => ({
    batch_id: batch.id,
    position: i + 1,
    title: t.title,
    category: t.category,
    hook_line: t.hook_line,
    core_insight: t.core_insight,
    talking_points: t.talking_points,
    cta: t.cta,
    source_url: t.source_url || null,
    status: 'pending',
  }));

  const { error: topicsError } = await supabase.from('topics').insert(topicRows);

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  return NextResponse.json({ batchId: batch.id, topicCount: topics.length });
}
