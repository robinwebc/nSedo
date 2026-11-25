import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;

  @IsString()
  @Length(1, 50)
  displayName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^\+?[0-9]{8,15}$/)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}

export class RequestOtpDto {
  @IsIn(['SMS', 'EMAIL'])
  channel!: 'SMS' | 'EMAIL';

  @IsString()
  @Length(3, 254)
  target!: string;

  @IsIn(['REGISTER', 'LOGIN'])
  purpose!: 'REGISTER' | 'LOGIN';
}

export class VerifyOtpDto {
  @IsIn(['SMS', 'EMAIL'])
  channel!: 'SMS' | 'EMAIL';

  @IsString()
  @Length(3, 254)
  target!: string;

  @IsIn(['REGISTER', 'LOGIN'])
  purpose!: 'REGISTER' | 'LOGIN';

  @Matches(/^[0-9]{6}$/)
  code!: string;

  @IsOptional()
  @Matches(/^[a-z0-9_]{3,20}$/)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;
}

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class PasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class DeleteAccountDto {
  @Equals('DELETE')
  confirmation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;
}
