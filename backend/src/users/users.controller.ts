import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  SetPermissionsDto,
  SetAgentLimitsDto,
} from './dto/user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'List users with filters' })
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('role') role?: RoleName,
    @Query('branchId') branchId?: string,
  ) {
    return this.users.list({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      role,
      branchId,
    });
  }

  @Get(':id')
  @RequirePermissions('user.manage')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Post()
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'Create user' })
  create(@Body() dto: CreateUserDto, @CurrentUser() me: JwtUser) {
    return this.users.create(dto, me.userId);
  }

  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() me: JwtUser,
  ) {
    return this.users.update(id, dto, me.userId);
  }

  @Post(':id/reset-password')
  @RequirePermissions('user.manage')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() me: JwtUser,
  ) {
    return this.users.resetPassword(id, dto, me.userId);
  }

  @Delete(':id')
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'Disable user (soft)' })
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: JwtUser) {
    return this.users.disable(id, me.userId);
  }

  @Post(':id/permissions')
  @RequirePermissions('permissions.manage')
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionsDto,
    @CurrentUser() me: JwtUser,
  ) {
    return this.users.setPermissions(id, dto, me.userId);
  }

  @Post(':id/agent-limits')
  @RequirePermissions('permissions.manage')
  setAgentLimits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAgentLimitsDto,
    @CurrentUser() me: JwtUser,
  ) {
    return this.users.setAgentLimits(id, dto, me.userId);
  }
}
