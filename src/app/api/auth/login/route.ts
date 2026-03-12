import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { hashPassword, createToken, setAuthCookie, generateSessionToken, getDeviceCookie, setDeviceCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('auth_users')
    .select('id, username, role, device_id')
    .eq('username', username)
    .eq('password_hash', passwordHash)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  // Employees are permanently locked to the first device they log in from
  if (user.role !== 'master') {
    const browserDeviceId = await getDeviceCookie();

    if (user.device_id && user.device_id !== browserDeviceId) {
      // Different device trying to log in — block it
      return NextResponse.json(
        { error: 'This account is already active on another device. Please use the original device.' },
        { status: 403 }
      );
    }

    if (!user.device_id) {
      // First-ever login — lock to this device
      const newDeviceId = generateSessionToken();
      await supabase
        .from('auth_users')
        .update({ device_id: newDeviceId })
        .eq('id', user.id);
      await setDeviceCookie(newDeviceId);
    }
    // If device_id matches, they're on the right device — allow re-login
  }

  const sessionToken = generateSessionToken();
  const token = await createToken(user.username, sessionToken);
  await setAuthCookie(token);

  return NextResponse.json({ success: true });
}
