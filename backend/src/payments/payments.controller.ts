import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, ListPaymentsQuery } from './dto/payment.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Record a payment / collection' })
  create(@CurrentUser() me: JwtUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(me, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List payments (agents see only own unless payment.view.all)' })
  list(
    @CurrentUser() me: JwtUser,
    @Query() q: ListPaymentsQuery,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.payments.list(me, q, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  getById(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.getById(me, id);
  }
}
