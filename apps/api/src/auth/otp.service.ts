import { randomInt } from 'crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER, SMS_PROVIDER } from './providers';
import type { EmailProvider, SmsProvider } from './providers';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  devLast: { channel: OtpChannel; target: string; code: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  normalize(channel: OtpChannel, target: string) {
    const value = target.trim();
    if (channel === 'EMAIL') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new BadRequestException('Enter a valid email address');
      }
      return value.toLowerCase();
    }
    if (!/^\+?[0-9]{8,15}$/.test(value)) {
      throw new BadRequestException('Enter a valid phone number');
    }
    return value;
  }

  async request(channel: OtpChannel, rawTarget: string, purpose: OtpPurpose) {
    const target = this.normalize(channel, rawTarget);
    const recent = await this.prisma.otpCode.findFirst({
      where: { target, channel, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_MS) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 12);
    await this.prisma.otpCode.create({
      data: {
        target,
        channel,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    const message = `Your nSedo code is ${code}. It expires in 10 minutes.`;
    if (channel === 'SMS') {
      await this.sms.send(target, message);
    } else {
      await this.email.send(target, 'Your nSedo code', message);
    }
    if (process.env.NODE_ENV === 'test') {
      this.devLast = { channel, target, code };
    }
    return { sent: true, target };
  }

  async consume(
    channel: OtpChannel,
    rawTarget: string,
    purpose: OtpPurpose,
    code: string,
  ) {
    const target = this.normalize(channel, rawTarget);
    const row = await this.prisma.otpCode.findFirst({
      where: {
        target,
        channel,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Invalid or expired code');
    }
    const matches = await bcrypt.compare(code, row.codeHash);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }
    await this.prisma.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return target;
  }
}
