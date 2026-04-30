import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { logger } from '../utils/logger.util';

interface AlertPayload {
  id?: number;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: any;
  created_at?: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;

  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.frontendUrl || 'http://localhost:4200',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/ws',
    });

    // JWT authentication middleware
    this.io.use((socket: Socket, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      try {
        const decoded = jwt.verify(token as string, env.jwt.secret) as any;
        (socket as any).user = decoded;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      logger.info(`WebSocket connected: user=${user?.sub || user?.id}, role=${user?.role}`);

      // Join user-specific room
      if (user?.sub || user?.id) {
        socket.join(`user:${user.sub || user.id}`);
      }

      // Join role-based room
      if (user?.role) {
        socket.join(`role:${user.role}`);
      }

      socket.on('disconnect', () => {
        logger.info(`WebSocket disconnected: user=${user?.sub || user?.id}`);
      });
    });

    logger.info('WebSocket server initialized');
  }

  broadcastAlert(alert: AlertPayload, targetUserId?: number): void {
    if (!this.io) return;

    if (targetUserId) {
      this.io.to(`user:${targetUserId}`).emit('alert:new', alert);
    } else {
      // Broadcast to all connected clients
      this.io.emit('alert:new', alert);
    }
  }

  broadcastToRole(role: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`role:${role}`).emit(event, data);
  }

  sendToUser(userId: number, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  getConnectedCount(): number {
    if (!this.io) return 0;
    return this.io.engine?.clientsCount || 0;
  }
}

export const websocketService = new WebSocketService();
