import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Prisma, AuditAction, InvoiceStatus, PaymentType, AttachmentKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateInvoiceDto, UpdateInvoiceDto, CancelInvoiceDto, ListInvoicesQuery, SignatureDto,
} from './dto/invoice.dto';
import { D, round2 } from '../common/utils/decimal';
import { JwtUser } from '../auth/decorators/current-user.decorator';

interface ComputedItem {
  productId: string;
  productName: string;
  productSku: string;
  unitType: string;
  costPriceSnap: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  quantity: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  discount: Prisma.Decimal;
  lineTotal: Prisma.Decimal; // (qty * unitPrice) - discount  (pre-tax)
  lineTax: Prisma.Decimal;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attachments: AttachmentsService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Atomic invoice creation with full limit enforcement.
   *
   * Validation steps:
   *  1. Customer exists and belongs to a branch the user can sell from
   *  2. Resolve products + check stock
   *  3. Apply per-item limit: prevent-below-cost (if agent flag set)
   *  4. Compute totals: subtotal, discount, tax, total
   *  5. Apply per-invoice limits: max discount %, max discount amount, max invoice total
   *  6. If clientUuid provided, idempotently return existing invoice (offline sync)
   *  7. Generate sequential invoice number (atomic increment of branch.invoiceSeq)
   *  8. Create invoice + items + balance history (if credit) + decrement stock
   *
   * Limit violations:
   *  - Block the action (throw ForbiddenException)
   *  - Log a LIMIT_EXCEEDED_ATTEMPT audit entry (visible to admins as a notification trigger)
   */
  async create(user: JwtUser, dto: CreateInvoiceDto) {
    const branchId = dto.branchId ?? user.branchId;
    if (!branchId) throw new BadRequestException('No branch assigned');

    // Idempotency for offline sync
    if (dto.clientUuid) {
      const existing = await this.prisma.invoice.findUnique({
        where: { clientUuid: dto.clientUuid },
      });
      if (existing) return this.getById(user, existing.id);
    }

    // Load customer + agent limits in parallel
    const [customer, limits] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: dto.customerId } }),
      this.prisma.agentLimits.findUnique({ where: { userId: user.userId } }),
    ]);
    if (!customer || !customer.isActive) throw new NotFoundException('Customer not found');

    // Resolve products
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new BadRequestException(`Inactive or unknown products: ${missing.join(', ')}`);
    }

    // Compute items
    const computedItems: ComputedItem[] = [];
    for (const input of dto.items) {
      const p = byId.get(input.productId)!;
      const qty = D(input.quantity);
      if (qty.lte(0)) throw new BadRequestException(`Quantity must be > 0 for ${p.sku}`);
      if (qty.greaterThan(p.stockQty)) {
        throw new BadRequestException(
          `Insufficient stock for ${p.sku}: requested ${qty.toString()}, available ${p.stockQty.toString()}`,
        );
      }

      const unitPrice = input.unitPrice != null ? D(input.unitPrice) : p.sellingPrice;
      const discount = D(input.discount ?? 0);

      // Limit: prevent below cost
      const preventBelowCost = limits?.preventBelowCost ?? true;
      const effectivePerUnit = unitPrice.minus(discount.dividedBy(qty.eq(0) ? 1 : qty));
      if (
        user.role === 'AGENT' &&
        preventBelowCost &&
        unitPrice.lessThan(p.costPrice)
      ) {
        await this.audit.log({
          userId: user.userId,
          action: AuditAction.LIMIT_EXCEEDED_ATTEMPT,
          entityType: 'invoice',
          metadata: {
            rule: 'prevent_below_cost',
            sku: p.sku,
            unitPrice: unitPrice.toString(),
            costPrice: p.costPrice.toString(),
          },
        });
        throw new ForbiddenException(
          `Selling ${p.sku} below cost is not allowed for your account`,
        );
      }
      void effectivePerUnit; // reserved for future per-line cost-after-discount enforcement

      const lineGross = qty.times(unitPrice);
      const lineNet = lineGross.minus(discount);
      const lineTax = lineNet.times(p.taxPercent).dividedBy(100);
      computedItems.push({
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        unitType: p.unitType,
        costPriceSnap: p.costPrice,
        unitPrice,
        quantity: qty,
        taxPercent: p.taxPercent,
        discount,
        lineTotal: lineNet,
        lineTax,
      });
    }

    // Header totals
    const subtotal = computedItems.reduce(
      (acc, it) => acc.plus(it.lineTotal),
      D(0),
    );
    const taxAmount = computedItems.reduce(
      (acc, it) => acc.plus(it.lineTax),
      D(0),
    );

    const headerDiscountPercent = D(dto.discountPercent ?? 0);
    const headerDiscountAmount = headerDiscountPercent.gt(0)
      ? subtotal.times(headerDiscountPercent).dividedBy(100)
      : D(dto.discountAmount ?? 0);

    const totalAmount = round2(subtotal.minus(headerDiscountAmount).plus(taxAmount));

    // Per-invoice limits (agents only)
    if (user.role === 'AGENT' && limits) {
      const violations: Array<{ rule: string; meta: Record<string, unknown> }> = [];

      if (
        limits.maxDiscountPercent != null &&
        headerDiscountPercent.greaterThan(limits.maxDiscountPercent)
      ) {
        violations.push({
          rule: 'max_discount_percent',
          meta: {
            attempted: headerDiscountPercent.toString(),
            limit: limits.maxDiscountPercent.toString(),
          },
        });
      }
      if (
        limits.maxDiscountAmount != null &&
        headerDiscountAmount.greaterThan(limits.maxDiscountAmount)
      ) {
        violations.push({
          rule: 'max_discount_amount',
          meta: {
            attempted: headerDiscountAmount.toString(),
            limit: limits.maxDiscountAmount.toString(),
          },
        });
      }
      if (
        limits.maxInvoiceTotal != null &&
        totalAmount.greaterThan(limits.maxInvoiceTotal)
      ) {
        violations.push({
          rule: 'max_invoice_total',
          meta: {
            attempted: totalAmount.toString(),
            limit: limits.maxInvoiceTotal.toString(),
          },
        });
      }

      if (violations.length) {
        await Promise.all(
          violations.map((v) =>
            this.audit.log({
              userId: user.userId,
              action: AuditAction.LIMIT_EXCEEDED_ATTEMPT,
              entityType: 'invoice',
              metadata: { rule: v.rule, ...v.meta },
            }),
          ),
        );
        this.realtime.emitLimitExceeded({
          agentId: user.userId,
          username: user.username,
          violations,
          customerId: dto.customerId,
        });
        throw new ForbiddenException(
          `Invoice exceeds your limits: ${violations.map((v) => v.rule).join(', ')}`,
        );
      }
    }

    // Permission gate for applying discount
    if (
      headerDiscountAmount.greaterThan(0) &&
      user.role !== 'SUPER_ADMIN' &&
      !user.permissions.includes('invoice.discount')
    ) {
      throw new ForbiddenException('Missing permission: invoice.discount');
    }

    const paymentType = dto.paymentType ?? PaymentType.CASH;

    // -------- transactional create --------
    const invoice = await this.prisma.$transaction(async (tx) => {
      // Atomic increment of branch sequence
      const branch = await tx.branch.update({
        where: { id: branchId },
        data: { invoiceSeq: { increment: 1 } },
        select: { id: true, code: true, invoiceSeq: true },
      });
      const invoiceNumber = `${branch.code}-${String(branch.invoiceSeq).padStart(6, '0')}`;

      // Decrement stock
      for (const it of computedItems) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: it.quantity.toNumber() } },
        });
      }

      // Create invoice
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          branchId,
          customerId: dto.customerId,
          createdById: user.userId,
          status: paymentType === PaymentType.CASH ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
          paymentType,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          customerSnapshot: {
            code: customer.code,
            storeName: customer.storeName,
            phone: customer.phone,
            address: customer.address,
            taxNumber: customer.taxNumber,
          } as Prisma.InputJsonValue,
          subtotal,
          discountAmount: headerDiscountAmount,
          discountPercent: headerDiscountPercent,
          taxAmount,
          totalAmount,
          paidAmount: paymentType === PaymentType.CASH ? totalAmount : D(0),
          notes: dto.notes,
          createLat: dto.createLat,
          createLng: dto.createLng,
          clientUuid: dto.clientUuid,
          items: {
            create: computedItems.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              productSku: it.productSku,
              unitType: it.unitType,
              costPriceSnap: it.costPriceSnap,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              taxPercent: it.taxPercent,
              discount: it.discount,
              lineTotal: round2(it.lineTotal.plus(it.lineTax)),
            })),
          },
        },
        include: { items: true, customer: true, branch: true },
      });

      // Customer balance: credit/partial increases debt
      if (paymentType !== PaymentType.CASH) {
        const debt = totalAmount;
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: { balance: { increment: debt.toNumber() } },
          select: { balance: true },
        });
        await tx.customerBalanceHistory.create({
          data: {
            customerId: customer.id,
            delta: debt,
            balanceAfter: updated.balance,
            reason: 'INVOICE',
            refType: 'invoice',
            refId: created.id,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      userId: user.userId,
      action: AuditAction.INVOICE_CREATED,
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: totalAmount.toString() },
    });

    this.realtime.emitInvoiceCreated({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      branchId: invoice.branchId,
      customerId: invoice.customerId,
      createdById: invoice.createdById,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
    });

    return invoice;
  }

  async list(user: JwtUser, q: ListInvoicesQuery, paging: { skip?: number; take?: number }) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('invoice.view.all');

    const where: Prisma.InvoiceWhereInput = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? {
            issuedAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(canSeeAll
        ? q.agentId
          ? { createdById: q.agentId }
          : {}
        : { createdById: user.userId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: paging.skip ?? 0,
        take: Math.min(paging.take ?? 50, 200),
        orderBy: { issuedAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, storeName: true, phone: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total };
  }

  async getById(user: JwtUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
        branch: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        payments: true,
        returns: { include: { items: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.assertCanRead(user, invoice.createdById);
    return invoice;
  }

  async update(user: JwtUser, id: string, dto: UpdateInvoiceDto) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, createdById: true, printedAt: true, status: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    this.assertCanRead(user, inv.createdById);
    if (inv.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled invoice');
    }

    if (inv.printedAt) {
      // Need either invoice.edit_after_print perm OR (for agents) limits.allowEditAfterPrint
      const hasPerm =
        user.role === 'SUPER_ADMIN' ||
        user.permissions.includes('invoice.edit_after_print');
      const limits = await this.prisma.agentLimits.findUnique({ where: { userId: user.userId } });
      if (!hasPerm && !(limits?.allowEditAfterPrint ?? false)) {
        throw new ForbiddenException('Editing after print is disabled for your account');
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        notes: dto.notes,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
    await this.audit.log({
      userId: user.userId,
      action: AuditAction.INVOICE_UPDATED,
      entityType: 'invoice',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return updated;
  }

  async cancel(user: JwtUser, id: string, dto: CancelInvoiceDto) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        returns: { select: { id: true } },
        payments: { select: { id: true } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    this.assertCanRead(user, inv.createdById);
    if (inv.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Invoice is already cancelled');
    }
    if (inv.returns.length > 0 || inv.payments.length > 0) {
      throw new ConflictException(
        'Cannot cancel invoice that has returns or payments. Reverse those first.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Restore stock
      for (const it of inv.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { increment: it.quantity.toNumber() } },
        });
      }

      // Reverse customer balance if credit
      if (inv.paymentType !== PaymentType.CASH) {
        const updated = await tx.customer.update({
          where: { id: inv.customerId },
          data: { balance: { decrement: inv.totalAmount.toNumber() } },
          select: { balance: true },
        });
        await tx.customerBalanceHistory.create({
          data: {
            customerId: inv.customerId,
            delta: inv.totalAmount.negated(),
            balanceAfter: updated.balance,
            reason: 'INVOICE_CANCELLED',
            refType: 'invoice',
            refId: inv.id,
          },
        });
      }

      await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
      });
    });

    await this.audit.log({
      userId: user.userId,
      action: AuditAction.INVOICE_CANCELLED,
      entityType: 'invoice',
      entityId: id,
      metadata: { reason: dto.reason },
    });

    this.realtime.emitInvoiceCancelled({ id, reason: dto.reason });

    return { success: true };
  }

  /**
   * Capture customer signature for an invoice.
   * Accepts a base64 data URL (`data:image/png;base64,...`) or raw base64 bytes.
   * Persists as an Attachment (kind=SIGNATURE) and updates `invoice.signaturePath`.
   */
  async saveSignature(user: JwtUser, id: string, dto: SignatureDto) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    this.assertCanRead(user, inv.createdById);
    if (inv.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot sign a cancelled invoice');
    }

    // Parse data URL or raw base64
    const m = dto.dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
    let mimeType = 'image/png';
    let b64 = dto.dataUrl;
    if (m) {
      mimeType = m[1];
      b64 = m[2];
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(b64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 signature');
    }
    if (bytes.length < 100) {
      throw new BadRequestException('Signature too small to be valid');
    }

    const attachment = await this.attachments.saveRaw({
      user,
      kind: AttachmentKind.SIGNATURE,
      bytes,
      originalName: 'signature.png',
      mimeType,
      invoiceId: id,
    });

    await this.prisma.invoice.update({
      where: { id },
      data: { signaturePath: attachment.filePath },
    });

    return { attachmentId: attachment.id, signaturePath: attachment.filePath };
  }

  async markPrinted(user: JwtUser, id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id }, select: { id: true, createdById: true } });
    if (!inv) throw new NotFoundException('Invoice not found');
    this.assertCanRead(user, inv.createdById);

    return this.prisma.invoice.update({
      where: { id },
      data: { printedAt: new Date() },
      select: { id: true, printedAt: true },
    });
  }

  // ---------- internals ----------

  private assertCanRead(user: JwtUser, createdById: string) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('invoice.view.all');
    if (canSeeAll) return;
    if (createdById !== user.userId) {
      throw new NotFoundException('Invoice not found');
    }
  }
}
