import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Thin facade so non-gateway services can publish events without
 * importing socket.io directly.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gw: RealtimeGateway) {}

  emitInvoiceCreated(payload: unknown) {
    this.gw.emitToAdmins('invoice.created', payload);
  }
  emitInvoiceCancelled(payload: unknown) {
    this.gw.emitToAdmins('invoice.cancelled', payload);
  }
  emitReturnCreated(payload: unknown) {
    this.gw.emitToAdmins('return.created', payload);
  }
  emitPaymentCreated(payload: unknown) {
    this.gw.emitToAdmins('payment.created', payload);
  }
  emitAgentLocation(payload: unknown) {
    this.gw.emitToAdmins('agent.location', payload);
  }
  emitVisitCheckIn(payload: unknown) {
    this.gw.emitToAdmins('visit.checkin', payload);
  }
  emitVisitCheckOut(payload: unknown) {
    this.gw.emitToAdmins('visit.checkout', payload);
  }
  emitNotification(toUserId: string, payload: unknown) {
    this.gw.emitToUser(toUserId, 'notification', payload);
  }
  emitLimitExceeded(payload: unknown) {
    this.gw.emitToAdmins('alert.limit_exceeded', payload);
  }
}
