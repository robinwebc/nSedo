import { Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { storageMode } from './media.rules';

@Injectable()
export class StorageService {
  mode() {
    return storageMode();
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.mode() === 's3') {
      await this.client().send(
        new PutObjectCommand({
          Bucket: this.bucket(),
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return this.publicUrl(key);
    }
    const path = this.localPath(key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    return this.publicUrl(key);
  }

  async get(key: string): Promise<Buffer> {
    if (this.mode() === 's3') {
      const result = await this.client().send(
        new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return Buffer.from(bytes ?? []);
    }
    return readFileSync(this.localPath(key));
  }

  async head(key: string): Promise<{ size: number; contentType: string | undefined }> {
    if (this.mode() === 's3') {
      const result = await this.client().send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: key }),
      );
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    }
    const body = readFileSync(this.localPath(key));
    return { size: body.length, contentType: undefined };
  }

  async presignPut(key: string, contentType: string, size: number) {
    if (this.mode() !== 's3') {
      return null;
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    const uploadUrl = await getSignedUrl(this.client(), command, { expiresIn: 600 });
    return {
      mode: 's3' as const,
      key,
      method: 'PUT' as const,
      uploadUrl,
      headers: { 'Content-Type': contentType },
      publicUrl: this.publicUrl(key),
    };
  }

  publicUrl(key: string) {
    const base = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
    if (this.mode() === 's3' && base) return `${base}/${key}`;
    if (this.mode() === 's3') {
      const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
      const bucket = this.bucket();
      if (process.env.S3_FORCE_PATH_STYLE === 'true' && endpoint) {
        return `${endpoint}/${bucket}/${key}`;
      }
      if (endpoint) {
        const host = endpoint.replace(/^https?:\/\//, '');
        const protocol = endpoint.startsWith('http://') ? 'http' : 'https';
        return `${protocol}://${bucket}.${host}/${key}`;
      }
    }
    const local = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    return `${local}/uploads/${key}`;
  }

  private bucket() {
    return process.env.S3_BUCKET!.trim();
  }

  private client() {
    return new S3Client({
      region: process.env.S3_REGION?.trim() || 'auto',
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }

  private localPath(key: string) {
    const root = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
    return join(root, key);
  }
}
