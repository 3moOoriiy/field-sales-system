import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE } from './api';
import { tokenStore } from './api';

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  const token = tokenStore.access();
  if (!token) return null;
  socket = io(SOCKET_BASE, {
    path: '/ws',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
