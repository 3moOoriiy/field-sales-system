import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

interface DateRange { from?: Date; to?: Date; }

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- query helpers ----------

  async sales(range: DateRange) {
    return this.prisma.invoice.findMany({
      where: {
        ...(range.from || range.to
          ? { issuedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      orderBy: { issuedAt: 'asc' },
      include: {
        customer: { select: { code: true, storeName: true } },
        createdBy: { select: { username: true, fullName: true } },
        branch: { select: { code: true, name: true } },
      },
      take: 5000,
    });
  }

  async debts() {
    return this.prisma.customer.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: 'desc' },
      take: 1000,
      select: {
        id: true, code: true, storeName: true, phone: true, address: true, balance: true,
      },
    });
  }

  async collections(range: DateRange) {
    return this.prisma.payment.findMany({
      where: {
        ...(range.from || range.to
          ? { paidAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      orderBy: { paidAt: 'asc' },
      include: {
        customer: { select: { code: true, storeName: true } },
        invoice: { select: { invoiceNumber: true } },
        createdBy: { select: { username: true, fullName: true } },
      },
      take: 5000,
    });
  }

  // ---------- xlsx generators ----------

  async salesXlsx(range: DateRange): Promise<Buffer> {
    const rows = await this.sales(range);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Field Sales System';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Sales');
    sheet.columns = [
      { header: 'Invoice #', key: 'invoiceNumber', width: 16 },
      { header: 'Date',      key: 'issuedAt', width: 20 },
      { header: 'Branch',    key: 'branch', width: 16 },
      { header: 'Customer',  key: 'customer', width: 30 },
      { header: 'Agent',     key: 'agent', width: 20 },
      { header: 'Payment',   key: 'paymentType', width: 12 },
      { header: 'Status',    key: 'status', width: 14 },
      { header: 'Subtotal',  key: 'subtotal', width: 14 },
      { header: 'Discount',  key: 'discount', width: 12 },
      { header: 'Tax',       key: 'tax', width: 12 },
      { header: 'Total',     key: 'total', width: 14 },
      { header: 'Paid',      key: 'paid', width: 14 },
    ];
    rows.forEach((r) => {
      sheet.addRow({
        invoiceNumber: r.invoiceNumber,
        issuedAt: r.issuedAt,
        branch: `${r.branch.code} ${r.branch.name}`,
        customer: r.customer.storeName,
        agent: r.createdBy.fullName,
        paymentType: r.paymentType,
        status: r.status,
        subtotal: Number(r.subtotal),
        discount: Number(r.discountAmount),
        tax: Number(r.taxAmount),
        total: Number(r.totalAmount),
        paid: Number(r.paidAmount),
      });
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('issuedAt').numFmt = 'yyyy-mm-dd hh:mm';
    ['subtotal', 'discount', 'tax', 'total', 'paid'].forEach((k) => {
      sheet.getColumn(k).numFmt = '#,##0.00';
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async debtsXlsx(): Promise<Buffer> {
    const rows = await this.debts();
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Debts');
    sheet.columns = [
      { header: 'Code',       key: 'code', width: 12 },
      { header: 'Store name', key: 'storeName', width: 30 },
      { header: 'Phone',      key: 'phone', width: 16 },
      { header: 'Address',    key: 'address', width: 30 },
      { header: 'Balance',    key: 'balance', width: 14 },
    ];
    rows.forEach((r) => sheet.addRow({
      code: r.code, storeName: r.storeName, phone: r.phone, address: r.address,
      balance: Number(r.balance),
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('balance').numFmt = '#,##0.00';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async collectionsXlsx(range: DateRange): Promise<Buffer> {
    const rows = await this.collections(range);
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Collections');
    sheet.columns = [
      { header: 'Receipt',  key: 'receiptNumber', width: 18 },
      { header: 'Date',     key: 'paidAt', width: 20 },
      { header: 'Customer', key: 'customer', width: 30 },
      { header: 'Invoice',  key: 'invoice', width: 16 },
      { header: 'Agent',    key: 'agent', width: 20 },
      { header: 'Method',   key: 'method', width: 16 },
      { header: 'Amount',   key: 'amount', width: 14 },
      { header: 'Notes',    key: 'notes', width: 30 },
    ];
    rows.forEach((r) => sheet.addRow({
      receiptNumber: r.receiptNumber,
      paidAt: r.paidAt,
      customer: r.customer.storeName,
      invoice: r.invoice?.invoiceNumber ?? '',
      agent: r.createdBy.fullName,
      method: r.method,
      amount: Number(r.amount),
      notes: r.notes,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('paidAt').numFmt = 'yyyy-mm-dd hh:mm';
    sheet.getColumn('amount').numFmt = '#,##0.00';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
