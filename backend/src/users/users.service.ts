import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuditAction, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  SetPermissionsDto,
  SetAgentLimitsDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(params: { skip?: number; take?: number; role?: RoleName; branchId?: string }) {
    const where = {
      ...(params.role ? { role: { name: params.role } } : {}),
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 200),
        orderBy: { createdAt: 'desc' },
        select: this.publicUserSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...this.publicUserSelect(), agentLimits: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId?: string) {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) throw new ConflictException('Username already taken');

    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) throw new BadRequestException(`Unknown role: ${dto.role}`);

    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        roleId: role.id,
        branchId: dto.branchId,
        // default agent limits row for AGENT role
        ...(dto.role === 'AGENT'
          ? { agentLimits: { create: {} } }
          : {}),
      },
      select: this.publicUserSelect(),
    });
    await this.audit.log({
      userId: actorId,
      action: AuditAction.USER_CREATED,
      entityType: 'user',
      entityId: user.id,
      metadata: { username: user.username, role: dto.role },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    await this.assertExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.publicUserSelect(),
    });
    await this.audit.log({
      userId: actorId,
      action: AuditAction.USER_UPDATED,
      entityType: 'user',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return user;
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId?: string) {
    await this.assertExists(id);
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    // Revoke all refresh tokens for the user
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      userId: actorId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'user',
      entityId: id,
    });
    return { success: true };
  }

  async disable(id: string, actorId?: string) {
    await this.assertExists(id);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      userId: actorId,
      action: AuditAction.USER_DISABLED,
      entityType: 'user',
      entityId: id,
    });
    return { success: true };
  }

  async setPermissions(id: string, dto: SetPermissionsDto, actorId?: string) {
    await this.assertExists(id);
    const allCodes = [...dto.grant, ...dto.deny];
    const perms = await this.prisma.permission.findMany({ where: { code: { in: allCodes } } });
    const codeToId = new Map(perms.map((p) => [p.code, p.id]));
    const missing = allCodes.filter((c) => !codeToId.has(c));
    if (missing.length) {
      throw new BadRequestException(`Unknown permission codes: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      const rows = [
        ...dto.grant.map((c) => ({ userId: id, permissionId: codeToId.get(c)!, granted: true })),
        ...dto.deny.map((c) => ({ userId: id, permissionId: codeToId.get(c)!, granted: false })),
      ];
      if (rows.length) {
        await tx.userPermission.createMany({ data: rows });
      }
    });

    await this.audit.log({
      userId: actorId,
      action: AuditAction.PERMISSIONS_CHANGED,
      entityType: 'user',
      entityId: id,
      metadata: { grant: dto.grant, deny: dto.deny },
    });
    return { success: true };
  }

  async setAgentLimits(id: string, dto: SetAgentLimitsDto, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role.name !== 'AGENT') {
      throw new BadRequestException('Limits only apply to agents');
    }
    const limits = await this.prisma.agentLimits.upsert({
      where: { userId: id },
      create: { userId: id, ...dto },
      update: dto,
    });
    await this.audit.log({
      userId: actorId,
      action: AuditAction.PERMISSIONS_CHANGED,
      entityType: 'agent_limits',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return limits;
  }

  // ---------- internals ----------

  private async assertExists(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException('User not found');
  }

  private publicUserSelect() {
    return {
      id: true,
      username: true,
      email: true,
      fullName: true,
      phone: true,
      isActive: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } },
    } as const;
  }
}
