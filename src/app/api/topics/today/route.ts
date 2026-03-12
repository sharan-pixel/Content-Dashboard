import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceSupabase();

  // Get today's date in IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  // Fetch today's AI-generated batch with its topics
  const { data: batch, error: batchError } = await supabase
    .from('topic_batches')
    .select('*, topics(*)')
    .eq('generated_date', today)
    .eq('source_type', 'daily_cron')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (batchError && batchError.code !== 'PGRST116') {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  // Fetch today's manual topics
  const { data: manualBatch } = await supabase
    .from('topic_batches')
    .select('*, topics(*)')
    .eq('generated_date', today)
    .eq('source_type', 'manual')
    .limit(1)
    .single();

  const manualTopics = manualBatch?.topics || [];

  return NextResponse.json({ batch: batch || null, manualTopics, date: today });
}
