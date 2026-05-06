import {
  Controller, Get, Header, Param, ParseUUIDPipe, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrintService, PrintFormat } from './print.service';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

const VALID_FORMATS: PrintFormat[] = ['A4', 'A5', '58', '80'];

function parseFormat(s?: string): PrintFormat {
  const u = (s ?? 'A4').toUpperCase() as PrintFormat;
  return VALID_FORMATS.includes(u) ? u : 'A4';
}

@ApiTags('print')
@ApiBearerAuth()
@Controller('print')
export class PrintController {
  constructor(private readonly print: PrintService) {}

  @Get('invoices/:id/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Render invoice HTML for browser print preview' })
  async html(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') fmt?: string,
  ) {
    return this.print.renderInvoiceHtml(me, id, parseFormat(fmt));
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Render invoice as PDF (Puppeteer)' })
  async pdf(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') fmt: string | undefined,
    @Res() res: Response,
  ) {
    const format = parseFormat(fmt);
    const buffer = await this.print.renderInvoicePdf(me, id, format);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${id}-${format}.pdf"`,
    );
    res.send(buffer);
  }
}
