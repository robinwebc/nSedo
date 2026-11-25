import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportTarget, type User } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { toPublicUser } from '../common/user.serializer';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async byUsername(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.banned) throw new NotFoundException('User not found');
    return user;
  }

  async follow(me: User, username: string) {
    const target = await this.byUsername(username);
    if (target.id === me.id) {
      throw new BadRequestException('You cannot follow yourself');
    }
    if (await this.access.isBlocked(me.id, target.id)) {
      throw new ForbiddenException('You cannot follow this account');
    }
    const status = target.privacy === 'PRIVATE' ? 'PENDING' : 'ACCEPTED';
    const follow = await this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: me.id, followingId: target.id },
      },
      create: { followerId: me.id, followingId: target.id, status },
      update: { status },
    });
    await this.notifications.push({
      userId: target.id,
      actorId: me.id,
      type: 'FOLLOW',
      entityId: follow.id,
      body:
        status === 'PENDING'
          ? 'requested to follow you'
          : 'started following you',
    });
    return { status: follow.status };
  }

  async unfollow(me: User, username: string) {
    const target = await this.byUsername(username);
    await this.prisma.follow.deleteMany({
      where: { followerId: me.id, followingId: target.id },
    });
    return { ok: true };
  }

  async followRequests(me: User) {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: me.id, status: 'PENDING' },
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      user: toPublicUser(row.follower),
    }));
  }

  async acceptFollow(me: User, id: string) {
    const row = await this.prisma.follow.findUnique({ where: { id } });
    if (!row || row.followingId !== me.id) {
      throw new NotFoundException('Follow request not found');
    }
    const updated = await this.prisma.follow.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
    await this.notifications.push({
      userId: row.followerId,
      actorId: me.id,
      type: 'FOLLOW',
      entityId: row.id,
      body: 'accepted your follow request',
    });
    return { status: updated.status };
  }

  async declineFollow(me: User, id: string) {
    const row = await this.prisma.follow.findUnique({ where: { id } });
    if (!row || row.followingId !== me.id) {
      throw new NotFoundException('Follow request not found');
    }
    await this.prisma.follow.delete({ where: { id } });
    return { ok: true };
  }

  async requestFriend(me: User, username: string) {
    const target = await this.byUsername(username);
    if (target.id === me.id) {
      throw new BadRequestException('You cannot friend yourself');
    }
    if (await this.access.isBlocked(me.id, target.id)) {
      throw new ForbiddenException('You cannot friend this account');
    }
    const reverse = await this.prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: target.id, toId: me.id } },
    });
    if (reverse?.status === 'PENDING') {
      return this.acceptFriend(me, reverse.id);
    }
    const existing = await this.prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: me.id, toId: target.id } },
    });
    if (existing?.status === 'ACCEPTED') return { status: 'ACCEPTED' as const };
    const request = existing
      ? await this.prisma.friendRequest.update({
          where: { id: existing.id },
          data: { status: 'PENDING' },
        })
      : await this.prisma.friendRequest.create({
          data: { fromId: me.id, toId: target.id },
        });
    await this.notifications.push({
      userId: target.id,
      actorId: me.id,
      type: 'FRIEND_REQUEST',
      entityId: request.id,
      body: 'sent you a friend request',
    });
    return { status: request.status, id: request.id };
  }

  async friendRequests(me: User) {
    const rows = await this.prisma.friendRequest.findMany({
      where: { toId: me.id, status: 'PENDING' },
      include: { from: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      user: toPublicUser(row.from),
    }));
  }

  async acceptFriend(me: User, id: string) {
    const row = await this.prisma.friendRequest.findUnique({ where: { id } });
    if (!row || row.toId !== me.id) {
      throw new NotFoundException('Friend request not found');
    }
    const [userAId, userBId] = [row.fromId, row.toId].sort();
    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        create: { userAId, userBId },
        update: {},
      }),
    ]);
    await this.notifications.push({
      userId: row.fromId,
      actorId: me.id,
      type: 'FRIEND_REQUEST',
      entityId: row.id,
      body: 'accepted your friend request',
    });
    return { status: 'ACCEPTED' as const };
  }

  async declineFriend(me: User, id: string) {
    const row = await this.prisma.friendRequest.findUnique({ where: { id } });
    if (!row || row.toId !== me.id) {
      throw new NotFoundException('Friend request not found');
    }
    await this.prisma.friendRequest.update({
      where: { id },
      data: { status: 'DECLINED' },
    });
    return { status: 'DECLINED' as const };
  }

  async friends(me: User) {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
      include: { userA: true, userB: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) =>
      toPublicUser(row.userAId === me.id ? row.userB : row.userA),
    );
  }

  async block(me: User, username: string) {
    const target = await this.byUsername(username);
    if (target.id === me.id) {
      throw new BadRequestException('You cannot block yourself');
    }
    await this.prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId: me.id, blockedId: target.id },
      },
      create: { blockerId: me.id, blockedId: target.id },
      update: {},
    });
    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: me.id, followingId: target.id },
          { followerId: target.id, followingId: me.id },
        ],
      },
    });
    return { ok: true };
  }

  async unblock(me: User, username: string) {
    const target = await this.byUsername(username);
    await this.prisma.block.deleteMany({
      where: { blockerId: me.id, blockedId: target.id },
    });
    return { ok: true };
  }

  async blocked(me: User) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: me.id },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toPublicUser(row.blocked));
  }

  async mute(me: User, username: string) {
    const target = await this.byUsername(username);
    if (target.id === me.id) {
      throw new BadRequestException('You cannot mute yourself');
    }
    await this.prisma.mute.upsert({
      where: { muterId_mutedId: { muterId: me.id, mutedId: target.id } },
      create: { muterId: me.id, mutedId: target.id },
      update: {},
    });
    return { ok: true };
  }

  async unmute(me: User, username: string) {
    const target = await this.byUsername(username);
    await this.prisma.mute.deleteMany({
      where: { muterId: me.id, mutedId: target.id },
    });
    return { ok: true };
  }

  async muted(me: User) {
    const rows = await this.prisma.mute.findMany({
      where: { muterId: me.id },
      include: { muted: true },
    });
    return rows.map((row) => toPublicUser(row.muted));
  }

  async report(
    me: User,
    targetType: ReportTarget,
    targetId: string,
    reason: string,
  ) {
    const report = await this.prisma.report.create({
      data: {
        reporterId: me.id,
        targetType,
        targetId,
        reason: reason.trim(),
      },
    });
    return { id: report.id, status: report.status };
  }
}
