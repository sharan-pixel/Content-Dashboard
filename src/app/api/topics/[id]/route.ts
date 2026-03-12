import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  // Delete related performance entries first
  await supabase.from('performance').delete().eq('topic_id', id);

  // Delete related scripts
  await supabase.from('scripts').delete().eq('topic_id', id);

  // Delete the topic
  const { error } = await supabase.from('topics').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
