import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildResearchTopicGenerationPrompt } from '@/lib/prompts';
import { parseResearchUpload } from '@/lib/parse-research-upload';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
  let combinedText: string;
  try {
    const formData = await request.formData();
    const result = await parseResearchUpload(formData);
    combinedText = result.combinedText;
  } catch (err) {
    console.error('parseResearchUpload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse upload.' },
      { status: 400 }
    );
  }

  if (combinedText.trim().length < 20) {
    return NextResponse.json(
      { error: 'Please provide some research (text or file, at least a few sentences).' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const supabase = getServiceSupabase();
  const anthropic = new Anthropic({ apiKey });

  // Call Claude to extract 5 topic ideas from the research
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildResearchTopicGenerationPrompt(combinedText),
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  let topicIdeas: Array<{
    title: string;
    category: string;
    hook_line: string;
    core_insight: string;
    talking_points: string[];
    cta: string;
    source_url: string;
  }>;

  try {
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    topicIdeas = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse ideas from your research. Try adding more detail or a different section.' },
      { status: 500 }
    );
  }

  // Create or reuse today's manual batch
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  let { data: batch } = await supabase
    .from('topic_batches')
    .select('id')
    .eq('generated_date', today)
    .eq('source_type', 'manual')
    .limit(1)
    .single();

  if (!batch) {
    const { data: newBatch, error: batchError } = await supabase
      .from('topic_batches')
      .insert({ generated_date: today, source_type: 'manual' })
      .select()
      .single();

    if (batchError || !newBatch) {
      return NextResponse.json({ error: batchError?.message || 'Failed to create batch' }, { status: 500 });
    }
    batch = newBatch;
  }

  if (!batch) {
    return NextResponse.json({ error: 'Failed to resolve batch' }, { status: 500 });
  }

  // Get current topic count for positioning
  const { count } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', batch.id);

  // Insert all topics with status 'pending'
  const topicRows = topicIdeas.map((t, i) => ({
    batch_id: batch!.id,
    position: (count || 0) + i + 1,
    title: t.title,
    category: t.category,
    hook_line: t.hook_line,
    core_insight: t.core_insight,
    talking_points: t.talking_points || [],
    cta: t.cta || '',
    source_url: t.source_url || null,
    status: 'pending',
  }));

  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .insert(topicRows)
    .select();

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  return NextResponse.json({ topics });

  } catch (err) {
    console.error('Unhandled error in /api/topics/custom/ideas:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
