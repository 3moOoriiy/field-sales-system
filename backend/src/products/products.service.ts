import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto } from './dto/product.dto';
import { D } from '../common/utils/decimal';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: {
    skip?: number; take?: number; q?: string; categoryId?: string; activeOnly?: boolean;
  }) {
    const where: Prisma.ProductWhereInput = {
      ...(params.activeOnly !== false ? { isActive: true } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.q
        ? {
            OR: [
              { sku: { contains: params.q, mode: 'insensitive' } },
              { barcode: { contains: params.q, mode: 'insensitive' } },
              { name: { contains: params.q, mode: 'insensitive' } },
              { nameAr: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 200),
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async findByBarcode(barcode: string) {
    const p = await this.prisma.product.findUnique({ where: { barcode } });
    if (!p) throw new NotFoundException('Product not found for that barcode');
    return p;
  }

  async getById(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async create(dto: CreateProductDto, actorId?: string) {
    const exists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException('SKU already exists');

    const product = await this.prisma.product.create({
      data: {
        ...dto,
        costPrice: D(dto.costPrice),
        sellingPrice: D(dto.sellingPrice),
        taxPercent: D(dto.taxPercent ?? 0),
        stockQty: D(dto.stockQty ?? 0),
      },
    });
    await this.audit.log({
      userId: actorId, action: AuditAction.PRODUCT_CREATED,
      entityType: 'product', entityId: product.id,
      metadata: { sku: product.sku },
    });
    return product;
  }

  async update(id: string, dto: UpdateProductDto, actorId?: string) {
    await this.assertExists(id);
    const data: Prisma.ProductUpdateInput = { ...dto };
    if (dto.costPrice !== undefined) data.costPrice = D(dto.costPrice);
    if (dto.sellingPrice !== undefined) data.sellingPrice = D(dto.sellingPrice);
    if (dto.taxPercent !== undefined) data.taxPercent = D(dto.taxPercent);
    if (dto.stockQty !== undefined) data.stockQty = D(dto.stockQty);

    const product = await this.prisma.product.update({ where: { id }, data });
    await this.audit.log({
      userId: actorId, action: AuditAction.PRODUCT_UPDATED,
      entityType: 'product', entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return product;
  }

  // ---------- categories ----------

  async listCategories() {
    return this.prisma.productCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({ data: dto });
  }

  // ---------- internals ----------

  private async assertExists(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException('Product not found');
  }
}
