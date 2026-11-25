import { Privacy } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  bio?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  location?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUrl({ require_tld: false })
  website?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  birthday?: string | null;

  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^(https?:\/\/\S+|(?:avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+)$/)
  avatarUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^(https?:\/\/\S+|(?:avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+)$/)
  coverUrl?: string | null;
}

export class ChangeUsernameDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;
}
