import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class AdminUserQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  q?: string;
}

export class BanDto {
  @IsBoolean()
  banned!: boolean;
}

export class VerifyBadgeDto {
  @IsBoolean()
  verifiedBadge!: boolean;
}

export class ChangeRoleDto {
  @IsEnum(Role)
  role!: Role;
}

export class ResolveReportDto {
  @IsIn(['RESOLVED', 'DISMISSED'])
  status!: 'RESOLVED' | 'DISMISSED';
}
