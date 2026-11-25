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
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { MessagesService } from './messages.service';

class OpenConversationDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;
}

class SendMessageDto {
  @ValidateIf((value: SendMessageDto) => !value.mediaUrl)
  @IsString()
  @Length(1, 2000)
  body?: string;

  @IsOptional()
  @Matches(/^(https?:\/\/\S+|(?:avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+)$/)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  mediaType?: string;

  @IsOptional()
  @Matches(/^(https?:\/\/\S+|(?:avatars|covers|posts|messages)\/[\w-]+\/[\w.-]+)$/)
  thumbnailUrl?: string;
}

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.messages.list(user);
  }

  @Post()
  open(@CurrentUser() user: User, @Body() dto: OpenConversationDto) {
    return this.messages.open(user, dto.username);
  }

  @Get(':id/messages')
  listMessages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.messages.messages(user, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user, id, dto);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: User, @Param('id') id: string) {
    return this.messages.markRead(user, id);
  }
}
