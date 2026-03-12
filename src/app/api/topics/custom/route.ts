import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildScriptGenerationPrompt } from '@/lib/prompts';
import { parseResearchUpload } from '@/lib/parse-research-upload';
import { Topic } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let combinedResearch: string;
  try {
    const formData = await request.formData();
    const result = await parseResearchUpload(formData);
    combinedResearch = result.combinedText;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse upload.' },
      { status: 400 }
    );
  }

  if (combinedResearch.trim().length < 20) {
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

  // Step 1: Extract a structured topic from the research
  const topicMessage = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a content strategist for an Indian finance Instagram creator.
Audience: 25–40 year old Indian professionals earning ₹10 LPA+.

The creator has shared the following research/notes for a reel idea:

---
${combinedResearch.substring(0, 150000)}
---

Turn this into a structured reel topic. Extract or create:
1. title — a catchy reel title
2. category — one of: Tax Saving | Insurance | Credit Cards | Scam Alert | Institutional Tricks | Market & Portfolio | Business Opportunities | Wealth Growth | Misc Finance
3. hook_line — the exact opening line to grab attention in 2 seconds
4. core_insight — the ONE key takeaway (1–2 sentences)
5. talking_points — 3–4 bullet points the presenter should cover
6. cta — a natural call-to-action
7. source_url — if the research contains a URL or article link, include it; otherwise set to "User Research"

Return ONLY a JSON object with these fields: title, category, hook_line, core_insight, talking_points (array), cta, source_url. No markdown fencing.`,
      },
    ],
  });

  const topicText = topicMessage.content[0].type === 'text' ? topicMessage.content[0].text : '';

  let topicData;
  try {
    const cleaned = topicText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    topicData = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse topic from your research. Try adding more detail.' },
      { status: 500 }
    );
  }

  // Save batch + topic
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

  const { count } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', batch.id);

  // Extract real URLs from the research text instead of trusting Claude's hallucinated ones
  const urlMatch = combinedResearch.match(/https?:\/\/[^\s<>"')\]]+/);
  const realSourceUrl = urlMatch ? urlMatch[0] : 'User Research';

  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .insert({
      batch_id: batch.id,
      position: (count || 0) + 1,
      title: topicData.title,
      category: topicData.category,
      hook_line: topicData.hook_line,
      core_insight: topicData.core_insight,
      talking_points: topicData.talking_points || [],
      cta: topicData.cta || '',
      source_url: realSourceUrl,
      status: 'script_requested',
    })
    .select()
    .single();

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 });
  }

  // Step 2: Generate script immediately
  const scriptMessage = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildScriptGenerationPrompt(topic as Topic),
      },
    ],
  });

  const scriptContent = scriptMessage.content[0].type === 'text' ? scriptMessage.content[0].text : '';

  const { data: script, error: scriptError } = await supabase
    .from('scripts')
    .insert({
      topic_id: topic.id,
      content: scriptContent,
      status: 'pending_review',
    })
    .select()
    .single();

  if (scriptError) {
    return NextResponse.json({ error: scriptError.message }, { status: 500 });
  }

  await supabase
    .from('topics')
    .update({ status: 'script_ready' })
    .eq('id', topic.id);

  return NextResponse.json({ topic, script });
}
