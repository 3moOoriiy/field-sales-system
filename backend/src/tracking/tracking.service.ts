import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LocationPointDto } from './dto/tracking.dto';

const ONLINE_THRESHOLD_MS = 90_000; // agent considered "online" if seen in last 90s

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Append one or many GPS points for an agent.
   * Emits `agent.location` to the admins room (last point only) for the live map.
   */
  async submit(agentId: string, points: LocationPointDto[]) {
    const rows = points.map((p) => ({
      agentId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      speed: p.speed,
      heading: p.heading,
      battery: p.battery,
      recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    }));

    if (!rows.length) return { count: 0 };
    await this.prisma.agentLocation.createMany({ data: rows });

    const last = rows[rows.length - 1];
    this.realtime.emitAgentLocation(last);

    return { count: rows.length };
  }

  /**
   * Live snapshot: every agent's most recent location, with online/offline derived
   * from `recordedAt` freshness.
   */
  async live(branchId?: string) {
    // Find each agent's most recent location row
    const since = new Date(Date.now() - ONLINE_THRESHOLD_MS);

    const agents = await this.prisma.user.findMany({
      where: {
        role: { name: 'AGENT' },
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true, username: true, fullName: true, phone: true, branchId: true,
      },
    });

    if (!agents.length) return [];

    // One query per agent is fine for typical sizes; for very large fleets switch to a
    // window-function raw query.
    const result = await Promise.all(
      agents.map(async (a) => {
        const last = await this.prisma.agentLocation.findFirst({
          where: { agentId: a.id },
          orderBy: { recordedAt: 'desc' },
          select: {
            latitude: true, longitude: true, accuracy: true,
            speed: true, heading: true, battery: true, recordedAt: true,
          },
        });
        return {
          ...a,
          isOnline: last ? last.recordedAt >= since : false,
          lastLocation: last,
        };
      }),
    );
    return result;
  }

  /**
   * Movement history for one agent (clamped to 5 000 points).
   */
  async history(agentId: string, from?: Date, to?: Date) {
    const where: Prisma.AgentLocationWhereInput = {
      agentId,
      ...(from || to
        ? { recordedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
    const rows = await this.prisma.agentLocation.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 5000,
    });
    // BigInt id is serialised globally via the toJSON polyfill in main.ts
    return rows;
  }
}
