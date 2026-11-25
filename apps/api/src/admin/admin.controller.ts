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
import { Role, type User } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { AdminService } from './admin.service';
import {
  AdminUserQueryDto,
  BanDto,
  ChangeRoleDto,
  ResolveReportDto,
  VerifyBadgeDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query() query: AdminUserQueryDto) {
    return this.admin.users(query.q);
  }

  @Patch('users/:id/ban')
  ban(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: BanDto) {
    return this.admin.setBan(actor, id, dto.banned);
  }

  @Patch('users/:id/verify')
  verify(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: VerifyBadgeDto,
  ) {
    return this.admin.setBadge(actor, id, dto.verifiedBadge);
  }

  @Patch('users/:id/role')
  @Roles(Role.ADMIN)
  role(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.admin.setRole(actor, id, dto.role);
  }

  @Get('posts')
  posts() {
    return this.admin.posts();
  }

  @Delete('posts/:id')
  @HttpCode(200)
  deletePost(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.admin.deletePost(actor, id);
  }

  @Get('comments')
  comments() {
    return this.admin.comments();
  }

  @Delete('comments/:id')
  @HttpCode(200)
  deleteComment(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.admin.deleteComment(actor, id);
  }

  @Get('reports')
  reports() {
    return this.admin.reports();
  }

  @Patch('reports/:id')
  resolve(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.admin.resolveReport(actor, id, dto.status);
  }

  @Get('live')
  live() {
    return this.admin.listLive();
  }

  @Patch('live/:id/end')
  endLive(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.admin.endLive(actor, id);
  }

  @Get('audit')
  audit() {
    return this.admin.auditLog();
  }
}
