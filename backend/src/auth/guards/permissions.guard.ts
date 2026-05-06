import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user as JwtUser | undefined;
    if (!user) throw new ForbiddenException('No authenticated user');

    // SUPER_ADMIN has implicit access to everything
    if (user.role === 'SUPER_ADMIN') return true;

    const has = required.every((p) => user.permissions.includes(p));
    if (!has) {
      throw new ForbiddenException(`Missing permission(s): ${required.join(', ')}`);
    }
    return true;
  }
}
