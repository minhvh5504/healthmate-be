import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*', // Mobile app connects from any origin
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('RealtimeGateway');

  /**
   * Map user ids to active socket ids
   */
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // CONNECTION LIFECYCLE
  // ============================================

  async handleConnection(client: Socket) {
    try {
      const userId = this.extractUserIdFromSocket(client);

      if (!userId) {
        this.logger.warn(`Client ${client.id} connected without valid token -> disconnecting`);
        client.disconnect();
        return;
      }

      // Store userId in socket data for later retrieval
      (client.data as Record<string, string>).userId = userId;

      // Register socket in userSockets map
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Auto-join a private room named after the userId
      await client.join(`user:${userId}`);

      this.logger.log(
        `✅ User [${userId}] connected -> socket: ${client.id} (total: ${this.userSockets.get(userId)!.size})`,
      );

      // Push initial unread count upon connection
      const unreadCount = await this.prisma.notification.count({
        where: { userId, isRead: false, deliveryStatus: 'sent' },
      });
      this.emitUnreadCountToUser(userId, unreadCount);
    } catch (err) {
      this.logger.error(`Connection error: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as Record<string, string> | undefined)?.userId;

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`❌ User [${userId}] disconnected -> socket: ${client.id}`);
    } else {
      this.logger.log(`Client ${client.id} disconnected (unauthenticated)`);
    }
  }

  // ============================================
  // CLIENT TO SERVER EVENTS
  // ============================================

  /**
   * Check that the socket connection is alive
   */
  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', timestamp: new Date().toISOString() };
  }

  /**
   * Join the user room for legacy clients
   */
  @SubscribeMessage('join:user')
  async handleJoinUser(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    if (!data?.userId) return { event: 'error', message: 'Vui lòng cung cấp userId' };

    // Security: only allow joining own room
    const socketUserId = (client.data as Record<string, string>).userId;
    if (socketUserId && socketUserId !== data.userId) {
      return { event: 'error', message: 'Không được phép truy cập' };
    }

    const room = `user:${data.userId}`;
    await client.join(room);
    this.logger.log(`User [${socketUserId}] joined room: ${room}`);
    return { event: 'joined', room };
  }

  // ============================================
  // SERVER TO CLIENT EMIT METHODS
  // (Called from NotificationsService and other services)
  // ============================================

  /**
   * Emit a new notification to one user
   */
  emitNotificationToUser(userId: string, notification: Record<string, unknown>) {
    const room = `user:${userId}`;
    this.server.to(room).emit('notification:new', notification);

    const isOnline = this.isUserOnline(userId);
    this.logger.log(`📢 Emitted notification:new to user [${userId}] - online: ${isOnline}`);
  }

  /**
   * Alias for backward compatibility
   */
  emitNotification(userId: string, notification: unknown) {
    this.emitNotificationToUser(userId, notification as Record<string, unknown>);
  }

  /**
   * Emit unread notification count to one user
   */
  emitUnreadCountToUser(userId: string, unreadCount: number) {
    const room = `user:${userId}`;
    this.server.to(room).emit('notification:unread_count', { unreadCount });
  }

  /**
   * Emit relationship update (caregiver-patient)
   */
  emitRelationshipUpdate(userId: string, data: unknown) {
    const room = `user:${userId}`;
    this.server.to(room).emit('relationship:update', data);
    this.logger.log(`Emitted relationship:update to user [${userId}]`);
  }

  /**
   * Emit medication reminder
   */
  emitMedicationReminder(userId: string, reminder: unknown) {
    const room = `user:${userId}`;
    this.server.to(room).emit('medication:reminder', reminder);
    this.logger.log(`Emitted medication:reminder to user [${userId}]`);
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Check whether a user is connected
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * Get online user ids
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private extractUserIdFromSocket(client: Socket): string | null {
    try {
      // Read token from query param or Authorization header
      const token =
        (client.handshake.query?.token as string) ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return null;

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }
}
