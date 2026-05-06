import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(res: Response, filename: string, buffer: Buffer) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function parseRange(from?: string, to?: string) {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('sales')
  @RequirePermissions('report.sales')
  @ApiOperation({ summary: 'JSON sales rows in date range' })
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.sales(parseRange(from, to));
  }

  @Get('sales.xlsx')
  @RequirePermissions('report.sales')
  @ApiOperation({ summary: 'Download sales report as Excel' })
  async salesXlsx(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const buf = await this.svc.salesXlsx(parseRange(from, to));
    sendXlsx(res, `sales-${(from ?? '').slice(0, 10)}_${(to ?? '').slice(0, 10)}.xlsx`, buf);
  }

  @Get('debts')
  @RequirePermissions('report.debts')
  debts() { return this.svc.debts(); }

  @Get('debts.xlsx')
  @RequirePermissions('report.debts')
  async debtsXlsx(@Res() res: Response) {
    const buf = await this.svc.debtsXlsx();
    sendXlsx(res, 'debts.xlsx', buf);
  }

  @Get('collections')
  @RequirePermissions('report.collections')
  collections(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.collections(parseRange(from, to));
  }

  @Get('collections.xlsx')
  @RequirePermissions('report.collections')
  async collectionsXlsx(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const buf = await this.svc.collectionsXlsx(parseRange(from, to));
    sendXlsx(res, `collections-${(from ?? '').slice(0, 10)}_${(to ?? '').slice(0, 10)}.xlsx`, buf);
  }
}
