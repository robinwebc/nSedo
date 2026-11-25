import { encode } from 'blurhash';
import sharp from 'sharp';

export async function processImage(input: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  blurhash: string | null;
}> {
  const oriented = sharp(input, { failOn: 'none' }).rotate();
  const meta = await oriented.metadata();
  const format = meta.format;
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  let mimeType = 'image/jpeg';
  if (format === 'png') {
    pipeline = pipeline.png();
    mimeType = 'image/png';
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 82 });
    mimeType = 'image/webp';
  } else if (format === 'gif') {
    pipeline = pipeline.gif();
    mimeType = 'image/gif';
  } else {
    pipeline = pipeline.jpeg({ quality: 82 });
  }
  const buffer = await pipeline.toBuffer();
  const info = await sharp(buffer).metadata();
  const width = info.width ?? meta.width ?? 1;
  const height = info.height ?? meta.height ?? 1;
  let blurhash: string | null = null;
  try {
    const raw = await sharp(buffer)
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    blurhash = encode(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height, 4, 3);
  } catch {
    blurhash = null;
  }
  return { buffer, mimeType, width, height, blurhash };
}
