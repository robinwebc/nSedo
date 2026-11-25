export const DEFAULT_ADMIN_EMAIL = 'robinwebc@gmail.com';

export function adminEmailSet(raw: string | undefined | null): Set<string> {
  if (raw === undefined || raw === null) {
    return new Set([DEFAULT_ADMIN_EMAIL]);
  }
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  raw: string | undefined | null,
): boolean {
  if (!email) return false;
  return adminEmailSet(raw).has(email.trim().toLowerCase());
}
