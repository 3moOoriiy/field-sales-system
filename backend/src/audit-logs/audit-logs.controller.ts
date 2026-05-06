import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'Browse audit log entries with filters' })
  async list(
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: skip ? Number(skip) : 0,
        take: Math.min(take ? Number(take) : 100, 500),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    // BigInt id is serialised globally via main.ts polyfill
    return { items, total };
  }
}
