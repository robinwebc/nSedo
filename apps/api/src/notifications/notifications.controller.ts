import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { type User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { PageQueryDto, page } from '../common/page.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: PageQueryDto) {
    const { take, skip } = page(query);
    return this.notifications.list(user.id, take, skip);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: User) {
    return this.notifications.readAll(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notifications.read(user.id, id);
  }
}
