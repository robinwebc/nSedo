import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type User } from '@prisma/client';
import { DeleteAccountDto } from '../auth/dto';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { ChangeUsernameDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('username-available')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  available(@Query('username') username = '') {
    return this.users.availability(username);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.users.me(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user, dto);
  }

  @Patch('me/username')
  @UseGuards(JwtAuthGuard)
  username(@CurrentUser() user: User, @Body() dto: ChangeUsernameDto) {
    return this.users.changeUsername(user, dto.username);
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  exportData(@CurrentUser() user: User) {
    return this.users.exportData(user);
  }

  @Delete('me')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  deleteMe(@CurrentUser() user: User, @Body() dto: DeleteAccountDto) {
    return this.users.deleteMe(user, dto.confirmation, dto.password);
  }

  @Get(':username')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: User, @Param('username') username: string) {
    return this.users.profile(user, username);
  }

  @Get(':username/followers')
  @UseGuards(JwtAuthGuard)
  followers(@CurrentUser() user: User, @Param('username') username: string) {
    return this.users.followers(user, username);
  }

  @Get(':username/following')
  @UseGuards(JwtAuthGuard)
  following(@CurrentUser() user: User, @Param('username') username: string) {
    return this.users.following(user, username);
  }
}
