import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let query = supabase
    .from('topic_batches')
    .select('*, topics(*)')
    .order('generated_date', { ascending: false })
    .limit(30);

  if (date) {
    query = query.eq('generated_date', date);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ batches: data });
}
