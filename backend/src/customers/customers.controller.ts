import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers (agents see only their own unless customer.view.all)' })
  list(
    @CurrentUser() me: JwtUser,
    @Query('q') q?: string,
    @Query('branchId') branchId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('all') all?: string,
  ) {
    return this.customers.list(me, {
      q, branchId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      activeOnly: all !== 'true',
    });
  }

  @Get('top-debtors')
  @RequirePermissions('report.debts')
  @ApiOperation({ summary: 'Top customers by outstanding debt' })
  topDebtors(@Query('limit') limit?: string) {
    return this.customers.topDebtors(limit ? Number(limit) : 20);
  }

  @Get(':id')
  getById(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.getById(me, id);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Customer ledger / كشف حساب' })
  statement(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customers.statement(me, id, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post()
  @RequirePermissions('customer.create')
  create(@CurrentUser() me: JwtUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(me, dto);
  }

  @Patch(':id')
  @RequirePermissions('customer.update')
  update(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(me, id, dto);
  }
}
