import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type User } from '@prisma/client';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { LiveService } from './live.service';

class StartLiveDto {
  @IsString()
  @Length(1, 80)
  title!: string;
}

class LiveCommentDto {
  @IsString()
  @Length(1, 300)
  body!: string;
}

@Controller('live')
@UseGuards(JwtAuthGuard)
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get()
  list() {
    return this.live.list();
  }

  @Post()
  start(@CurrentUser() user: User, @Body() dto: StartLiveDto) {
    return this.live.start(user, dto.title);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.live.get(id);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@CurrentUser() user: User, @Param('id') id: string) {
    return this.live.end(user, id);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: LiveCommentDto,
  ) {
    return this.live.comment(user, id, dto.body);
  }
}
