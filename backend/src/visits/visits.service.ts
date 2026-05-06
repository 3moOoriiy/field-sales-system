import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateVisitTaskDto, CheckInDto, CheckOutDto, ListTasksQueryDto, UpdateTaskStatusDto,
} from './dto/visits.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { haversineMeters } from '../common/utils/geo';

const DEFAULT_RADIUS_M = 100;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------- Tasks (admin-driven) ----------

  async createTask(_actor: JwtUser, dto: CreateVisitTaskDto) {
    const [agent, customer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.agentId }, include: { role: true },
      }),
      this.prisma.customer.findUnique({ where: { id: dto.customerId } }),
    ]);
    if (!agent || agent.role.name !== 'AGENT') throw new BadRequestException('Target user is not an agent');
    if (!customer) throw new NotFoundException('Customer not found');

    const task = await this.prisma.visitTask.create({
      data: {
        customerId: dto.customerId,
        agentId: dto.agentId,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
      },
    });

    // Push notification to the agent so the PWA can refresh
    this.realtime.emitNotification(dto.agentId, {
      kind: 'TASK_ASSIGNED',
      title: 'مهمة زيارة جديدة',
      body: `${customer.storeName}`,
      taskId: task.id,
    });

    return task;
  }

  async listTasks(user: JwtUser, q: ListTasksQueryDto, paging: { skip?: number; take?: number }) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('visit.view.all');

    const where: Prisma.VisitTaskWhereInput = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? { scheduledAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(canSeeAll
        ? q.agentId ? { agentId: q.agentId } : {}
        : { agentId: user.userId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.visitTask.findMany({
        where,
        skip: paging.skip ?? 0,
        take: Math.min(paging.take ?? 50, 200),
        orderBy: { scheduledAt: 'asc' },
        include: {
          customer: { select: { id: true, code: true, storeName: true, latitude: true, longitude: true, address: true } },
          agent: { select: { id: true, username: true, fullName: true } },
          visit: { select: { id: true, status: true, checkInAt: true, checkOutAt: true } },
        },
      }),
      this.prisma.visitTask.count({ where }),
    ]);
    return { items, total };
  }

  async updateTaskStatus(_user: JwtUser, taskId: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.visitTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.visitTask.update({
      where: { id: taskId },
      data: { status: dto.status },
    });
  }

  // ---------- Check-in / check-out (agent) ----------

  /**
   * Check-in flow:
   *   1. Resolve task (if provided) OR customer.
   *   2. Look up customer GPS — fail if missing.
   *   3. Compute Haversine distance; reject if > radius (unless `force` and admin perm).
   *   4. Create Visit row with status IN_PROGRESS, link to task.
   *   5. Set task status IN_PROGRESS.
   *   6. Emit realtime event to admins.
   */
  async checkIn(agent: JwtUser, dto: CheckInDto) {
    if (!dto.taskId && !dto.customerId) {
      throw new BadRequestException('Either taskId or customerId is required');
    }

    let task: Awaited<ReturnType<typeof this.prisma.visitTask.findUnique>> | null = null;
    let customerId: string;

    if (dto.taskId) {
      task = await this.prisma.visitTask.findUnique({ where: { id: dto.taskId } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.agentId !== agent.userId && agent.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('This task is not assigned to you');
      }
      if (task.status === VisitStatus.COMPLETED || task.status === VisitStatus.CANCELLED) {
        throw new BadRequestException(`Task is ${task.status}`);
      }
      customerId = task.customerId;
    } else {
      customerId = dto.customerId!;
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.latitude == null || customer.longitude == null) {
      throw new BadRequestException(
        'Customer has no GPS pin set — cannot validate check-in. Update the customer first.',
      );
    }

    const radius = dto.allowedRadiusMeters ?? DEFAULT_RADIUS_M;
    const distance = haversineMeters(
      dto.latitude, dto.longitude,
      customer.latitude, customer.longitude,
    );

    const canForce =
      agent.role === 'SUPER_ADMIN' ||
      agent.permissions.includes('visit.assign');

    if (distance > radius && !(dto.force && canForce)) {
      throw new BadRequestException(
        `Out of range: ${Math.round(distance)}m from store (limit ${radius}m). Move closer or ask admin to extend radius.`,
      );
    }

    const visit = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visit.create({
        data: {
          taskId: task?.id,
          customerId,
          agentId: agent.userId,
          status: VisitStatus.IN_PROGRESS,
          checkInAt: new Date(),
          checkInLat: dto.latitude,
          checkInLng: dto.longitude,
          checkInRadiusMeters: Math.round(distance),
          notes: dto.notes,
        },
      });
      if (task) {
        await tx.visitTask.update({
          where: { id: task.id },
          data: { status: VisitStatus.IN_PROGRESS },
        });
      }
      return v;
    });

    this.realtime.emitVisitCheckIn({
      visitId: visit.id,
      agentId: agent.userId,
      customerId,
      customerName: customer.storeName,
      distanceMeters: Math.round(distance),
      forced: !!dto.force,
      at: visit.checkInAt,
    });

    return { ...visit, distanceMeters: Math.round(distance) };
  }

  async checkOut(agent: JwtUser, visitId: string, dto: CheckOutDto) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.agentId !== agent.userId && agent.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('This visit is not yours');
    }
    if (visit.status !== VisitStatus.IN_PROGRESS) {
      throw new BadRequestException(`Visit is ${visit.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.COMPLETED,
          checkOutAt: new Date(),
          checkOutLat: dto.latitude,
          checkOutLng: dto.longitude,
          notes: dto.notes ?? visit.notes,
        },
      });
      if (visit.taskId) {
        await tx.visitTask.update({
          where: { id: visit.taskId },
          data: { status: VisitStatus.COMPLETED },
        });
      }
      return v;
    });

    this.realtime.emitVisitCheckOut({
      visitId: updated.id,
      agentId: agent.userId,
      at: updated.checkOutAt,
    });
    return updated;
  }

  // ---------- Visits browsing / reports ----------

  async listVisits(user: JwtUser, q: ListTasksQueryDto, paging: { skip?: number; take?: number }) {
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('visit.view.all');

    const where: Prisma.VisitWhereInput = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? { checkInAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(canSeeAll
        ? q.agentId ? { agentId: q.agentId } : {}
        : { agentId: user.userId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        skip: paging.skip ?? 0,
        take: Math.min(paging.take ?? 50, 200),
        orderBy: { checkInAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, storeName: true, address: true } },
          agent: { select: { id: true, username: true, fullName: true } },
          photos: { select: { id: true, filePath: true, caption: true } },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { items, total };
  }

  async getVisit(user: JwtUser, id: string) {
    const v = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        customer: true, agent: { select: { id: true, username: true, fullName: true } },
        photos: true, attachments: true, task: true,
      },
    });
    if (!v) throw new NotFoundException('Visit not found');
    const canSeeAll =
      user.role === 'SUPER_ADMIN' ||
      user.permissions.includes('visit.view.all');
    if (!canSeeAll && v.agentId !== user.userId) {
      throw new NotFoundException('Visit not found');
    }
    return v;
  }

  /**
   * Visit performance ranking — completed vs. missed per agent over a window.
   */
  async ranking(from?: Date, to?: Date) {
    const where: Prisma.VisitTaskWhereInput = {
      ...(from || to ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };
    const grouped = await this.prisma.visitTask.groupBy({
      by: ['agentId', 'status'],
      where,
      _count: { _all: true },
    });
    const agentIds = Array.from(new Set(grouped.map((g) => g.agentId)));
    const agents = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, username: true, fullName: true },
    });
    const byId = new Map(agents.map((a) => [a.id, a]));

    const acc = new Map<string, { agentId: string; username: string; fullName: string;
      completed: number; planned: number; inProgress: number; missed: number; cancelled: number;
    }>();
    for (const g of grouped) {
      const a = byId.get(g.agentId);
      if (!a) continue;
      const existing = acc.get(g.agentId) ?? {
        agentId: a.id, username: a.username, fullName: a.fullName,
        completed: 0, planned: 0, inProgress: 0, missed: 0, cancelled: 0,
      };
      const n = g._count._all;
      switch (g.status) {
        case 'COMPLETED':   existing.completed = n; break;
        case 'PLANNED':     existing.planned = n; break;
        case 'IN_PROGRESS': existing.inProgress = n; break;
        case 'MISSED':      existing.missed = n; break;
        case 'CANCELLED':   existing.cancelled = n; break;
      }
      acc.set(g.agentId, existing);
    }
    return Array.from(acc.values()).sort((a, b) => b.completed - a.completed);
  }
}
