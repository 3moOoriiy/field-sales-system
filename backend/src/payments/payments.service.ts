import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Prisma, AuditAction, InvoiceStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreatePaymentDto, ListPaymentsQuery } from './dto/payment.dto';
import { D, round2 } from '../common/utils/decimal';
import { JwtUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Record a payment / collection.
   *  - Reduces customer balance
   *  - If linked to an invoice: updates invoice paidAmount and status
   *      (PAID when paidAmount >= totalAmount, PARTIALLY_PAID otherwise)
   *  - Generates per-branch receipt number
   */
  async create(user: JwtUser, dto: CreatePaymentDto) {
    const amount = round2(D(dto.amount));
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.findUnique>> | null = null;
    if (dto.invoiceId) {
      invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.customerId !== dto.customerId) {
        throw new BadRequestException('Invoice does not belong to this customer');
      }
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Cannot pay a cancelled invoice');
      }
    }

    // Branch for receipt numbering: prefer invoice's branch, then customer's branch,
    // then user's branch, else any active branch.
    const branchId =
      invoice?.branchId ?? customer.branchId ?? user.branchId ?? null;
    if (!branchId) {
      throw new BadRequestException('Cannot determine branch for receipt numbering');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id: branchId },
        data: { paymentSeq: { increment: 1 } },
        select: { code: true, paymentSeq: true },
      });
      const receiptNumber = `RC-${branch.code}-${String(branch.paymentSeq).padStart(6, '0')}`;

      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          customerId: dto.customerId,
          invoiceId: dto.invoiceId,
          createdById: user.userId,
          method: dto.method ?? 'CASH',
          amount,
          notes: dto.notes,
          createLat: dto.createLat,
          createLng: dto.createLng,
        },
      });

      // Reduce customer balance
      const updated = await tx.customer.update({
        where: { id: dto.customerId },
        data: { balance: { decrement: amount.toNumber() } },
        select: { balance: true },
      });
      await tx.customerBalanceHistory.create({
        data: {
          customerId: dto.customerId,
          delta: amount.negated(),
          balanceAfter: updated.balance,
          reason: 'PAYMENT',
          refType: 'payment',
          refId: payment.id,
        },
      });

      // Update invoice if linked
      if (invoice) {
        const newPaid = round2(D(invoice.paidAmount).plus(amount));
        const reachedTotal = newPaid.gte(invoice.totalAmount);
        const nextStatus =
          invoice.paymentType === PaymentType.CASH
            ? invoice.status // cash invoices stay PAID
            : reachedTotal
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIALLY_PAID;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: newPaid, status: nextStatus },
        });
      }

      return payment;
    });

    await this.audit.log({
      userId: user.userId,
      action: AuditAction.PAYMENT_CREATED,
      entityType: 'payment',
      entityId: created.id,
      metadata: {
        receiptNumber: created.receiptNumber,
        amount: amount.toString(),
        customerId: dto.customerId,
        invoiceId: dto.invoiceId,
      },
    });

    this.realtime.emitPaymentCreated({
      id: created.id,
      receiptNumber: created.receiptNumber,
      customerId: dto.customerId,
      invoiceId: dto.invoiceId,
      amount,
      createdById: user.userId,
    });

    return created;
  }

  async list(user: JwtUser, q: ListPaymentsQuery, paging: { skip?: number; take?: number }) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('payment.view.all');

    const where: Prisma.PaymentWhereInput = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.invoiceId ? { invoiceId: q.invoiceId } : {}),
      ...(q.from || q.to
        ? { paidAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(canSeeAll
        ? q.agentId
          ? { createdById: q.agentId }
          : {}
        : { createdById: user.userId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: paging.skip ?? 0,
        take: Math.min(paging.take ?? 50, 200),
        orderBy: { paidAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, storeName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total };
  }

  async getById(user: JwtUser, id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: { customer: true, invoice: true },
    });
    if (!p) throw new NotFoundException('Payment not found');
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('payment.view.all');
    if (!canSeeAll && p.createdById !== user.userId) {
      throw new NotFoundException('Payment not found');
    }
    return p;
  }
}
