export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'nsedo',
  'support',
  'help',
  'root',
  'system',
  'moderator',
  'mod',
  'official',
  'api',
  'www',
  'null',
  'undefined',
  'username',
  'settings',
  'login',
  'signup',
  'signin',
  'register',
  'me',
  'user',
  'users',
  'live',
  'search',
  'messages',
  'notifications',
  'report',
  'reports',
  'staff',
  'security',
  'privacy',
  'terms',
  'about',
  'everyone',
  'all',
  'here',
  'channel',
  'post',
  'posts',
  'home',
  'explore',
  'friend',
  'friends',
  'follow',
  'anonymous',
  'deleted',
] as const;

const reserved = new Set<string>(RESERVED_USERNAMES);

export function usernameError(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-20 characters and use only lowercase letters, digits, and underscores';
  }
  if (reserved.has(username)) {
    return 'This username is reserved';
  }
  return null;
}

export type Role = 'USER' | 'MODERATOR' | 'ADMIN';
export type Privacy = 'PUBLIC' | 'PRIVATE';

export interface PublicUser {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  role: Role;
  privacy: Privacy;
  verifiedBadge: boolean;
  createdAt: string;
}

export interface OwnerUser extends PublicUser {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  usernameChangedAt: string | null;
}

export const DEFAULT_ADMIN_EMAIL = 'robinwebc@gmail.com';
