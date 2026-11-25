export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES = new Set([
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
]);

export function usernameError(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-20 characters and use only lowercase letters, digits, and underscores';
  }
  if (RESERVED_USERNAMES.has(username)) {
    return 'This username is reserved';
  }
  return null;
}
