import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { buildPerformanceLearnings } from '@/lib/prompts';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { scriptId, feedback } = await request.json();

  if (!scriptId || !feedback) {
    return NextResponse.json(
      { error: 'scriptId and feedback are required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const supabase = getServiceSupabase();

  // Fetch the existing script with its topic
  const { data: script, error: scriptError } = await supabase
    .from('scripts')
    .select('*, topics(*)')
    .eq('id', scriptId)
    .single();

  if (scriptError || !script) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }

  const topic = script.topics;

  // Fetch performance data for learnings
  const { data: perfData } = await supabase
    .from('performance')
    .select('views, likes, shares, hook_rate, topics(title, category, hook_line)')
    .order('logged_at', { ascending: false })
    .limit(50);

  let perfContext = '';
  if (perfData && perfData.length > 0) {
    perfContext = buildPerformanceLearnings(
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
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are revising a presenter-style Instagram Reel script for an Indian finance creator.
Audience: 25–40 year old Indian professionals earning ₹10 LPA+.

Topic: ${topic.title}
Category: ${topic.category}
${perfContext}
Here is the current script:
---
${script.content}
---

The creator wants these changes:
---
${feedback}
---

Rewrite the script incorporating the requested changes. Keep the same format with timestamp markers:
*[Hook — 0:00–0:04]*
*[Context — ...]*
*[The Mechanism / Detail — ...]*
*[The Surprising Part — ...]*
*[Close — ...]*

Rules:
- Direct to camera, conversational, no jargon without explanation
- Use real Indian numbers (₹, lakhs, crores)
- Every section must earn the next 10 seconds of attention
- Total runtime: 45–90 seconds

Return ONLY the revised script, no additional commentary.`,
      },
    ],
  });

  const revisedContent = message.content[0].type === 'text' ? message.content[0].text : '';

  // Update the existing script with revised content
  const { data: updatedScript, error: updateError } = await supabase
    .from('scripts')
    .update({
      content: revisedContent,
      status: 'pending_review',
    })
    .eq('id', scriptId)
    .select('*, topics(*)')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ script: updatedScript });
}
