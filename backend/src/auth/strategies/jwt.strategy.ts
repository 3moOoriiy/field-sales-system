import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  branchId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        permissions: { include: { permission: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Build effective permissions: role permissions + granted overrides − denied overrides
    const rolePerms = new Set(user.role.permissions.map((rp) => rp.permission.code));
    for (const up of user.permissions) {
      if (up.granted) rolePerms.add(up.permission.code);
      else rolePerms.delete(up.permission.code);
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      branchId: user.branchId,
      permissions: Array.from(rolePerms),
    };
  }
}
