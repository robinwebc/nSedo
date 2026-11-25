import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeBus {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  toRoom(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }
}
