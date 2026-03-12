import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getServiceSupabase();

  const updateData: Record<string, string> = {};
  if (body.status) {
    updateData.status = body.status;
  }
  if (body.content !== undefined) {
    updateData.content = body.content;
  }

  const { data, error } = await supabase
    .from('scripts')
    .update(updateData)
    .eq('id', id)
    .select('*, topics(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If marked as shot, also update the topic status
  if (body.status === 'shot') {
    await supabase
      .from('topics')
      .update({ status: 'shot' })
      .eq('id', data.topic_id);
  }

  // If approved, also update the topic status
  if (body.status === 'approved') {
    await supabase
      .from('topics')
      .update({ status: 'approved' })
      .eq('id', data.topic_id);
  }

  return NextResponse.json({ script: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  // Delete related performance entries first
  await supabase.from('performance').delete().eq('script_id', id);

  // Delete the script
  const { error } = await supabase.from('scripts').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
