import { cookies } from 'next/headers';

const COOKIE_NAME = 'auth_token';
const DEVICE_COOKIE_NAME = 'device_id';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

function getSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET not set');
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createToken(username: string, sessionToken: string): Promise<string> {
  const secret = getSecret();
  const payload = JSON.stringify({ username, sessionToken, exp: Date.now() + TOKEN_MAX_AGE * 1000 });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const encoded = btoa(payload);
  return `${encoded}.${sig}`;
}

export async function verifyToken(token: string): Promise<{ username: string; sessionToken?: string } | null> {
  try {
    const secret = getSecret();
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;

    const payload = atob(encoded);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
    if (!valid) return null;

    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;

    return { username: data.username, sessionToken: data.sessionToken };
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  // NOTE: device_id cookie is intentionally NOT cleared on logout
}

export async function setDeviceCookie(deviceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getDeviceCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(DEVICE_COOKIE_NAME)?.value;
}
