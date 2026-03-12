import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('performance')
    .select('*, topics(*), scripts(*)')
    .order('logged_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ performance: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('performance')
    .insert({
      topic_id: body.topicId,
      script_id: body.scriptId || null,
      views: body.views || null,
      likes: body.likes || null,
      shares: body.shares || null,
      saves: body.saves || null,
      comments: body.comments || null,
      hook_rate: body.hookRate ?? body.hook_rate ?? null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ performance: data });
}
