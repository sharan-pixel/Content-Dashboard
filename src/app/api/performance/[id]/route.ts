import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getServiceSupabase();

  const updateData: Record<string, unknown> = {};
  if (body.views !== undefined) updateData.views = body.views;
  if (body.likes !== undefined) updateData.likes = body.likes;
  if (body.shares !== undefined) updateData.shares = body.shares;
  if (body.saves !== undefined) updateData.saves = body.saves;
  if (body.comments !== undefined) updateData.comments = body.comments;
  if (body.hook_rate !== undefined) updateData.hook_rate = body.hook_rate;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const { data, error } = await supabase
    .from('performance')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ performance: data });
}
