import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { hashPassword, getAuthCookie, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  if (password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Allow registration only if: no users exist yet (bootstrap) or caller is authenticated
  const { count } = await supabase
    .from('auth_users')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const verified = await verifyToken(token);
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const passwordHash = await hashPassword(password);

  const { error } = await supabase
    .from('auth_users')
    .insert({ username, password_hash: passwordHash });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
