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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('RealtimeGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Join room for staff to receive all pending orders
  @SubscribeMessage('join:staff')
  handleJoinStaff(@ConnectedSocket() client: Socket) {
    client.join('staff');
    this.logger.log(`Client ${client.id} joined staff room`);
    return { event: 'joined', room: 'staff' };
  }

  // Join room for kitchen to receive orders for specific venue
  @SubscribeMessage('join:kitchen')
  handleJoinKitchen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { venueId: string },
  ) {
    const room = `kitchen-${data.venueId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { event: 'joined', room };
  }

  // Join room for bar to receive orders for specific venue
  @SubscribeMessage('join:bar')
  handleJoinBar(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { venueId: string },
  ) {
    const room = `bar-${data.venueId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { event: 'joined', room };
  }

  // Join room for customer to track their order
  @SubscribeMessage('join:order')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    const room = `order-${data.orderId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { event: 'joined', room };
  }

  // Join room for table/room to receive order updates
  @SubscribeMessage('join:table')
  handleJoinTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serviceAreaId: string },
  ) {
    const room = `table-${data.serviceAreaId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { event: 'joined', room };
  }

  // ============================================
  // EMIT METHODS (called from services)
  // ============================================

  // Emit when new order is created and pending confirmation
  emitOrderPendingConfirmation(order: any) {
    this.server.to('staff').emit('order:pending:confirmation', order);
    this.logger.log(
      `Emitted order:pending:confirmation to staff - Order ${order.orderNumber}`,
    );
  }

  // Emit when staff confirms order
  emitOrderConfirmed(order: any) {
    // Notify customer
    this.server.to(`order-${order.id}`).emit('order:confirmed', order);
    this.server
      .to(`table-${order.serviceAreaId}`)
      .emit('order:confirmed', order);
    this.logger.log(`Emitted order:confirmed - Order ${order.orderNumber}`);
  }

  // Emit when staff rejects order
  emitOrderRejected(order: any, reason: string) {
    // Notify customer
    this.server.to(`order-${order.id}`).emit('order:rejected', {
      order,
      reason,
    });
    this.server.to(`table-${order.serviceAreaId}`).emit('order:rejected', {
      order,
      reason,
    });
    this.logger.log(`Emitted order:rejected - Order ${order.orderNumber}`);
  }

  // Emit when order is routed to kitchen/bar
  emitOrderRouted(order: any, targetStation: string) {
    // Determine if it's kitchen or bar based on venue type
    const room = targetStation.toLowerCase().includes('bar')
      ? `bar-${order.venueId}`
      : `kitchen-${order.venueId}`;

    this.server.to(room).emit('order:routed', {
      order,
      targetStation,
    });
    this.logger.log(
      `Emitted order:routed to ${room} - Order ${order.orderNumber}`,
    );
  }

  // Emit when order status changes to IN_PREP
  emitOrderInPrep(order: any) {
    // Notify customer
    this.server.to(`order-${order.id}`).emit('order:in_prep', order);
    this.server.to(`table-${order.serviceAreaId}`).emit('order:in_prep', order);

    // Notify staff
    this.server.to('staff').emit('order:in_prep', order);

    this.logger.log(`Emitted order:in_prep - Order ${order.orderNumber}`);
  }

  // Emit when order status changes to READY
  emitOrderReady(order: any) {
    // Notify customer
    this.server.to(`order-${order.id}`).emit('order:ready', order);
    this.server.to(`table-${order.serviceAreaId}`).emit('order:ready', order);

    // Notify staff
    this.server.to('staff').emit('order:ready', order);

    this.logger.log(`Emitted order:ready - Order ${order.orderNumber}`);
  }

  // Emit when order status changes to SERVED
  emitOrderServed(order: any) {
    // Notify customer
    this.server.to(`order-${order.id}`).emit('order:served', order);
    this.server.to(`table-${order.serviceAreaId}`).emit('order:served', order);

    this.logger.log(`Emitted order:served - Order ${order.orderNumber}`);
  }

  // Emit when order is cancelled
  emitOrderCancelled(order: any, reason: string) {
    // Notify all relevant parties
    this.server.to(`order-${order.id}`).emit('order:cancelled', {
      order,
      reason,
    });
    this.server.to(`table-${order.serviceAreaId}`).emit('order:cancelled', {
      order,
      reason,
    });
    this.server.to('staff').emit('order:cancelled', {
      order,
      reason,
    });

    this.logger.log(`Emitted order:cancelled - Order ${order.orderNumber}`);
  }

  // Emit when individual order item status changes
  emitOrderItemStatusUpdate(orderId: string, orderItem: any) {
    this.server.to(`order-${orderId}`).emit('order:item:status', orderItem);
    this.logger.log(
      `Emitted order:item:status - Order ${orderId}, Item ${orderItem.id}`,
    );
  }
}
