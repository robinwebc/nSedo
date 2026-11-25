import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AccessService } from '../common/access.service';
import { toStoredKey } from '../media/media.rules';
import { usernameError } from '../common/username';
import { toOwnerUser, toPublicUser } from '../common/user.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { UpdateProfileDto } from './dto';

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tokens: TokenService,
  ) {}

  availability(username: string) {
    const normalized = username.trim().toLowerCase();
    const error = usernameError(normalized);
    if (error) return { available: false, reason: error };
    return this.prisma.user
      .findUnique({ where: { username: normalized }, select: { id: true } })
      .then((row) =>
        row
          ? { available: false, reason: 'Username already in use' }
          : { available: true },
      );
  }

  async me(user: User) {
    return toOwnerUser(user);
  }

  async updateMe(user: User, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: dto.displayName?.trim(),
        bio: dto.bio,
        location: dto.location?.trim(),
        website: dto.website === '' ? null : dto.website,
        birthday:
          dto.birthday === undefined
            ? undefined
            : dto.birthday
              ? new Date(dto.birthday)
              : null,
        onboardedAt: dto.onboarded ? new Date() : undefined,
        privacy: dto.privacy,
        avatarUrl: dto.avatarUrl === undefined ? undefined : toStoredKey(dto.avatarUrl),
        coverUrl: dto.coverUrl === undefined ? undefined : toStoredKey(dto.coverUrl),
      },
    });
    return toOwnerUser(updated);
  }

  async changeUsername(user: User, usernameRaw: string) {
    const username = usernameRaw.trim().toLowerCase();
    const error = usernameError(username);
    if (error) throw new BadRequestException(error);
    if (username === user.username) return toOwnerUser(user);
    if (user.usernameChangedAt) {
      const next = user.usernameChangedAt.getTime() + USERNAME_COOLDOWN_MS;
      if (next > Date.now()) {
        throw new HttpException(
          'Username can only be changed once every 30 days',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { username, usernameChangedAt: new Date() },
      });
      return toOwnerUser(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Username already in use');
      }
      throw err;
    }
  }

  async profile(viewer: User, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.banned) throw new NotFoundException('User not found');
    const blockedByThem = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: user.id, blockedId: viewer.id },
      },
    });
    if (blockedByThem) throw new NotFoundException('User not found');
    const [followers, following, friends, follow, iBlocked, muted] =
      await Promise.all([
        this.prisma.follow.count({
          where: { followingId: user.id, status: 'ACCEPTED' },
        }),
        this.prisma.follow.count({
          where: { followerId: user.id, status: 'ACCEPTED' },
        }),
        this.prisma.friendship.count({
          where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
        }),
        this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewer.id,
              followingId: user.id,
            },
          },
        }),
        this.prisma.block.findUnique({
          where: {
            blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id },
          },
        }),
        this.prisma.mute.findUnique({
          where: { muterId_mutedId: { muterId: viewer.id, mutedId: user.id } },
        }),
      ]);
    const [a, b] = [viewer.id, user.id].sort();
    const friendship =
      viewer.id === user.id
        ? null
        : await this.prisma.friendship.findUnique({
            where: { userAId_userBId: { userAId: a, userBId: b } },
          });
    return {
      ...toPublicUser(user),
      followerCount: followers,
      followingCount: following,
      friendCount: friends,
      followStatus: follow?.status ?? null,
      isFriend: !!friendship,
      blocked: !!iBlocked,
      muted: !!muted,
    };
  }

  async exportData(user: User) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        posts: true,
        comments: true,
        likes: true,
        followers: true,
        following: true,
        reposts: true,
        messages: { take: 5000, orderBy: { createdAt: 'desc' } },
        notifications: { take: 1000, orderBy: { createdAt: 'desc' } },
        reports: true,
        callsMade: true,
        callsReceived: true,
        liveStreams: true,
      },
    });
    if (!full) throw new NotFoundException();
    const { passwordHash: _hidden, ...profile } = full;
    return {
      exportedAt: new Date().toISOString(),
      profile: toOwnerUser(profile),
      posts: full.posts,
      comments: full.comments,
      likes: full.likes,
      followers: full.followers,
      following: full.following,
      reposts: full.reposts,
      messages: full.messages,
      notifications: full.notifications,
      reports: full.reports,
      calls: [...full.callsMade, ...full.callsReceived],
      liveStreams: full.liveStreams,
    };
  }

  async deleteMe(user: User, confirmation: string, password?: string) {
    if (confirmation !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm');
    }
    if (user.passwordHash) {
      if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid login details');
      }
    }
    await this.tokens.revokeAll(user.id);
    await this.prisma.user.delete({ where: { id: user.id } });
    return { ok: true };
  }

  async followers(viewer: User, username: string) {
    const user = await this.requireVisible(viewer, username);
    const rows = await this.prisma.follow.findMany({
      where: { followingId: user.id, status: 'ACCEPTED' },
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => toPublicUser(row.follower));
  }

  async following(viewer: User, username: string) {
    const user = await this.requireVisible(viewer, username);
    const rows = await this.prisma.follow.findMany({
      where: { followerId: user.id, status: 'ACCEPTED' },
      include: { following: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => toPublicUser(row.following));
  }

  private async requireVisible(viewer: User, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.banned) throw new NotFoundException('User not found');
    if (await this.access.isBlocked(viewer.id, user.id)) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
