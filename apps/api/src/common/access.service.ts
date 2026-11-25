import { Injectable } from '@nestjs/common';
import { Privacy } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async isBlocked(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return !!row;
  }

  async followsAccepted(followerId: string, followingId: string) {
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return row?.status === 'ACCEPTED';
  }

  async canViewPost(
    viewerId: string | null,
    post: {
      authorId: string;
      privacy: Privacy;
      author: { privacy: Privacy; banned: boolean };
    },
  ): Promise<boolean> {
    if (post.author.banned && viewerId !== post.authorId) return false;
    if (viewerId && viewerId === post.authorId) return true;
    if (viewerId && (await this.isBlocked(viewerId, post.authorId))) {
      return false;
    }
    const restricted =
      post.privacy === 'PRIVATE' || post.author.privacy === 'PRIVATE';
    if (!restricted) return true;
    if (!viewerId) return false;
    return this.followsAccepted(viewerId, post.authorId);
  }

  async hiddenAuthorIds(viewerId: string): Promise<string[]> {
    const [blocks, mutes] = await Promise.all([
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      }),
      this.prisma.mute.findMany({
        where: { muterId: viewerId },
        select: { mutedId: true },
      }),
    ]);
    const ids = new Set<string>(mutes.map((mute) => mute.mutedId));
    for (const block of blocks) {
      ids.add(block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }
    return [...ids];
  }
}
