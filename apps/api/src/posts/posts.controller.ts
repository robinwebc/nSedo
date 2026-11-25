import {
  Body,
  Controller,
  Delete,
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
import { CreateCommentDto, CreatePostDto, RepostDto } from './dto';
import { PostsService } from './posts.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('posts/feed')
  feed(@CurrentUser() user: User, @Query() query: PageQueryDto) {
    const { take, skip } = page(query);
    return this.posts.feed(user, take, skip);
  }

  @Get('posts/explore')
  explore(@CurrentUser() user: User, @Query() query: PageQueryDto) {
    const { take, skip } = page(query);
    return this.posts.explore(user, take, skip);
  }

  @Post('posts/draft')
  draft(@CurrentUser() user: User) {
    return this.posts.draft(user);
  }

  @Post('posts')
  create(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  @Post('posts/:id/publish')
  publish(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CreatePostDto) {
    return this.posts.publish(user, id, dto);
  }

  @Get('posts/:id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.get(user, id);
  }

  @Delete('posts/:id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.remove(user, id);
  }

  @Post('posts/:id/like')
  @HttpCode(200)
  like(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.like(user, id);
  }

  @Delete('posts/:id/like')
  @HttpCode(200)
  unlike(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.unlike(user, id);
  }

  @Get('posts/:id/comments')
  comments(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.comments(user, id);
  }

  @Post('posts/:id/comments')
  comment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.posts.comment(user, id, dto.body);
  }

  @Post('posts/:id/repost')
  @HttpCode(200)
  repost(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RepostDto,
  ) {
    return this.posts.repost(user, id, dto.quote);
  }

  @Delete('posts/:id/repost')
  @HttpCode(200)
  unrepost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.unrepost(user, id);
  }

  @Delete('comments/:id')
  @HttpCode(200)
  deleteComment(@CurrentUser() user: User, @Param('id') id: string) {
    return this.posts.deleteComment(user, id);
  }

  @Get('users/:username/posts')
  byUser(
    @CurrentUser() user: User,
    @Param('username') username: string,
    @Query() query: PageQueryDto,
  ) {
    const { take, skip } = page(query);
    return this.posts.byUser(user, username, take, skip);
  }
}
