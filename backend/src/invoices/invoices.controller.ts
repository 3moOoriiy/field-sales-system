import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto, UpdateInvoiceDto, CancelInvoiceDto, ListInvoicesQuery, SignatureDto,
} from './dto/invoice.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Create invoice (atomic, with limit enforcement)' })
  create(@CurrentUser() me: JwtUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(me, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices (agents see only own unless invoice.view.all)' })
  list(
    @CurrentUser() me: JwtUser,
    @Query() q: ListInvoicesQuery,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.invoices.list(me, q, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  getById(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.getById(me, id);
  }

  @Patch(':id')
  @RequirePermissions('invoice.update')
  update(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(me, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('invoice.cancel')
  cancel(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.invoices.cancel(me, id, dto);
  }

  @Post(':id/print')
  @ApiOperation({ summary: 'Mark invoice as printed (used to gate edit-after-print)' })
  markPrinted(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.markPrinted(me, id);
  }

  @Post(':id/signature')
  @RequirePermissions('attachment.upload')
  @ApiOperation({ summary: 'Save customer signature (PNG base64) and link to invoice' })
  saveSignature(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignatureDto,
  ) {
    return this.invoices.saveSignature(me, id, dto);
  }
}
