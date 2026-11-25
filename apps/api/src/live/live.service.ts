import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type User } from '@prisma/client';
import { toPublicUser } from '../common/user.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  async start(me: User, title: string) {
    await this.prisma.liveStream.updateMany({
      where: { hostId: me.id, status: 'LIVE' },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    const stream = await this.prisma.liveStream.create({
      data: { hostId: me.id, title: title.trim() },
      include: { host: true },
    });
    return this.present(stream);
  }

  async list() {
    const rows = await this.prisma.liveStream.findMany({
      where: { status: 'LIVE', host: { banned: false } },
      orderBy: { startedAt: 'desc' },
      include: { host: true, _count: { select: { comments: true } } },
    });
    return rows.map((row) => ({
      ...this.present(row),
      commentCount: row._count.comments,
    }));
  }

  async get(id: string) {
    const stream = await this.prisma.liveStream.findUnique({
      where: { id },
      include: {
        host: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: { user: true },
        },
      },
    });
    if (!stream) throw new NotFoundException('Live stream not found');
    return {
      ...this.present(stream),
      comments: stream.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        user: toPublicUser(comment.user),
      })),
    };
  }

  async end(me: User, id: string, asModerator = false) {
    const stream = await this.prisma.liveStream.findUnique({ where: { id } });
    if (!stream) throw new NotFoundException('Live stream not found');
    if (!asModerator && stream.hostId !== me.id) {
      throw new ForbiddenException('Only the host can end this live');
    }
    const updated = await this.prisma.liveStream.update({
      where: { id },
      data: { status: 'ENDED', endedAt: new Date() },
      include: { host: true },
    });
    this.bus.toRoom(`live:${id}`, 'live:ended', { streamId: id });
    return this.present(updated);
  }

  async comment(me: User, id: string, body: string) {
    const stream = await this.prisma.liveStream.findUnique({ where: { id } });
    if (!stream || stream.status !== 'LIVE') {
      throw new NotFoundException('Live stream not found');
    }
    const comment = await this.prisma.liveComment.create({
      data: { streamId: id, userId: me.id, body: body.trim() },
    });
    const payload = {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      user: toPublicUser(me),
    };
    this.bus.toRoom(`live:${id}`, 'live:comment', payload);
    return payload;
  }

  private present(stream: {
    id: string;
    title: string;
    status: 'LIVE' | 'ENDED';
    startedAt: Date;
    endedAt: Date | null;
    host: User;
  }) {
    return {
      id: stream.id,
      title: stream.title,
      status: stream.status,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
      host: toPublicUser(stream.host),
    };
  }
}
