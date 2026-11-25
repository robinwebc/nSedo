import { MediaKind, Privacy } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const mediaRef = /^(https?:\/\/\S+|(?:avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+)$/;

export class PostMediaDto {
  @Matches(mediaRef)
  url!: string;

  @IsString()
  mimeType!: string;

  @IsEnum(MediaKind)
  kind!: MediaKind;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60_000)
  durationMs?: number;

  @IsOptional()
  @IsString()
  blurhash?: string;

  @IsOptional()
  @Matches(mediaRef)
  thumbnailUrl?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  body?: string;

  @IsOptional()
  @Matches(mediaRef)
  mediaUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  media?: PostMediaDto[];

  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy;
}

export class CreateCommentDto {
  @IsString()
  @Length(1, 300)
  body!: string;
}

export class RepostDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @Length(1, 500)
  quote?: string;
}
