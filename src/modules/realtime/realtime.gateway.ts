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
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('RealtimeGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Join room for specific user to receive notifications
  @SubscribeMessage('join:user')
  handleJoinUser(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    if (!data.userId) return { event: 'error', message: 'userId is required' };

    const room = `user-${data.userId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', room };
  }

  /**
   * Generic notification emit
   * Used by NotificationsService to push updates to specific users
   */
  emitNotification(userId: string, notification: any) {
    const room = `user-${userId}`;
    this.server.to(room).emit('notification:new', notification);
    this.logger.log(`Emitted notification:new to ${room}`);
  }

  /**
   * Emit relationship update
   * Notifies user when a relationship status changes (invite, accept, etc.)
   */
  emitRelationshipUpdate(userId: string, data: any) {
    const room = `user-${userId}`;
    this.server.to(room).emit('relationship:update', data);
    this.logger.log(`Emitted relationship:update to ${room}`);
  }

  /**
   * Emit medication reminder
   * Specific event for medication alerts
   */
  emitMedicationReminder(userId: string, reminder: any) {
    const room = `user-${userId}`;
    this.server.to(room).emit('medication:reminder', reminder);
    this.logger.log(`Emitted medication:reminder to ${room}`);
  }
}
