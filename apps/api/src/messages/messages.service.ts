import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type User } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { toPublicUser } from '../common/user.serializer';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly bus: RealtimeBus,
  ) {}

  async open(me: User, username: string) {
    const other = await this.prisma.user.findUnique({ where: { username } });
    if (!other || other.banned) throw new NotFoundException('User not found');
    if (other.id === me.id) {
      throw new ForbiddenException('You cannot message yourself');
    }
    if (await this.access.isBlocked(me.id, other.id)) {
      throw new ForbiddenException('You cannot message this account');
    }
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: me.id } } },
          { participants: { some: { userId: other.id } } },
          { participants: { every: { userId: { in: [me.id, other.id] } } } },
        ],
      },
      include: { participants: { include: { user: true } } },
    });
    if (existing) return this.presentConversation(existing, me.id);
    const created = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: me.id }, { userId: other.id }],
        },
      },
      include: { participants: { include: { user: true } } },
    });
    return this.presentConversation(created, me.id);
  }

  private presentConversation(
    conversation: {
      id: string;
      updatedAt: Date;
      participants: { userId: string; lastReadAt: Date | null; user: User }[];
      messages?: { id: string; body: string; createdAt: Date; senderId: string }[];
    },
    meId: string,
  ) {
    return {
      id: conversation.id,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        lastReadAt: participant.lastReadAt,
        user: toPublicUser(participant.user),
      })),
      peer: toPublicUser(
        conversation.participants.find((item) => item.userId !== meId)?.user ??
          conversation.participants[0].user,
      ),
    };
  }

  async list(me: User) {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: me.id } } },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.presentConversation(row, me.id),
      lastMessage: row.messages[0]
        ? {
            id: row.messages[0].id,
            body: row.messages[0].body,
            createdAt: row.messages[0].createdAt,
            senderId: row.messages[0].senderId,
          }
        : null,
    }));
  }

  private async requireMember(conversationId: string, userId: string) {
    const member = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new NotFoundException('Conversation not found');
    return member;
  }

  async messages(me: User, conversationId: string) {
    await this.requireMember(conversationId, me.id);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { sender: true },
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      readAt: row.readAt,
      sender: toPublicUser(row.sender),
    }));
  }

  async send(me: User, conversationId: string, body: string) {
    await this.requireMember(conversationId, me.id);
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
    });
    for (const participant of participants) {
      if (participant.userId !== me.id) {
        if (await this.access.isBlocked(me.id, participant.userId)) {
          throw new ForbiddenException('You cannot message this account');
        }
      }
    }
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: me.id, body: body.trim() },
      include: { sender: true },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    const payload = {
      id: message.id,
      conversationId,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt,
      sender: toPublicUser(message.sender),
    };
    for (const participant of participants) {
      this.bus.toUser(participant.userId, 'message:new', payload);
      if (participant.userId !== me.id) {
        await this.notifications.push({
          userId: participant.userId,
          actorId: me.id,
          type: 'MESSAGE',
          entityId: conversationId,
          body: 'sent you a message',
        });
      }
    }
    return payload;
  }

  async markRead(me: User, conversationId: string) {
    await this.requireMember(conversationId, me.id);
    const now = new Date();
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: me.id },
      },
      data: { lastReadAt: now },
    });
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: me.id }, readAt: null },
      data: { readAt: now },
    });
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
    });
    for (const participant of participants) {
      if (participant.userId !== me.id) {
        this.bus.toUser(participant.userId, 'message:read', {
          conversationId,
          userId: me.id,
          readAt: now,
        });
      }
    }
    return { ok: true, readAt: now };
  }
}
