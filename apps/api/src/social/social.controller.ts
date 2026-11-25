import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { CreateReportDto, UsernameDto } from './dto';
import { SocialService } from './social.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('follows/:username')
  @HttpCode(200)
  follow(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.follow(user, username);
  }

  @Delete('follows/:username')
  @HttpCode(200)
  unfollow(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.unfollow(user, username);
  }

  @Get('follows/requests')
  followRequests(@CurrentUser() user: User) {
    return this.social.followRequests(user);
  }

  @Post('follows/requests/:id/accept')
  @HttpCode(200)
  acceptFollow(@CurrentUser() user: User, @Param('id') id: string) {
    return this.social.acceptFollow(user, id);
  }

  @Post('follows/requests/:id/decline')
  @HttpCode(200)
  declineFollow(@CurrentUser() user: User, @Param('id') id: string) {
    return this.social.declineFollow(user, id);
  }

  @Post('friends/requests')
  requestFriend(@CurrentUser() user: User, @Body() dto: UsernameDto) {
    return this.social.requestFriend(user, dto.username);
  }

  @Get('friends/requests')
  friendRequests(@CurrentUser() user: User) {
    return this.social.friendRequests(user);
  }

  @Post('friends/requests/:id/accept')
  @HttpCode(200)
  acceptFriend(@CurrentUser() user: User, @Param('id') id: string) {
    return this.social.acceptFriend(user, id);
  }

  @Post('friends/requests/:id/decline')
  @HttpCode(200)
  declineFriend(@CurrentUser() user: User, @Param('id') id: string) {
    return this.social.declineFriend(user, id);
  }

  @Get('friends')
  friends(@CurrentUser() user: User) {
    return this.social.friends(user);
  }

  @Post('blocks/:username')
  @HttpCode(200)
  block(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.block(user, username);
  }

  @Delete('blocks/:username')
  @HttpCode(200)
  unblock(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.unblock(user, username);
  }

  @Get('blocks')
  blocked(@CurrentUser() user: User) {
    return this.social.blocked(user);
  }

  @Post('mutes/:username')
  @HttpCode(200)
  mute(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.mute(user, username);
  }

  @Delete('mutes/:username')
  @HttpCode(200)
  unmute(@CurrentUser() user: User, @Param('username') username: string) {
    return this.social.unmute(user, username);
  }

  @Get('mutes')
  muted(@CurrentUser() user: User) {
    return this.social.muted(user);
  }

  @Post('reports')
  report(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.social.report(user, dto.targetType, dto.targetId, dto.reason);
  }
}
