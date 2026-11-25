import { Privacy } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateIf,
} from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  body?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

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
