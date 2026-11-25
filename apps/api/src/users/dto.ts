import { Privacy } from '@prisma/client';
import {
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
  @IsEnum(Privacy)
  privacy?: Privacy;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_tld: false })
  avatarUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_tld: false })
  coverUrl?: string | null;
}

export class ChangeUsernameDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;
}
