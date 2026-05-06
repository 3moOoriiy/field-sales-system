import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

export type PrintFormat = 'A4' | 'A5' | '58' | '80';

interface InvoiceForPrint {
  id: string;
  invoiceNumber: string;
  status: string;
  paymentType: string;
  issuedAt: Date;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  signaturePath: string | null;
  customer: {
    code: string; storeName: string;
    phone: string | null; address: string | null; taxNumber: string | null;
  };
  branch: { code: string; name: string; address: string | null; phone: string | null };
  createdBy: { fullName: string; username: string };
  items: Array<{
    productName: string; productSku: string; unitType: string;
    unitPrice: string; quantity: string; lineTotal: string;
  }>;
}

interface CompanyInfo {
  companyName: string;
  companyNameAr?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  invoiceFooter?: string | null;
  invoiceFooterAr?: string | null;
  defaultCurrency: string;
  logoDataUrl?: string;
}

@Injectable()
export class PrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {}

  async getInvoiceWithRefs(user: JwtUser, id: string): Promise<{ invoice: InvoiceForPrint; company: CompanyInfo; signatureDataUrl?: string }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: true,
        createdBy: { select: { fullName: true, username: true } },
        items: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Authorisation: same scoping as InvoicesService.getById
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('invoice.view.all');
    if (!canSeeAll && invoice.createdById !== user.userId) {
      throw new NotFoundException('Invoice not found');
    }

    const settings = await this.prisma.setting.findUnique({ where: { id: 1 } });
    const company: CompanyInfo = settings ? {
      companyName: settings.companyName,
      companyNameAr: settings.companyNameAr,
      taxNumber: settings.taxNumber,
      phone: settings.phone,
      address: settings.address,
      invoiceFooter: settings.invoiceFooter,
      invoiceFooterAr: settings.invoiceFooterAr,
      defaultCurrency: settings.defaultCurrency,
    } : { companyName: 'Field Sales', defaultCurrency: 'SAR' };

    if (settings?.logoPath) {
      company.logoDataUrl = await this.fileToDataUrl(settings.logoPath, 'image/png');
    }

    let signatureDataUrl: string | undefined;
    if (invoice.signaturePath) {
      signatureDataUrl = await this.fileToDataUrl(invoice.signaturePath, 'image/png');
    }

    const print: InvoiceForPrint = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      paymentType: invoice.paymentType,
      issuedAt: invoice.issuedAt,
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      notes: invoice.notes,
      signaturePath: invoice.signaturePath,
      customer: {
        code: invoice.customer.code,
        storeName: invoice.customer.storeName,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
        taxNumber: invoice.customer.taxNumber,
      },
      branch: {
        code: invoice.branch.code,
        name: invoice.branch.name,
        address: invoice.branch.address,
        phone: invoice.branch.phone,
      },
      createdBy: invoice.createdBy,
      items: invoice.items.map((it) => ({
        productName: it.productName,
        productSku: it.productSku,
        unitType: it.unitType,
        unitPrice: it.unitPrice.toString(),
        quantity: it.quantity.toString(),
        lineTotal: it.lineTotal.toString(),
      })),
    };

    return { invoice: print, company, signatureDataUrl };
  }

  async renderInvoiceHtml(user: JwtUser, id: string, format: PrintFormat): Promise<string> {
    const { invoice, company, signatureDataUrl } = await this.getInvoiceWithRefs(user, id);
    const qrPayload = JSON.stringify({
      n: invoice.invoiceNumber,
      t: invoice.totalAmount,
      d: invoice.issuedAt.toISOString(),
      v: invoice.customer.taxNumber ?? '',
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 120 });

    return buildHtml({ invoice, company, format, qrDataUrl, signatureDataUrl });
  }

  async renderInvoicePdf(user: JwtUser, id: string, format: PrintFormat): Promise<Buffer> {
    const html = await this.renderInvoiceHtml(user, id, format);
    if (format === 'A4') {
      return this.pdf.htmlToPdf(html, { format: 'a4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    }
    if (format === 'A5') {
      return this.pdf.htmlToPdf(html, { format: 'a5', margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
    }
    // Thermal — use CSS @page sizes via preferCSSPageSize
    return this.pdf.htmlToPdf(html, { preferCSSPageSize: true });
  }

  // ---------- internals ----------

  private async fileToDataUrl(relPath: string, fallbackMime: string): Promise<string | undefined> {
    try {
      const root = resolve(this.config.get<string>('UPLOAD_DIR', './uploads'));
      const abs = join(root, relPath);
      const buf = await fs.readFile(abs);
      const mime = relPath.toLowerCase().endsWith('.jpg') || relPath.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg' : fallbackMime;
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return undefined;
    }
  }
}

// ------------------------------------------------------------
// Template builder — single function with format-specific CSS.
// ------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

function buildHtml(args: {
  invoice: InvoiceForPrint;
  company: CompanyInfo;
  format: PrintFormat;
  qrDataUrl: string;
  signatureDataUrl?: string;
}): string {
  const { invoice, company, format, qrDataUrl, signatureDataUrl } = args;
  const isThermal = format === '58' || format === '80';
  const widthMm = format === '58' ? 58 : format === '80' ? 80 : null;

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  `;

  // Per-format CSS
  const sizeRule = isThermal
    ? `@page { size: ${widthMm}mm auto; margin: 4mm 3mm; }`
    : format === 'A4'
      ? `@page { size: A4; margin: 12mm; }`
      : `@page { size: A5; margin: 8mm; }`;

  const baseCSS = `
    ${fontImport}
    ${sizeRule}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Noto Sans Arabic', sans-serif;
      color: #0f172a;
      font-size: ${isThermal ? '11px' : '12px'};
      line-height: 1.45;
    }
    .invoice {
      ${isThermal ? `width: ${widthMm}mm;` : ''}
      padding: ${isThermal ? '0' : '0'};
    }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .head .company { font-weight: 700; }
    .head .small { color: #64748b; font-size: 10px; }
    .logo { max-height: ${isThermal ? '40px' : '60px'}; max-width: 120px; }
    h1 { font-size: ${isThermal ? '14px' : '18px'}; margin: 0 0 4px 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 6px 0 10px; }
    .meta div b { color: #475569; }
    .customer { border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 6px 0; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: ${isThermal ? '3px 0' : '6px 4px'}; vertical-align: top; }
    thead th { font-size: 10px; color: #475569; text-align: start; border-bottom: 1px solid #94a3b8; }
    tbody tr td { border-bottom: 1px dashed #e2e8f0; }
    .num { text-align: end; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 8px; }
    .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .grand { font-weight: 700; font-size: ${isThermal ? '13px' : '15px'}; border-top: 1px solid #0f172a; padding-top: 4px; margin-top: 2px; }
    .footer { margin-top: 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #475569; text-align: center; }
    .qr { margin: 8px 0; text-align: center; }
    .qr img { width: ${isThermal ? '90px' : '120px'}; height: ${isThermal ? '90px' : '120px'}; }
    .signature { margin-top: 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; }
    .signature .label { font-size: 10px; color: #475569; margin-bottom: 4px; }
    .signature img { max-height: ${isThermal ? '40px' : '60px'}; max-width: 200px; background: white; }
    .stamp {
      position: absolute; opacity: .15; font-size: 60px; font-weight: 800;
      transform: rotate(-15deg); pointer-events: none;
      ${isThermal ? 'display: none;' : ''}
    }
  `;

  const itemsHtml = invoice.items.map((it) => `
    <tr>
      <td>
        <div>${escapeHtml(it.productName)}</div>
        <div class="small" style="color:#94a3b8;font-size:10px">${escapeHtml(it.productSku)}</div>
      </td>
      <td class="num">${fmt(it.quantity)}</td>
      <td class="num">${fmt(it.unitPrice)}</td>
      <td class="num">${fmt(it.lineTotal)}</td>
    </tr>
  `).join('');

  const cancelledStamp = invoice.status === 'CANCELLED'
    ? `<div class="stamp" style="top:30%;left:25%">ملغاة / CANCELLED</div>`
    : '';

  const headerCompany = `
    <div>
      ${company.logoDataUrl ? `<img src="${company.logoDataUrl}" class="logo" />` : ''}
      <div class="company">${escapeHtml(company.companyNameAr ?? company.companyName)}</div>
      ${company.taxNumber ? `<div class="small">الرقم الضريبي / Tax: ${escapeHtml(company.taxNumber)}</div>` : ''}
      ${company.phone     ? `<div class="small">${escapeHtml(company.phone)}</div>` : ''}
      ${company.address   ? `<div class="small">${escapeHtml(company.address)}</div>` : ''}
    </div>
  `;

  const issuedAt = invoice.issuedAt.toLocaleString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>${baseCSS}</style>
</head>
<body>
  ${cancelledStamp}
  <div class="invoice">
    <div class="head">
      ${headerCompany}
      <div style="text-align:end">
        <h1>فاتورة / Invoice</h1>
        <div><b>#</b> ${escapeHtml(invoice.invoiceNumber)}</div>
        <div class="small">${escapeHtml(issuedAt)}</div>
        <div class="small">${escapeHtml(invoice.branch.name)} (${escapeHtml(invoice.branch.code)})</div>
      </div>
    </div>

    <div class="customer">
      <div><b>العميل / Customer:</b> ${escapeHtml(invoice.customer.storeName)} (${escapeHtml(invoice.customer.code)})</div>
      ${invoice.customer.phone   ? `<div class="small">${escapeHtml(invoice.customer.phone)}</div>` : ''}
      ${invoice.customer.address ? `<div class="small">${escapeHtml(invoice.customer.address)}</div>` : ''}
      ${invoice.customer.taxNumber ? `<div class="small">رقم ضريبي العميل: ${escapeHtml(invoice.customer.taxNumber)}</div>` : ''}
      <div class="small">المندوب / Agent: ${escapeHtml(invoice.createdBy.fullName)}</div>
      <div class="small">الدفع / Payment: ${escapeHtml(invoice.paymentType)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>الصنف / Item</th>
          <th class="num">الكمية</th>
          <th class="num">السعر</th>
          <th class="num">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>الإجمالي قبل / Subtotal</span><span class="num">${fmt(invoice.subtotal)} ${escapeHtml(company.defaultCurrency)}</span></div>
      <div class="row"><span>خصم / Discount</span><span class="num">- ${fmt(invoice.discountAmount)}</span></div>
      <div class="row"><span>ضريبة / Tax</span><span class="num">${fmt(invoice.taxAmount)}</span></div>
      <div class="row"><span>مدفوع / Paid</span><span class="num">${fmt(invoice.paidAmount)}</span></div>
      <div class="row grand"><span>الإجمالي / Total</span><span class="num">${fmt(invoice.totalAmount)} ${escapeHtml(company.defaultCurrency)}</span></div>
    </div>

    ${invoice.notes ? `<div style="margin-top:8px"><b>ملاحظات:</b> ${escapeHtml(invoice.notes)}</div>` : ''}

    <div class="qr"><img src="${qrDataUrl}" alt="QR" /></div>

    ${signatureDataUrl ? `
      <div class="signature">
        <div class="label">توقيع العميل / Customer signature</div>
        <img src="${signatureDataUrl}" alt="signature" />
      </div>` : ''}

    ${(company.invoiceFooterAr || company.invoiceFooter) ? `
      <div class="footer">
        ${escapeHtml(company.invoiceFooterAr ?? '')}
        ${company.invoiceFooter ? `<br/>${escapeHtml(company.invoiceFooter)}` : ''}
      </div>` : ''}
  </div>
</body>
</html>`;
}
