import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { toPublicUser } from '../common/user.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  async push(input: {
    userId: string;
    actorId?: string;
    type: NotificationType;
    entityId?: string;
    body?: string;
  }) {
    if (input.actorId && input.actorId === input.userId) return null;
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        entityId: input.entityId,
        body: input.body,
      },
      include: { actor: true },
    });
    this.bus.toUser(input.userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      body: notification.body,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
      actor: notification.actor ? toPublicUser(notification.actor) : null,
    });
    return notification;
  }

  async list(userId: string, take: number, skip: number) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { actor: true },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unreadCount,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        body: item.body,
        entityId: item.entityId,
        readAt: item.readAt,
        createdAt: item.createdAt,
        actor: item.actor ? toPublicUser(item.actor) : null,
      })),
    };
  }

  async read(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
