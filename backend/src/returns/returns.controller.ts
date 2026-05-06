import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto, ListReturnsQuery } from './dto/return.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @RequirePermissions('return.create')
  @ApiOperation({ summary: 'Create return (full or partial)' })
  create(@CurrentUser() me: JwtUser, @Body() dto: CreateReturnDto) {
    return this.returns.create(me, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List returns (agents see only own unless return.view.all)' })
  list(
    @CurrentUser() me: JwtUser,
    @Query() q: ListReturnsQuery,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.returns.list(me, q, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  getById(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.getById(me, id);
  }
}
