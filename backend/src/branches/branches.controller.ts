import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly svc: BranchesService) {}

  @Get()
  list() { return this.svc.list(); }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post()
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Create branch' })
  create(@Body() dto: CreateBranchDto) { return this.svc.create(dto); }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/restore')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Reactivate a soft-deleted branch' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restore(id);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  @ApiOperation({
    summary: 'Delete branch',
    description:
      'By default does a soft delete (isActive=false). ' +
      'Pass ?hard=true to permanently delete — only works if no users/customers/invoices reference it.',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hard?: string,
  ) {
    return this.svc.remove(id, hard === 'true');
  }
}
