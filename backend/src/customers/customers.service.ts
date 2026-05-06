import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: JwtUser, params: {
    skip?: number; take?: number; q?: string; branchId?: string; activeOnly?: boolean;
  }) {
    // SUPER_ADMIN/ADMIN see all (if they have customer.view.all). Agents see only customers
    // they created — unless granted customer.view.all.
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('customer.view.all');

    const where: Prisma.CustomerWhereInput = {
      ...(params.activeOnly !== false ? { isActive: true } : {}),
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(canSeeAll ? {} : { createdById: user.userId }),
      ...(params.q
        ? {
            OR: [
              { storeName: { contains: params.q, mode: 'insensitive' } },
              { phone:     { contains: params.q, mode: 'insensitive' } },
              { code:      { contains: params.q, mode: 'insensitive' } },
              { contactName: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 200),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total };
  }

  async getById(user: JwtUser, id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    this.assertCanRead(user, customer.createdById);
    return customer;
  }

  async create(user: JwtUser, dto: CreateCustomerDto) {
    const code = dto.code ?? (await this.generateCode());
    const exists = await this.prisma.customer.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Customer code already exists');

    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        code,
        branchId: dto.branchId ?? user.branchId ?? undefined,
        createdById: user.userId,
      },
    });
    await this.audit.log({
      userId: user.userId, action: AuditAction.CUSTOMER_CREATED,
      entityType: 'customer', entityId: customer.id,
      metadata: { code: customer.code, storeName: customer.storeName },
    });
    return customer;
  }

  async update(user: JwtUser, id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { id }, select: { id: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');
    this.assertCanRead(user, existing.createdById);

    const customer = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.audit.log({
      userId: user.userId, action: AuditAction.CUSTOMER_UPDATED,
      entityType: 'customer', entityId: id, metadata: dto as Record<string, unknown>,
    });
    return customer;
  }

  /**
   * Customer statement (كشف حساب) — invoices, payments, returns, balance history.
   */
  async statement(user: JwtUser, customerId: string, params: { from?: Date; to?: Date }) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Customer not found');
    this.assertCanRead(user, c.createdById);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (params.from) dateFilter.gte = params.from;
    if (params.to) dateFilter.lte = params.to;
    const hasDate = params.from || params.to;

    const [invoices, payments, returns, history] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId, ...(hasDate ? { issuedAt: dateFilter } : {}) },
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true, invoiceNumber: true, issuedAt: true, status: true,
          paymentType: true, totalAmount: true, paidAmount: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { customerId, ...(hasDate ? { paidAt: dateFilter } : {}) },
        orderBy: { paidAt: 'desc' },
      }),
      this.prisma.return.findMany({
        where: { customerId, ...(hasDate ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerBalanceHistory.findMany({
        where: { customerId, ...(hasDate ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    return {
      customer: c,
      currentBalance: c.balance,
      invoices,
      payments,
      returns,
      balanceHistory: history,
    };
  }

  /**
   * Top customers by outstanding debt (positive balance).
   */
  async topDebtors(limit = 20) {
    return this.prisma.customer.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true, code: true, storeName: true, phone: true, balance: true,
      },
    });
  }

  // ---------- internals ----------

  private assertCanRead(user: JwtUser, createdById: string | null) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('customer.view.all');
    if (canSeeAll) return;
    if (createdById !== user.userId) {
      throw new NotFoundException('Customer not found'); // hide existence
    }
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.customer.count();
    return `C-${String(count + 1).padStart(5, '0')}`;
  }
}
