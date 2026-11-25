import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards';

const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function uploadDir() {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
}

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = uploadDir();
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${allowed.has(ext) ? ext : ''}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
          cb(new BadRequestException('Only JPEG, PNG, WEBP, and GIF images are allowed') as unknown as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an image to upload');
    const base = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(
      /\/$/,
      '',
    );
    return { url: `${base}/uploads/${file.filename}` };
  }
}
