import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, LiveModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
