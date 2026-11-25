import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { type User } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { MediaService } from './media.service';

class PresignDto {
  @IsString()
  mime!: string;

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size!: number;

  @IsString()
  filename!: string;

  @IsOptional()
  @IsIn(['avatar', 'cover', 'post', 'message'])
  scope?: 'avatar' | 'cover' | 'post' | 'message';

  @IsOptional()
  @IsString()
  postId?: string;
}

class FinalizeDto {
  @IsString()
  key!: string;
}

class LocalUploadDto {
  @IsOptional()
  @IsIn(['avatar', 'cover', 'post', 'message'])
  scope?: 'avatar' | 'cover' | 'post' | 'message';

  @IsOptional()
  @IsString()
  postId?: string;
}

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  presign(@CurrentUser() user: User, @Body() dto: PresignDto) {
    return this.media.presign(user.id, dto.mime, dto.size, dto.filename, dto.scope ?? 'message', dto.postId);
  }

  @Post('finalize')
  finalize(@CurrentUser() user: User, @Body() dto: FinalizeDto) {
    return this.media.finalize(user.id, dto.key);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file?: Express.Multer.File,
    @Body() dto?: LocalUploadDto,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    return this.media.saveLocal(
      user.id,
      file.mimetype,
      file.originalname,
      file.buffer,
      dto?.scope ?? 'message',
      dto?.postId,
    );
  }
}
