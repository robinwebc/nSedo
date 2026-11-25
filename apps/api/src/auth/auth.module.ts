import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenVerifier } from './google.verifier';
import { OtpService } from './otp.service';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  SmtpEmailProvider,
  smsProviderFactory,
} from './providers';
import { TokenService } from './token.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    AuthService,
    TokenService,
    OtpService,
    GoogleTokenVerifier,
    SmtpEmailProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: smsProviderFactory,
    },
    {
      provide: EMAIL_PROVIDER,
      useExisting: SmtpEmailProvider,
    },
  ],
  exports: [AuthService, OtpService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
