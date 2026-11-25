import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { GoogleTokenVerifier } from './google.verifier';

function known(target: string[] | string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target },
  });
}

describe('AuthService', () => {
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const tokens = { issueRefresh: jest.fn().mockResolvedValue('refresh-token') };
  const config = {
    get: (key: string) =>
      key === 'ADMIN_EMAILS' ? 'robinwebc@gmail.com' : undefined,
  };

  const service = new AuthService(
    prisma as never,
    jwt as unknown as JwtService,
    tokens as unknown as TokenService,
    {} as OtpService,
    {} as GoogleTokenVerifier,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('access-token');
    tokens.issueRefresh.mockResolvedValue('refresh-token');
  });

  it('registers with a nSedo user id and the owner response shape', async () => {
    prisma.user.create.mockResolvedValue({
      userId: 'nSedo123456',
      username: 'sara',
    });
    const result = await service.register({
      username: 'sara',
      displayName: 'Sara',
      email: 'sara@example.com',
      phone: '+8801711111111',
      password: 'password123',
    });
    expect(result).toEqual({
      userId: 'nSedo123456',
      username: 'sara',
      message: 'Account created successfully',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.userId).toMatch(/^nSedo\d{6}$/);
    expect(data.role).toBe(Role.USER);
    expect(data.passwordHash).not.toBe('password123');
    await expect(bcrypt.compare('password123', data.passwordHash)).resolves.toBe(
      true,
    );
  });

  it('retries when the generated userId collides', async () => {
    prisma.user.create
      .mockRejectedValueOnce(known(['userId']))
      .mockResolvedValueOnce({ userId: 'nSedo654321', username: 'sara' });
    const result = await service.register({
      username: 'sara',
      displayName: 'Sara',
      email: 'sara@example.com',
      phone: '+8801711111111',
      password: 'password123',
    });
    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    const first = prisma.user.create.mock.calls[0][0].data.userId as string;
    const second = prisma.user.create.mock.calls[1][0].data.userId as string;
    expect(first).toMatch(/^nSedo\d{6}$/);
    expect(second).toMatch(/^nSedo\d{6}$/);
    expect(first).not.toBe(second);
    expect(result.userId).toBe('nSedo654321');
  });

  it('returns a clean conflict for duplicate email, phone, or username', async () => {
    prisma.user.create.mockRejectedValue(known(['email']));
    await expect(
      service.register({
        username: 'sara',
        displayName: 'Sara',
        email: 'sara@example.com',
        phone: '+8801711111111',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.user.create.mockRejectedValue(known('User_phone_key'));
    await expect(
      service.register({
        username: 'sara',
        displayName: 'Sara',
        email: 'sara2@example.com',
        phone: '+8801711111111',
        password: 'password123',
      }),
    ).rejects.toThrow('Phone already in use');
    prisma.user.create.mockRejectedValue(known(['username']));
    await expect(
      service.register({
        username: 'sara',
        displayName: 'Sara',
        email: 'sara3@example.com',
        phone: '+8801711111112',
        password: 'password123',
      }),
    ).rejects.toThrow('Username already in use');
  });

  it('gives the configured admin email the ADMIN role at registration', async () => {
    prisma.user.create.mockResolvedValue({
      userId: 'nSedo111111',
      username: 'robin',
    });
    await service.register({
      username: 'robin',
      displayName: 'Robin',
      email: 'RobinWebc@gmail.com',
      phone: '+8801711111199',
      password: 'password123',
    });
    expect(prisma.user.create.mock.calls[0][0].data.role).toBe(Role.ADMIN);
    expect(prisma.user.create.mock.calls[0][0].data.email).toBe(
      'robinwebc@gmail.com',
    );
  });

  it('rejects a bad password with the owner error', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.login('sara', 'nope')).rejects.toEqual(
      new UnauthorizedException('Invalid login details'),
    );
    const hash = await bcrypt.hash('password123', 12);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      userId: 'nSedo123456',
      role: Role.USER,
      passwordHash: hash,
      banned: false,
      email: 'sara@example.com',
    });
    await expect(service.login('sara', 'wrong-pass')).rejects.toThrow(
      'Invalid login details',
    );
  });

  it('signs {sub, role} and returns userId plus accessToken', async () => {
    const hash = await bcrypt.hash('password123', 12);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      userId: 'nSedo123456',
      role: Role.USER,
      passwordHash: hash,
      banned: false,
      email: 'sara@example.com',
    });
    const result = await service.login('sara@example.com', 'password123');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', role: Role.USER });
    expect(result).toEqual({
      userId: 'nSedo123456',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('promotes a matching admin email on password login', async () => {
    const hash = await bcrypt.hash('password123', 12);
    prisma.user.findFirst.mockResolvedValue({
      id: 'admin1',
      userId: 'nSedo222222',
      role: Role.USER,
      passwordHash: hash,
      banned: false,
      email: 'robinwebc@gmail.com',
    });
    prisma.user.update.mockResolvedValue({
      id: 'admin1',
      userId: 'nSedo222222',
      role: Role.ADMIN,
      email: 'robinwebc@gmail.com',
    });
    await service.login('robinwebc@gmail.com', 'password123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'admin1' },
      data: { role: Role.ADMIN },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'admin1',
      role: Role.ADMIN,
    });
  });
});
