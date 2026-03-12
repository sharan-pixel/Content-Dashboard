import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthCookie, verifyToken, clearAuthCookie, getDeviceCookie } from '@/lib/auth';

export async function GET() {
  const token = await getAuthCookie();
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    await clearAuthCookie();
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  // Check user exists in DB
  const supabase = getServiceSupabase();
  const { data: user } = await supabase
    .from('auth_users')
    .select('role, device_id')
    .eq('username', decoded.username)
    .single();

  if (!user) {
    await clearAuthCookie();
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  // For employees, verify they're on the locked device
  if (user.role !== 'master' && user.device_id) {
    const browserDeviceId = await getDeviceCookie();
    if (user.device_id !== browserDeviceId) {
      await clearAuthCookie();
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  }

  return NextResponse.json({ valid: true, username: decoded.username });
}
