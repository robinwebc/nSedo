import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { AppThrottlerGuard } from './common/throttler';
import { HealthController } from './health.controller';
import { LiveModule } from './live/live.module';
import { MediaModule } from './media/media.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SearchModule } from './search/search.module';
import { SocialModule } from './social/social.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET is required');
        }
        const ttl = Number(config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900);
        return {
          secret: secret ?? 'dev-only-change-me',
          signOptions: { expiresIn: ttl },
        };
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    PostsModule,
    SocialModule,
    NotificationsModule,
    MessagesModule,
    CallsModule,
    LiveModule,
    MediaModule,
    SearchModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
