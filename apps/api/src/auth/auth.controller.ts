import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { AuthService } from './auth.service';
import {
  GoogleAuthDto,
  LoginDto,
  PasswordDto,
  RefreshDto,
  RegisterDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';

const authLimit = { default: { limit: 30, ttl: 600_000 } };
const otpLimit = { default: { limit: 5, ttl: 600_000 } };

@Controller('auth')
@Throttle(authLimit)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.identifier, dto.password);
  }

  @Post('otp/request')
  @HttpCode(200)
  @Throttle(otpLimit)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.channel, dto.target, dto.purpose);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body() dto: GoogleAuthDto) {
    return this.auth.googleSignIn(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  password(@CurrentUser() user: User, @Body() dto: PasswordDto) {
    return this.auth.setPassword(user, dto.currentPassword, dto.newPassword);
  }
}
