import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, type User } from '@prisma/client';
import { isAdminEmail } from '../common/admin-email';
import { toPublicUser } from '../common/user.serializer';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
    private readonly liveStreams: LiveService,
  ) {}

  private async audit(
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, metadata },
    });
  }

  async stats() {
    const [users, bannedUsers, posts, comments, openReports, liveStreams, messages] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { banned: true } }),
        this.prisma.post.count(),
        this.prisma.comment.count(),
        this.prisma.report.count({ where: { status: 'OPEN' } }),
        this.prisma.liveStream.count({ where: { status: 'LIVE' } }),
        this.prisma.message.count(),
      ]);
    return {
      users,
      bannedUsers,
      posts,
      comments,
      openReports,
      liveStreams,
      messages,
    };
  }

  async users(q?: string) {
    const query = q?.trim();
    const rows = await this.prisma.user.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
              { userId: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((user) => ({
      ...toPublicUser(user),
      email: user.email,
      phone: user.phone,
      banned: user.banned,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    }));
  }

  async setBan(actor: User, id: string, banned: boolean) {
    const target = await this.requireUser(id);
    if (isAdminEmail(target.email, this.config.get<string>('ADMIN_EMAILS'))) {
      throw new ForbiddenException('Configured super admins cannot be banned');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { banned },
    });
    if (banned) await this.tokens.revokeAll(id);
    await this.audit(actor.id, banned ? 'user.ban' : 'user.unban', 'USER', id);
    return { id: updated.id, banned: updated.banned };
  }

  async setBadge(actor: User, id: string, verifiedBadge: boolean) {
    await this.requireUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { verifiedBadge },
    });
    await this.audit(actor.id, 'user.verify', 'USER', id, { verifiedBadge });
    return { id: updated.id, verifiedBadge: updated.verifiedBadge };
  }

  async setRole(actor: User, id: string, role: Role) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can change roles');
    }
    const target = await this.requireUser(id);
    if (
      isAdminEmail(target.email, this.config.get<string>('ADMIN_EMAILS')) &&
      role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Configured super admins cannot be demoted');
    }
    if (actor.id === target.id && role !== Role.ADMIN) {
      throw new ForbiddenException('You cannot remove your own admin role');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    await this.audit(actor.id, 'user.role', 'USER', id, {
      from: target.role,
      to: role,
    });
    return { id: updated.id, role: updated.role };
  }

  async posts() {
    const rows = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: true,
        _count: { select: { likes: true, comments: true, reposts: true } },
      },
    });
    return rows.map((post) => ({
      id: post.id,
      body: post.body,
      mediaUrl: post.mediaUrl,
      privacy: post.privacy,
      createdAt: post.createdAt,
      author: toPublicUser(post.author),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      repostCount: post._count.reposts,
    }));
  }

  async deletePost(actor: User, id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.post.delete({ where: { id } });
    await this.audit(actor.id, 'post.delete', 'POST', id);
    return { ok: true };
  }

  async comments() {
    const rows = await this.prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: true, post: true },
    });
    return rows.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      postId: comment.postId,
      user: toPublicUser(comment.user),
    }));
  }

  async deleteComment(actor: User, id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comment.delete({ where: { id } });
    await this.audit(actor.id, 'comment.delete', 'COMMENT', id);
    return { ok: true };
  }

  async reports() {
    const rows = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { reporter: true },
    });
    return rows.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      reporter: toPublicUser(report.reporter),
    }));
  }

  async resolveReport(
    actor: User,
    id: string,
    status: 'RESOLVED' | 'DISMISSED',
  ) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status },
    });
    await this.audit(actor.id, 'report.update', 'REPORT', id, { status });
    return { id: updated.id, status: updated.status };
  }

  async listLive() {
    return this.liveStreams.list();
  }

  async endLive(actor: User, id: string) {
    const result = await this.liveStreams.end(actor, id, true);
    await this.audit(actor.id, 'live.end', 'LIVE', id);
    return result;
  }

  async auditLog() {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: true },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor: toPublicUser(row.actor),
    }));
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
