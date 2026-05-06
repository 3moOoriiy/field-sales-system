import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

interface LoginContext {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ---------- public API ----------

  async login(username: string, password: string, ctx: LoginContext): Promise<TokenPair & { user: object }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    const maxAttempts = Number(this.config.get('LOGIN_MAX_ATTEMPTS', 5));
    const lockMinutes = Number(this.config.get('LOGIN_LOCK_MINUTES', 15));

    // Always record an attempt
    const recordHistory = async (success: boolean, reason?: string) => {
      await this.prisma.loginHistory.create({
        data: {
          userId: user?.id,
          username,
          success,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          reason,
        },
      });
    };

    if (!user) {
      await recordHistory(false, 'unknown_user');
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { username, reason: 'unknown_user' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await recordHistory(false, 'inactive');
      throw new ForbiddenException('Account disabled');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordHistory(false, 'locked');
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= maxAttempts;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + lockMinutes * 60_000) : null,
        },
      });
      await recordHistory(false, 'bad_password');
      await this.audit.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { failedCount, locked: shouldLock },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // success — reset counters
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await recordHistory(true);
    await this.audit.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const tokens = await this.issueTokens(user.id, user.username, user.role.name, user.branchId, ctx);
    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role.name,
        branchId: user.branchId,
      },
    };
  }

  async refresh(refreshToken: string, ctx: LoginContext): Promise<TokenPair> {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    return this.issueTokens(user.id, user.username, user.role.name, user.branchId, ctx);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({ userId, action: AuditAction.LOGOUT });
    return { success: true };
  }

  // ---------- helpers ----------

  private async issueTokens(
    userId: string,
    username: string,
    role: string,
    branchId: string | null,
    ctx: LoginContext,
  ): Promise<TokenPair> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES', '7d');

    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, role, branchId },
      { secret: accessSecret, expiresIn: accessExpires },
    );

    const jti = randomBytes(16).toString('hex');
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti },
      { secret: refreshSecret, expiresIn: refreshExpires },
    );

    const refreshExpiresMs = this.parseDurationMs(refreshExpires);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationMs(accessExpires) / 1000,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(s: string): number {
    const m = s.match(/^(\d+)([smhd])$/);
    if (!m) throw new BadRequestException(`Invalid duration: ${s}`);
    const n = Number(m[1]);
    const unit = m[2];
    const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }
}
