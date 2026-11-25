import { randomUUID } from 'crypto';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_MS = 60_000;
export const MAX_PHOTOS = 4;

export type MediaKindName = 'IMAGE' | 'VIDEO';

export type IncomingMedia = {
  url: string;
  mimeType: string;
  kind: MediaKindName;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  blurhash?: string | null;
  thumbnailUrl?: string | null;
};

export function storageMode(env: NodeJS.ProcessEnv = process.env): 's3' | 'local' {
  const bucket = env.S3_BUCKET?.trim();
  const key = env.S3_ACCESS_KEY_ID?.trim();
  const secret = env.S3_SECRET_ACCESS_KEY?.trim();
  if (bucket && key && secret) return 's3';
  return 'local';
}

export function kindForMime(mime: string): MediaKindName | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return 'IMAGE';
  if ((VIDEO_TYPES as readonly string[]).includes(mime)) return 'VIDEO';
  return null;
}

export function resolveSafeKey(userId: string, key: string): string | null {
  if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) return null;
  if (!/^[\w./-]+$/.test(key)) return null;
  const parts = key.split('/');
  if (parts.length !== 3 || !parts[2]) return null;
  const [scope, owner] = parts;
  if (scope === 'avatars' || scope === 'covers' || scope === 'messages') {
    return owner === userId ? key : null;
  }
  if (scope === 'posts') return key;
  return null;
}

export function objectKey(scope: 'avatars' | 'covers' | 'posts' | 'messages', ownerId: string, ext: string) {
  const suffix = ext.startsWith('.') ? ext : `.${ext}`;
  return `${scope}/${ownerId}/${randomUUID()}${suffix}`;
}

export function expandPublicUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;
  const base = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
  if (storageMode() === 's3' && base) return `${base}/${stored}`;
  const local = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  return `${local}/uploads/${stored}`;
}

export function toStoredKey(value?: string | null): string | null {
  if (!value) return null;
  const base = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
  if (base && value.startsWith(`${base}/`)) return value.slice(base.length + 1);
  const local = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const prefix = `${local}/uploads/`;
  if (value.startsWith(prefix)) return value.slice(prefix.length);
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value;
}

export function uploadError(mime: string, size: number): string | null {
  const kind = kindForMime(mime);
  if (!kind) return 'Use a JPEG, PNG, WEBP, GIF, MP4, WEBM, or QuickTime file';
  if (!Number.isFinite(size) || size <= 0) return 'File is empty';
  if (kind === 'IMAGE' && size > MAX_IMAGE_BYTES) return 'Images must be 10 MB or smaller';
  if (kind === 'VIDEO' && size > MAX_VIDEO_BYTES) return 'Videos must be 50 MB or smaller';
  return null;
}

export function postMediaError(items: IncomingMedia[]): string | null {
  if (items.length === 0) return null;
  const videos = items.filter((item) => item.kind === 'VIDEO');
  if (videos.length > 1) return 'A post can include one video';
  if (videos.length === 1 && items.length > 1) return 'A video post cannot include other files';
  if (videos.length === 0 && items.length > MAX_PHOTOS) return 'A post can include up to 4 photos';
  const duration = videos[0]?.durationMs;
  if (duration != null && duration > MAX_VIDEO_MS) return 'Videos must be 60 seconds or shorter';
  for (const item of items) {
    if (kindForMime(item.mimeType) !== item.kind) return 'File type does not match';
    const ref = item.url;
    const keyOk = /^(avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+$/.test(ref);
    const urlOk = ref.startsWith('https://') || ref.startsWith('http://');
    if (!keyOk && !urlOk) return 'Media URL is invalid';
  }
  return null;
}
