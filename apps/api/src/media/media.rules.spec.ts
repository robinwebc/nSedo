import {
  expandPublicUrl,
  objectKey,
  postMediaError,
  resolveSafeKey,
  storageMode,
  toStoredKey,
  uploadError,
} from './media.rules';

describe('media rules', () => {
  const base = {
    url: 'https://cdn.example/a.jpg',
    mimeType: 'image/jpeg',
    kind: 'IMAGE' as const,
  };

  it('uses S3 only when bucket and keys are set', () => {
    expect(storageMode({})).toBe('local');
    expect(storageMode({ S3_BUCKET: 'b', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: 's' })).toBe('local');
    expect(
      storageMode({ S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' }),
    ).toBe('s3');
  });

  it('rejects oversized and unknown uploads', () => {
    expect(uploadError('image/jpeg', 100)).toBeNull();
    expect(uploadError('image/jpeg', 11 * 1024 * 1024)).toMatch(/10 MB/);
    expect(uploadError('video/mp4', 51 * 1024 * 1024)).toMatch(/50 MB/);
    expect(uploadError('application/pdf', 100)).toMatch(/JPEG/);
  });

  it('limits a post to 4 photos or 1 video', () => {
    expect(postMediaError([base, base, base, base])).toBeNull();
    expect(postMediaError([base, base, base, base, base])).toMatch(/4 photos/);
    expect(
      postMediaError([
        { ...base, kind: 'VIDEO', mimeType: 'video/mp4', durationMs: 59_000 },
      ]),
    ).toBeNull();
    expect(
      postMediaError([
        { ...base, kind: 'VIDEO', mimeType: 'video/mp4', durationMs: 61_000 },
      ]),
    ).toMatch(/60 seconds/);
    expect(
      postMediaError([
        { ...base, kind: 'VIDEO', mimeType: 'video/mp4' },
        base,
      ]),
    ).toMatch(/cannot include other/);
  });

  it('keeps object keys inside the owner prefix', () => {
    expect(resolveSafeKey('user_1', 'avatars/user_1/photo.jpg')).toBe('avatars/user_1/photo.jpg');
    expect(resolveSafeKey('user_1', 'covers/user_1/photo.jpg')).toBe('covers/user_1/photo.jpg');
    expect(resolveSafeKey('user_1', 'posts/post_1/clip.mp4')).toBe('posts/post_1/clip.mp4');
    expect(resolveSafeKey('user_1', '../secret')).toBeNull();
    expect(resolveSafeKey('user_1', 'avatars/other/photo.jpg')).toBeNull();
  });

  it('builds a public URL from S3_PUBLIC_URL and the stored key', () => {
    const previous = {
      S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    };
    process.env.S3_BUCKET = 'nsedo-media';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    process.env.S3_PUBLIC_URL = 'https://cdn.example/nsedo-media';
    expect(expandPublicUrl('avatars/user_1/a.jpg')).toBe(
      'https://cdn.example/nsedo-media/avatars/user_1/a.jpg',
    );
    expect(toStoredKey('https://cdn.example/nsedo-media/avatars/user_1/a.jpg')).toBe(
      'avatars/user_1/a.jpg',
    );
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('mints a new object key for every upload', () => {
    const first = objectKey('avatars', 'user_1', '.jpg');
    const second = objectKey('posts', 'post_1', 'mp4');
    expect(first).toMatch(/^avatars\/user_1\/[0-9a-f-]{36}\.jpg$/);
    expect(second).toMatch(/^posts\/post_1\/[0-9a-f-]{36}\.mp4$/);
    expect(first).not.toBe(objectKey('avatars', 'user_1', '.jpg'));
  });
});
