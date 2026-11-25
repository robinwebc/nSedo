import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CallStatus, CallType, type User } from '@prisma/client';
import { IsEnum, IsIn, Matches } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { CallsService } from './calls.service';

class CreateCallDto {
  @Matches(/^[a-z0-9_]{3,20}$/)
  username!: string;

  @IsEnum(CallType)
  type!: CallType;
}

class UpdateCallDto {
  @IsIn(['ONGOING', 'ENDED', 'MISSED', 'REJECTED'])
  status!: CallStatus;
}

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('ice')
  ice() {
    return this.calls.iceConfig();
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.calls.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateCallDto) {
    return this.calls.create(user, dto.username, dto.type);
  }

  @Patch(':id')
  @HttpCode(200)
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateCallDto,
  ) {
    return this.calls.update(user, id, dto.status);
  }
}
