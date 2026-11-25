export const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const key = 'nsedo.admin.session';

export type Session = { userId: string; accessToken: string; refreshToken: string };

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(key, JSON.stringify(session));
  else localStorage.removeItem(key);
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (session?.accessToken) headers.authorization = `Bearer ${session.accessToken}`;
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Request failed');
  }
  return data as T;
}
