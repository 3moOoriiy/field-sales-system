import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Prisma, AuditAction, InvoiceStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateReturnDto, ListReturnsQuery } from './dto/return.dto';
import { D, round2 } from '../common/utils/decimal';
import { JwtUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Create a return:
   *  - Validates each return quantity against (invoiceItem.quantity - already-returned)
   *  - Computes refund total based on the original line price
   *  - Restocks (default true) and reduces customer balance / refunds
   *  - Generates per-branch return number atomically
   */
  async create(user: JwtUser, dto: CreateReturnDto) {
    if (user.role === 'AGENT') {
      const limits = await this.prisma.agentLimits.findUnique({ where: { userId: user.userId } });
      if (limits && !limits.allowReturns) {
        throw new ForbiddenException('Returns are disabled for your account');
      }
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        items: true,
        returns: { include: { items: true } },
        branch: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot return against a cancelled invoice');
    }
    this.assertCanRead(user, invoice.createdById);

    // Build map of (invoiceItemId -> already returned qty)
    const alreadyReturned = new Map<string, Prisma.Decimal>();
    for (const r of invoice.returns) {
      for (const ri of r.items) {
        // Match by sku since ReturnItem doesn't store invoiceItemId; re-aggregate by product
        const key = ri.productId;
        alreadyReturned.set(key, (alreadyReturned.get(key) ?? D(0)).plus(ri.quantity));
      }
    }

    // Resolve items to return
    const requested: Array<{
      invoiceItem: typeof invoice.items[number];
      quantity: Prisma.Decimal;
    }> = [];

    if (dto.fullReturn) {
      for (const it of invoice.items) {
        const used = alreadyReturned.get(it.productId) ?? D(0);
        const remaining = it.quantity.minus(used);
        if (remaining.gt(0)) requested.push({ invoiceItem: it, quantity: remaining });
      }
    } else {
      if (!dto.items?.length) throw new BadRequestException('items[] is required when fullReturn is false');
      for (const r of dto.items) {
        const it = invoice.items.find((i) => i.id === r.invoiceItemId);
        if (!it) throw new BadRequestException(`Invoice item not found: ${r.invoiceItemId}`);
        const qty = D(r.quantity);
        const used = alreadyReturned.get(it.productId) ?? D(0);
        const remaining = it.quantity.minus(used);
        if (qty.gt(remaining)) {
          throw new BadRequestException(
            `Return qty ${qty.toString()} exceeds remaining ${remaining.toString()} for ${it.productSku}`,
          );
        }
        requested.push({ invoiceItem: it, quantity: qty });
      }
    }

    if (requested.length === 0) {
      throw new BadRequestException('Nothing left to return on this invoice');
    }

    // Compute totals: refund per item = (qty / origQty) * lineTotal
    const lineRefunds = requested.map(({ invoiceItem, quantity }) => {
      const ratio = quantity.dividedBy(invoiceItem.quantity);
      const refund = round2(invoiceItem.lineTotal.times(ratio));
      return { invoiceItem, quantity, refund };
    });
    const totalAmount = lineRefunds.reduce((acc, l) => acc.plus(l.refund), D(0));
    const isFullReturn =
      dto.fullReturn === true ||
      requested.length === invoice.items.length &&
        requested.every(
          (r) =>
            r.quantity.equals(
              r.invoiceItem.quantity.minus(alreadyReturned.get(r.invoiceItem.productId) ?? D(0)),
            ),
        );

    const restock = dto.restock !== false; // default true

    // -------- transaction --------
    const created = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id: invoice.branchId },
        data: { returnSeq: { increment: 1 } },
        select: { code: true, returnSeq: true },
      });
      const returnNumber = `R-${branch.code}-${String(branch.returnSeq).padStart(6, '0')}`;

      const ret = await tx.return.create({
        data: {
          returnNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          createdById: user.userId,
          reason: dto.reason ?? 'OTHER',
          reasonNote: dto.reasonNote,
          totalAmount,
          isFullReturn,
          items: {
            create: lineRefunds.map(({ invoiceItem, quantity, refund }) => ({
              productId: invoiceItem.productId,
              productName: invoiceItem.productName,
              productSku: invoiceItem.productSku,
              unitPrice: invoiceItem.unitPrice,
              quantity,
              lineTotal: refund,
            })),
          },
        },
        include: { items: true },
      });

      // Restock
      if (restock) {
        for (const { invoiceItem, quantity } of requested) {
          await tx.product.update({
            where: { id: invoiceItem.productId },
            data: { stockQty: { increment: quantity.toNumber() } },
          });
        }
      }

      // Customer balance:
      //  - credit invoice → return reduces debt (decrement balance)
      //  - cash invoice paid in full → return creates credit (decrement balance, may go negative = we owe customer)
      const updated = await tx.customer.update({
        where: { id: invoice.customerId },
        data: { balance: { decrement: totalAmount.toNumber() } },
        select: { balance: true },
      });
      await tx.customerBalanceHistory.create({
        data: {
          customerId: invoice.customerId,
          delta: totalAmount.negated(),
          balanceAfter: updated.balance,
          reason: 'RETURN',
          refType: 'return',
          refId: ret.id,
        },
      });

      // Update invoice paid/total accounting:
      // Reduce paid amount on cash invoices, since the refund effectively reverses payment.
      if (invoice.paymentType === PaymentType.CASH) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: { decrement: totalAmount.toNumber() } },
        });
      }

      return ret;
    });

    await this.audit.log({
      userId: user.userId,
      action: AuditAction.RETURN_CREATED,
      entityType: 'return',
      entityId: created.id,
      metadata: {
        invoiceId: invoice.id,
        returnNumber: created.returnNumber,
        totalAmount: totalAmount.toString(),
      },
    });

    this.realtime.emitReturnCreated({
      id: created.id,
      returnNumber: created.returnNumber,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      totalAmount,
      createdById: user.userId,
    });

    return created;
  }

  async list(user: JwtUser, q: ListReturnsQuery, paging: { skip?: number; take?: number }) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('return.view.all');

    const where: Prisma.ReturnWhereInput = {
      ...(q.invoiceId ? { invoiceId: q.invoiceId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(canSeeAll
        ? q.agentId
          ? { createdById: q.agentId }
          : {}
        : { createdById: user.userId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        skip: paging.skip ?? 0,
        take: Math.min(paging.take ?? 50, 200),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, storeName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          items: true,
        },
      }),
      this.prisma.return.count({ where }),
    ]);
    return { items, total };
  }

  async getById(user: JwtUser, id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: { items: true, invoice: true, customer: true },
    });
    if (!ret) throw new NotFoundException('Return not found');
    this.assertCanRead(user, ret.createdById);
    return ret;
  }

  // ---------- internals ----------

  private assertCanRead(user: JwtUser, createdById: string) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('return.view.all');
    if (canSeeAll) return;
    if (createdById !== user.userId) {
      throw new NotFoundException('Return not found');
    }
  }
}
