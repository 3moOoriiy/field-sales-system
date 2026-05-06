import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = ctx.switchToHttp().getResponse().statusCode;
        this.logger.log(`${req.method} ${req.url} ${status} ${ms}ms`);
      }),
    );
  }
}
