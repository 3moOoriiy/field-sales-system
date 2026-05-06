import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface AuthedSocket extends Socket {
  data: {
    userId?: string;
    role?: string;
    branchId?: string | null;
  };
}

/**
 * Socket.io gateway.
 *
 * Auth: JWT access token passed via either:
 *   - handshake.auth.token  (preferred)
 *   - Authorization: Bearer <token>
 *
 * Rooms:
 *   - admins              → ADMIN + SUPER_ADMIN (live invoices, tracking, notifications)
 *   - agent:<userId>      → that one agent
 *   - tracking            → admins watching the live map
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: '/ws',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // No-op; @WebSocketServer() is wired by Nest before connections begin.
  }

  async handleConnection(socket: AuthedSocket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        this.bearerFromHeader(socket.handshake.headers.authorization);
      if (!token) throw new Error('No token');
      const payload = this.jwt.verify<{ sub: string; role: string; branchId?: string }>(
        token,
        { secret: this.config.get<string>('JWT_ACCESS_SECRET') },
      );
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.branchId = payload.branchId ?? null;

      socket.join(`user:${payload.sub}`);
      if (payload.role === 'AGENT') {
        socket.join(`agent:${payload.sub}`);
      } else {
        socket.join('admins');
      }
      this.logger.log(`ws connect ${payload.sub} (${payload.role})`);
    } catch (err) {
      this.logger.warn(`ws auth failed: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthedSocket) {
    if (socket.data.userId) {
      this.logger.log(`ws disconnect ${socket.data.userId}`);
    }
  }

  // ---------- emit helpers (called by RealtimeService) ----------

  emitToAdmins(event: string, payload: unknown) {
    this.server.to('admins').emit(event, payload);
  }

  emitToAgent(agentId: string, event: string, payload: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToTrackingRoom(event: string, payload: unknown) {
    this.server.to('tracking').emit(event, payload);
  }

  // ---------- internals ----------

  private bearerFromHeader(h?: string): string | undefined {
    if (!h) return undefined;
    const m = h.match(/^Bearer\s+(.+)$/i);
    return m?.[1];
  }
}
