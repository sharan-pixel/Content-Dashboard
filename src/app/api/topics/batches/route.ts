import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  // Calculate today's date in IST to exclude from past batches
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  let query = supabase
    .from('topic_batches')
    .select('*, topics(*)')
    .order('generated_date', { ascending: false })
    .limit(30);

  if (date) {
    query = query.eq('generated_date', date);
  } else {
    // Exclude today's batches — those are shown in the Today tab
    query = query.lt('generated_date', today);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ batches: data });
}
