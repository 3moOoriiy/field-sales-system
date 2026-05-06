import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ip?: string;
  userAgent?: string;
  /**
   * Free-form metadata. Coerced to Prisma's JSON value at the persistence
   * boundary so callers can pass plain objects without manual casts.
   */
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...input,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      // Audit failures must never break the request
      this.logger.error('Failed to write audit log', (err as Error).message);
    }
  }
}
