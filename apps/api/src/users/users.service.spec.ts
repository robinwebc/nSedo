import { HttpException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService username changes', () => {
  const prisma = { user: { update: jest.fn(), findUnique: jest.fn() } };
  const service = new UsersService(prisma as never, {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('allows the first change and a change after 30 days', async () => {
    prisma.user.update.mockImplementation(
      async ({ data }: { data: { username: string } }) => ({
        id: 'u',
        userId: 'nSedo123456',
        username: data.username,
        displayName: 'Sara',
        avatarUrl: null,
        coverUrl: null,
        bio: null,
        role: 'USER',
        privacy: 'PUBLIC',
        verifiedBadge: false,
        createdAt: new Date(),
        email: 'sara@example.com',
        phone: '+8801711111111',
        emailVerified: false,
        phoneVerified: false,
        usernameChangedAt: new Date(),
      }),
    );
    const first = await service.changeUsername(
      { id: 'u', username: 'sara', usernameChangedAt: null } as never,
      'sara_new',
    );
    expect(first.username).toBe('sara_new');
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await service.changeUsername(
      { id: 'u', username: 'sara_new', usernameChangedAt: old } as never,
      'sara_next',
    );
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it('blocks a second change inside 30 days', async () => {
    await expect(
      service.changeUsername(
        {
          id: 'u',
          username: 'sara',
          usernameChangedAt: new Date(),
        } as never,
        'other_name',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
