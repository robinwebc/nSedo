import { usernameError } from './username';
import { adminEmailSet, isAdminEmail } from './admin-email';
import { toPublicUser } from './user.serializer';

describe('username policy', () => {
  it('accepts a normal username', () => {
    expect(usernameError('sara_01')).toBeNull();
  });

  it('rejects uppercase, short names, and reserved words', () => {
    expect(usernameError('Sara')).toMatch(/lowercase/);
    expect(usernameError('ab')).toMatch(/3-20/);
    expect(usernameError('admin')).toMatch(/reserved/);
    expect(usernameError('nsedo')).toMatch(/reserved/);
  });
});

describe('admin emails', () => {
  it('defaults to the super admin', () => {
    expect(isAdminEmail('robinwebc@gmail.com', undefined)).toBe(true);
    expect(isAdminEmail('robinwebc@gmail.com', null)).toBe(true);
    expect(isAdminEmail('someone@example.com', undefined)).toBe(false);
  });

  it('reads a comma-separated list and allows an empty override', () => {
    expect(adminEmailSet(' A@x.com , b@y.com ')).toEqual(
      new Set(['a@x.com', 'b@y.com']),
    );
    expect(isAdminEmail('robinwebc@gmail.com', '')).toBe(false);
  });
});

describe('public user serializer', () => {
  it('never copies email, phone, or passwordHash', () => {
    const dto = toPublicUser({
      id: '1',
      userId: 'nSedo123456',
      username: 'sara',
      displayName: 'Sara',
      avatarUrl: null,
      coverUrl: null,
      bio: null,
      role: 'USER',
      privacy: 'PUBLIC',
      verifiedBadge: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(dto).not.toHaveProperty('email');
    expect(dto).not.toHaveProperty('phone');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(dto)).not.toContain('passwordHash');
  });
});
