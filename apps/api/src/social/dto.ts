import { ReportTarget } from '@prisma/client';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

export class UsernameDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;
}

export class CreateReportDto {
  @IsEnum(ReportTarget)
  targetType!: ReportTarget;

  @IsString()
  @Length(1, 64)
  targetId!: string;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
