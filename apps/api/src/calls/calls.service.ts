import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallStatus, CallType, type User } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { toPublicUser } from '../common/user.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
    private readonly bus: RealtimeBus,
  ) {}

  iceConfig() {
    const servers: { urls: string | string[]; username?: string; credential?: string }[] =
      [{ urls: 'stun:stun.l.google.com:19302' }];
    const turn = this.config.get<string>('TURN_URL');
    if (turn) {
      servers.push({
        urls: turn.split(',').map((item) => item.trim()),
        username: this.config.get<string>('TURN_USERNAME') ?? '',
        credential: this.config.get<string>('TURN_CREDENTIAL') ?? '',
      });
    }
    return { iceServers: servers };
  }

  async create(me: User, username: string, type: CallType) {
    const callee = await this.prisma.user.findUnique({ where: { username } });
    if (!callee || callee.banned) throw new NotFoundException('User not found');
    if (callee.id === me.id) {
      throw new BadRequestException('You cannot call yourself');
    }
    if (await this.access.isBlocked(me.id, callee.id)) {
      throw new ForbiddenException('You cannot call this account');
    }
    const call = await this.prisma.callLog.create({
      data: { callerId: me.id, calleeId: callee.id, type, status: 'RINGING' },
    });
    this.bus.toUser(callee.id, 'call:invite', {
      callId: call.id,
      type: call.type,
      from: toPublicUser(me),
    });
    return {
      id: call.id,
      type: call.type,
      status: call.status,
      peer: toPublicUser(callee),
      iceServers: this.iceConfig().iceServers,
    };
  }

  async update(me: User, id: string, status: CallStatus) {
    const call = await this.prisma.callLog.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== me.id && call.calleeId !== me.id) {
      throw new ForbiddenException();
    }
    const updated = await this.prisma.callLog.update({
      where: { id },
      data: {
        status,
        endedAt:
          status === 'ENDED' || status === 'REJECTED' || status === 'MISSED'
            ? new Date()
            : undefined,
      },
    });
    const other = call.callerId === me.id ? call.calleeId : call.callerId;
    this.bus.toUser(other, 'call:status', { callId: id, status });
    return { id: updated.id, status: updated.status };
  }

  async list(me: User) {
    const rows = await this.prisma.callLog.findMany({
      where: { OR: [{ callerId: me.id }, { calleeId: me.id }] },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { caller: true, callee: true },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      peer: toPublicUser(row.callerId === me.id ? row.callee : row.caller),
      direction: row.callerId === me.id ? 'outgoing' : 'incoming',
    }));
  }
}
