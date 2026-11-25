import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type User } from '@prisma/client';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { SearchService } from './search.service';

class SearchQueryDto {
  @IsString()
  @Length(1, 100)
  q!: string;
}

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentUser() user: User, @Query() query: SearchQueryDto) {
    return this.searchService.search(user, query.q);
  }
}
