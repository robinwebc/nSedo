import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Post, Privacy, type User } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { publicUserSelect, toPublicUser } from '../common/user.serializer';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto';

const postInclude = (viewerId: string) => ({
  author: { select: publicUserSelect },
  _count: { select: { likes: true, comments: true, reposts: true } },
  likes: { where: { userId: viewerId }, select: { id: true } },
  reposts: {
    where: { userId: viewerId, quote: null },
    select: { id: true },
  },
});

type IncludedPost = Post & {
  author: {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    role: User['role'];
    privacy: Privacy;
    verifiedBadge: boolean;
    banned: boolean;
    createdAt: Date;
  };
  _count: { likes: number; comments: number; reposts: number };
  likes: { id: string }[];
  reposts: { id: string }[];
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private shareUrl(id: string) {
    const base = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/p/${id}`;
  }

  present(post: IncludedPost) {
    return {
      id: post.id,
      body: post.body,
      mediaUrl: post.mediaUrl,
      privacy: post.privacy,
      createdAt: post.createdAt,
      shareUrl: this.shareUrl(post.id),
      author: toPublicUser(post.author),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      repostCount: post._count.reposts,
      likedByMe: post.likes.length > 0,
      repostedByMe: post.reposts.length > 0,
    };
  }

  private async load(id: string, viewerId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude(viewerId),
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!(await this.access.canViewPost(viewerId, post))) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async create(user: User, dto: CreatePostDto) {
    if (!dto.body && !dto.mediaUrl) {
      throw new BadRequestException('Write something or attach an image');
    }
    const post = await this.prisma.post.create({
      data: {
        authorId: user.id,
        body: dto.body?.trim(),
        mediaUrl: dto.mediaUrl,
        privacy: dto.privacy ?? user.privacy,
      },
      include: postInclude(user.id),
    });
    return this.present(post);
  }

  async get(user: User, id: string) {
    return this.present(await this.load(id, user.id));
  }

  async remove(user: User, id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own post');
    }
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }

  async feed(user: User, take: number, skip: number) {
    const hidden = new Set(await this.access.hiddenAuthorIds(user.id));
    const following = await this.prisma.follow.findMany({
      where: { followerId: user.id, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const ids = [user.id, ...following.map((row) => row.followingId)].filter(
      (id) => id === user.id || !hidden.has(id),
    );
    const [posts, reposts] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId: { in: ids }, author: { banned: false } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: postInclude(user.id),
      }),
      this.prisma.repost.findMany({
        where: { userId: { in: ids }, user: { banned: false } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: true,
          post: { include: postInclude(user.id) },
        },
      }),
    ]);
    const visiblePosts = [];
    for (const post of posts) {
      if (await this.access.canViewPost(user.id, post)) {
        visiblePosts.push({
          kind: 'post' as const,
          createdAt: post.createdAt,
          post: this.present(post),
        });
      }
    }
    const visibleReposts = [];
    for (const repost of reposts) {
      if (hidden.has(repost.post.authorId)) continue;
      if (!(await this.access.canViewPost(user.id, repost.post))) continue;
      visibleReposts.push({
        kind: 'repost' as const,
        createdAt: repost.createdAt,
        post: this.present(repost.post),
        repost: {
          id: repost.id,
          quote: repost.quote,
          createdAt: repost.createdAt,
          user: toPublicUser(repost.user),
        },
      });
    }
    return [...visiblePosts, ...visibleReposts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);
  }

  async explore(user: User, take: number, skip: number) {
    const hidden = await this.access.hiddenAuthorIds(user.id);
    const posts = await this.prisma.post.findMany({
      where: {
        privacy: 'PUBLIC',
        author: {
          privacy: 'PUBLIC',
          banned: false,
          id: { notIn: hidden },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: postInclude(user.id),
    });
    return posts.map((post) => this.present(post));
  }

  async byUser(viewer: User, username: string, take: number, skip: number) {
    const author = await this.prisma.user.findUnique({ where: { username } });
    if (!author || author.banned) throw new NotFoundException('User not found');
    if (await this.access.isBlocked(viewer.id, author.id)) {
      throw new NotFoundException('User not found');
    }
    const posts = await this.prisma.post.findMany({
      where: { authorId: author.id },
      orderBy: { createdAt: 'desc' },
      take: take + skip + 20,
      include: postInclude(viewer.id),
    });
    const visible = [];
    for (const post of posts) {
      if (await this.access.canViewPost(viewer.id, post)) {
        visible.push(this.present(post));
      }
    }
    return visible.slice(skip, skip + take);
  }

  async like(user: User, postId: string) {
    const post = await this.load(postId, user.id);
    await this.prisma.like.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      create: { userId: user.id, postId },
      update: {},
    });
    await this.notifications.push({
      userId: post.authorId,
      actorId: user.id,
      type: 'LIKE',
      entityId: post.id,
      body: 'liked your post',
    });
    return this.get(user, postId);
  }

  async unlike(user: User, postId: string) {
    await this.load(postId, user.id);
    await this.prisma.like.deleteMany({
      where: { userId: user.id, postId },
    });
    return this.get(user, postId);
  }

  async comments(user: User, postId: string) {
    await this.load(postId, user.id);
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      user: toPublicUser(row.user),
    }));
  }

  async comment(user: User, postId: string, body: string) {
    const post = await this.load(postId, user.id);
    const comment = await this.prisma.comment.create({
      data: { userId: user.id, postId, body: body.trim() },
      include: { user: true },
    });
    await this.notifications.push({
      userId: post.authorId,
      actorId: user.id,
      type: 'COMMENT',
      entityId: post.id,
      body: 'commented on your post',
    });
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      user: toPublicUser(comment.user),
    };
  }

  async deleteComment(user: User, id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== user.id && user.role === 'USER') {
      throw new ForbiddenException('You can only delete your own comment');
    }
    await this.prisma.comment.delete({ where: { id } });
    return { ok: true };
  }

  async repost(user: User, postId: string, quote?: string) {
    const post = await this.load(postId, user.id);
    if (!quote) {
      const existing = await this.prisma.repost.findFirst({
        where: { userId: user.id, postId, quote: null },
      });
      if (existing) return this.get(user, postId);
    }
    await this.prisma.repost.create({
      data: { userId: user.id, postId, quote: quote?.trim() },
    });
    await this.notifications.push({
      userId: post.authorId,
      actorId: user.id,
      type: 'REPOST',
      entityId: post.id,
      body: quote ? 'quoted your post' : 'reposted your post',
    });
    return this.get(user, postId);
  }

  async unrepost(user: User, postId: string) {
    await this.prisma.repost.deleteMany({
      where: { userId: user.id, postId, quote: null },
    });
    return this.get(user, postId);
  }
}
