import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.log(`[nSedo SMS] to=${to} message=${message}`);
  }
}

@Injectable()
export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly url: string) {}

  async send(to: string, message: string) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
    if (!response.ok) {
      throw new Error(`SMS provider responded ${response.status}`);
    }
  }
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, text: string) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      console.log(`[nSedo EMAIL] to=${to} subject=${subject}\n${text}`);
      return;
    }
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: user ? { user, pass } : undefined,
    });
    await transport.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'noreply@nsedo.app',
      to,
      subject,
      text,
    });
  }
}

export function smsProviderFactory(config: ConfigService): SmsProvider {
  const mode = (config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
  if (mode === 'http') {
    const url = config.get<string>('SMS_HTTP_URL');
    if (!url) {
      throw new Error('SMS_HTTP_URL is required when SMS_PROVIDER=http');
    }
    return new HttpSmsProvider(url);
  }
  return new ConsoleSmsProvider();
}
