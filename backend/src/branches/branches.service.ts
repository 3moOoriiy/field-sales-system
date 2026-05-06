import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.branch.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { users: true, customers: true, invoices: true },
        },
      },
    });
  }

  async getById(id: string) {
    const b = await this.prisma.branch.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  async create(dto: CreateBranchDto) {
    const exists = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Branch code already exists');
    return this.prisma.branch.create({ data: dto });
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.getById(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  /**
   * Delete a branch.
   *
   *  - **Default (soft delete):** sets `isActive = false`. The branch stays in
   *    the DB so historical invoices, customers, and users still reference it
   *    correctly. This is what callers want 99% of the time.
   *  - **Hard delete (`hard=true`):** only allowed when *no* users, customers,
   *    or invoices reference the branch. Otherwise returns 409.
   */
  async remove(id: string, hard = false) {
    const b = await this.prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { users: true, customers: true, invoices: true } } },
    });
    if (!b) throw new NotFoundException('Branch not found');

    if (hard) {
      const refs = b._count.users + b._count.customers + b._count.invoices;
      if (refs > 0) {
        throw new ConflictException(
          `Cannot hard-delete branch: it is referenced by ` +
          `${b._count.users} user(s), ${b._count.customers} customer(s), and ${b._count.invoices} invoice(s). ` +
          `Reassign them first, or omit hard=true for a soft delete.`,
        );
      }
      await this.prisma.branch.delete({ where: { id } });
      return { success: true, mode: 'hard' };
    }

    // Soft delete
    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, mode: 'soft' };
  }

  async restore(id: string) {
    await this.getById(id);
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
