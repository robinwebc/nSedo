import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { toPublicUser } from '../common/user.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from './realtime.bus';

type SignalBody = {
  callId?: string;
  streamId?: string;
  toUserId?: string;
  type?: string;
  sdp?: unknown;
  candidate?: unknown;
};

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  private readonly liveViewers = new Map<string, Map<string, string>>();
  private readonly liveHosts = new Map<string, string>();
  private readonly viewerLimit = 5;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  afterInit(server: Server) {
    this.bus.attach(server);
  }

  handleDisconnect(client: Socket) {
    for (const [streamId, members] of this.liveViewers) {
      if (!members.delete(client.id)) continue;
      this.emitViewerCount(streamId);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.readToken(client);
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(
        token,
      );
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || user.banned) {
        client.disconnect();
        return;
      }
      client.data.userId = user.id;
      await client.join(`user:${user.id}`);
      client.emit('ready', { userId: user.id });
    } catch (error) {
      this.logger.debug(`Socket rejected: ${String(error)}`);
      client.disconnect();
    }
  }

  private readToken(client: Socket) {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    throw new Error('Missing token');
  }

  private userId(client: Socket) {
    const id = client.data.userId;
    return typeof id === 'string' ? id : null;
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = this.userId(client);
    if (!userId || !body?.conversationId) return { ok: false };
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: body.conversationId,
        participants: { some: { userId } },
      },
      include: { participants: true },
    });
    if (!conversation) return { ok: false };
    for (const participant of conversation.participants) {
      if (participant.userId !== userId) {
        this.bus.toUser(participant.userId, 'typing', {
          conversationId: conversation.id,
          userId,
        });
      }
    }
    return { ok: true };
  }

  @SubscribeMessage('message:read')
  async read(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = this.userId(client);
    if (!userId || !body?.conversationId) return { ok: false };
    const now = new Date();
    const updated = await this.prisma.conversationParticipant.updateMany({
      where: { conversationId: body.conversationId, userId },
      data: { lastReadAt: now },
    });
    if (updated.count === 0) return { ok: false };
    await this.prisma.message.updateMany({
      where: {
        conversationId: body.conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: now },
    });
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: body.conversationId },
    });
    for (const participant of participants) {
      if (participant.userId !== userId) {
        this.bus.toUser(participant.userId, 'message:read', {
          conversationId: body.conversationId,
          userId,
          readAt: now,
        });
      }
    }
    return { ok: true };
  }

  @SubscribeMessage('call:signal')
  async callSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalBody,
  ) {
    const userId = this.userId(client);
    if (!userId || !body?.callId || !body.toUserId || !body.type) {
      return { ok: false };
    }
    const call = await this.prisma.callLog.findUnique({
      where: { id: body.callId },
    });
    if (!call) return { ok: false };
    const party = new Set([call.callerId, call.calleeId]);
    if (!party.has(userId) || !party.has(body.toUserId)) return { ok: false };
    this.bus.toUser(body.toUserId, 'call:signal', {
      callId: call.id,
      fromUserId: userId,
      type: body.type,
      sdp: body.sdp,
      candidate: body.candidate,
    });
    return { ok: true };
  }

  @SubscribeMessage('live:join')
  async liveJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { streamId?: string },
  ) {
    const userId = this.userId(client);
    if (!userId || !body?.streamId) return { ok: false };
    const stream = await this.prisma.liveStream.findUnique({
      where: { id: body.streamId },
    });
    if (!stream || stream.status !== 'LIVE') return { ok: false };
    this.liveHosts.set(stream.id, stream.hostId);
    const members = this.liveViewers.get(stream.id) ?? new Map<string, string>();
    const already = [...members.values()].includes(userId);
    const viewers = new Set([...members.values()].filter((id) => id !== stream.hostId));
    if (!already && userId !== stream.hostId && viewers.size >= this.viewerLimit) {
      return { ok: false, error: 'This live is full' };
    }
    members.set(client.id, userId);
    this.liveViewers.set(stream.id, members);
    await client.join(`live:${stream.id}`);
    this.emitViewerCount(stream.id);
    if (userId !== stream.hostId) {
      this.bus.toUser(stream.hostId, 'live:viewer-joined', {
        streamId: stream.id,
        viewerId: userId,
      });
    }
    return { ok: true, hostId: stream.hostId, viewerCount: this.countViewers(stream.id) };
  }

  @SubscribeMessage('live:signal')
  async liveSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalBody,
  ) {
    const userId = this.userId(client);
    if (!userId || !body?.streamId || !body.toUserId || !body.type) {
      return { ok: false };
    }
    const stream = await this.prisma.liveStream.findUnique({
      where: { id: body.streamId },
    });
    if (!stream || stream.status !== 'LIVE') return { ok: false };
    if (userId !== stream.hostId && body.toUserId !== stream.hostId) {
      return { ok: false };
    }
    this.bus.toUser(body.toUserId, 'live:signal', {
      streamId: stream.id,
      fromUserId: userId,
      type: body.type,
      sdp: body.sdp,
      candidate: body.candidate,
    });
    return { ok: true };
  }

  @SubscribeMessage('live:comment')
  async liveComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { streamId?: string; body?: string },
  ) {
    const userId = this.userId(client);
    const text = body?.body?.trim() ?? '';
    if (!userId || !body?.streamId || text.length < 1 || text.length > 300) {
      return { ok: false };
    }
    const stream = await this.prisma.liveStream.findUnique({
      where: { id: body.streamId },
    });
    if (!stream || stream.status !== 'LIVE') return { ok: false };
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.banned) return { ok: false };
    const comment = await this.prisma.liveComment.create({
      data: { streamId: stream.id, userId, body: text },
    });
    const payload = {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      user: toPublicUser(user),
    };
    this.bus.toRoom(`live:${stream.id}`, 'live:comment', payload);
    return { ok: true, comment: payload };
  }

  @SubscribeMessage('live:end')
  async liveEnd(@ConnectedSocket() client: Socket, @MessageBody() body: { streamId?: string }) {
    const userId = this.userId(client);
    if (!userId || !body?.streamId) return { ok: false };
    const stream = await this.prisma.liveStream.findUnique({ where: { id: body.streamId } });
    if (!stream || stream.hostId !== userId) return { ok: false };
    await this.prisma.liveStream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    this.liveViewers.delete(stream.id);
    this.liveHosts.delete(stream.id);
    this.bus.toRoom(`live:${stream.id}`, 'live:ended', { streamId: stream.id });
    return { ok: true };
  }

  private countViewers(streamId: string) {
    const members = this.liveViewers.get(streamId);
    if (!members) return 0;
    const hostId = this.liveHosts.get(streamId);
    return new Set([...members.values()].filter((id) => id !== hostId)).size;
  }

  private emitViewerCount(streamId: string) {
    this.bus.toRoom(`live:${streamId}`, 'live:viewers', {
      streamId,
      count: this.countViewers(streamId),
    });
  }
}
