import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { processImage } from './image.pipeline';
import { kindForMime, objectKey, resolveSafeKey, uploadError } from './media.rules';
import { StorageService } from './storage.service';

type UploadScope = 'avatar' | 'cover' | 'post' | 'message';

@Injectable()
export class MediaService {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async presign(
    userId: string,
    mime: string,
    size: number,
    filename: string,
    scope: UploadScope = 'message',
    ownerId?: string,
  ) {
    const error = uploadError(mime, size);
    if (error) throw new BadRequestException(error);
    const kind = kindForMime(mime)!;
    const ext = this.extension(filename, mime);
    const owner = await this.ownerFor(userId, scope, ownerId);
    const key = objectKey(this.folder(scope), owner, ext);
    const signed = await this.storage.presignPut(key, mime, size);
    if (signed) return { ...signed, kind };
    return {
      mode: 'local' as const,
      key,
      method: 'POST' as const,
      uploadUrl: '',
      headers: { 'Content-Type': mime },
      publicUrl: this.storage.publicUrl(key),
      kind,
    };
  }

  async saveLocal(
    userId: string,
    mime: string,
    originalName: string,
    body: Buffer,
    scope: UploadScope = 'message',
    postId?: string,
  ) {
    const error = uploadError(mime, body.length);
    if (error) throw new BadRequestException(error);
    const ext = this.extension(originalName, mime);
    const owner = await this.ownerFor(userId, scope, postId);
    const key = objectKey(this.folder(scope), owner, ext);
    return this.storeProcessed(key, mime, body);
  }

  async finalize(userId: string, key: string) {
    const safe = resolveSafeKey(userId, key);
    if (!safe) throw new BadRequestException('Unknown upload');
    if (safe.startsWith('posts/')) {
      await this.ownerFor(userId, 'post', safe.split('/')[1]);
    }
    const head = await this.storage.head(safe);
    const mime = head.contentType || this.mimeFromKey(safe);
    const error = uploadError(mime, head.size);
    if (error) throw new BadRequestException(error);
    if (kindForMime(mime) === 'IMAGE') {
      const original = await this.storage.get(safe);
      return this.storeProcessed(safe, mime, original);
    }
    return {
      key: safe,
      url: this.storage.publicUrl(safe),
      mimeType: mime,
      kind: 'VIDEO' as const,
      width: null,
      height: null,
      blurhash: null,
    };
  }

  private async storeProcessed(key: string, mime: string, body: Buffer) {
    if (kindForMime(mime) === 'IMAGE') {
      const image = await processImage(body);
      await this.storage.put(key, image.buffer, image.mimeType);
      return {
        key,
        url: this.storage.publicUrl(key),
        mimeType: image.mimeType,
        kind: 'IMAGE' as const,
        width: image.width,
        height: image.height,
        blurhash: image.blurhash,
      };
    }
    await this.storage.put(key, body, mime);
    return {
      key,
      url: this.storage.publicUrl(key),
      mimeType: mime,
      kind: 'VIDEO' as const,
      width: null,
      height: null,
      blurhash: null,
    };
  }

  private folder(scope: UploadScope) {
    if (scope === 'avatar') return 'avatars' as const;
    if (scope === 'cover') return 'covers' as const;
    if (scope === 'post') return 'posts' as const;
    return 'messages' as const;
  }

  private async ownerFor(userId: string, scope: UploadScope, postId?: string) {
    if (scope !== 'post') return userId;
    if (!postId) throw new BadRequestException('A post id is required');
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) throw new BadRequestException('Unknown upload');
    return post.id;
  }

  private extension(filename: string, mime: string) {
    const fromName = extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(fromName)) {
      return fromName === '.jpeg' ? '.jpg' : fromName;
    }
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };
    return map[mime] ?? '';
  }

  private mimeFromKey(key: string) {
    const ext = extname(key).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
