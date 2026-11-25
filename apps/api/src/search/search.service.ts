import { Injectable } from '@nestjs/common';
import { type User } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { publicUserSelect, toPublicUser } from '../common/user.serializer';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly posts: PostsService,
  ) {}

  async search(viewer: User, q: string) {
    const query = q.trim();
    const hidden = await this.access.hiddenAuthorIds(viewer.id);
    const users = await this.prisma.user.findMany({
      where: {
        banned: false,
        id: { notIn: hidden },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { userId: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    const postRows = await this.prisma.post.findMany({
      where: {
        body: { contains: query, mode: 'insensitive' },
        author: { banned: false, id: { notIn: hidden } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        author: { select: publicUserSelect },
        _count: { select: { likes: true, comments: true, reposts: true } },
        likes: { where: { userId: viewer.id }, select: { id: true } },
        reposts: {
          where: { userId: viewer.id, quote: null },
          select: { id: true },
        },
      },
    });
    const posts = [];
    for (const post of postRows) {
      if (await this.access.canViewPost(viewer.id, post)) {
        posts.push(this.posts.present(post));
      }
    }
    return { users: users.map((user) => toPublicUser(user)), posts };
  }
}
