import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Logger } from './Logger';
import { Room } from './Room';
import { CreateRoomData, SocketConnectionData } from './types';

export interface SocketServerEvents {
  'get-or-create-room': (data: CreateRoomData, callback: (room: Room) => void, errorCallback: (error: Error) => void) => void;
}

export class SocketServer extends EnhancedEventEmitter<SocketServerEvents> {
  readonly #io: SocketIOServer;
  readonly #httpOriginHeader: string;
  readonly #logger: Logger;

  constructor({ io, httpOriginHeader }: { io: SocketIOServer; httpOriginHeader: string }) {
    super();
    this.#io = io;
    this.#httpOriginHeader = httpOriginHeader;
    this.#logger = new Logger('SocketServer');

    this.#handleSocket();
  }

  static create({ httpServer, httpOriginHeader }: { httpServer: HttpServer; httpOriginHeader: string }): SocketServer {
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // Allow all origins
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: false, // Set to false when using wildcard origin
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      },
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'],
    });

    return new SocketServer({ io, httpOriginHeader });
  }

  #handleSocket(): void {
    this.#io.on('connection', (socket: Socket) => {
      this.#logger.debug('Socket connection [socketId:%s]', socket.id);
      console.log('New socket connection:', socket.id, socket.handshake.query);

      const { roomId, peerId } = socket.handshake.query;

      if (!roomId || !peerId) {
        this.#logger.warn('Socket connection rejected [socketId:%s] - missing roomId or peerId', socket.id);
        console.log('Connection rejected - missing roomId or peerId:', { roomId, peerId });
        socket.disconnect(true);
        return;
      }

      // Validate origin
      if (!this.#validateOrigin(socket.handshake.headers.origin)) {
        this.#logger.warn('Socket connection rejected [socketId:%s] - invalid origin', socket.id);
        console.log('Connection rejected - invalid origin:', socket.handshake.headers.origin);
        socket.disconnect(true);
        return;
      }

      // Get or create room
      this.emit('get-or-create-room',
        { roomId: roomId as string, consumerReplicas: 0 },
        (room: Room) => this.#processSocketConnection(socket, room, peerId as string),
        (error: Error) => {
          this.#logger.error('Failed to get or create room [socketId:%s]: %s', socket.id, error.message);
          socket.disconnect(true);
        }
      );
    });
  }

  #validateOrigin(origin?: string): boolean {
    if (!origin) return true; // Allow connections without origin (e.g., from file://)
    
    try {
      const url = new URL(origin);
      const allowedOrigins = [
        `http://${this.#httpOriginHeader}`,
        `https://${this.#httpOriginHeader}`,
        'http://localhost:3001',
        'https://localhost:3001',
        'http://localhost:3002',
        'https://localhost:3002',
        'http://localhost:3003',
        'https://localhost:3003',
        'http://localhost:3004',
        'https://localhost:3004',
      ];
      
      return allowedOrigins.includes(origin) || url.hostname === this.#httpOriginHeader || url.hostname === 'localhost';
    } catch {
      return true; // Allow connections if we can't parse the origin
    }
  }

  #processSocketConnection(socket: Socket, room: Room, peerId: string): void {
    console.log('processSocketConnection() [socketId:%s]', socket.id , peerId);
    const socketConnectionData: SocketConnectionData = {
      socket,
      peerId,
      remoteAddress: socket.handshake.address,
    };

    room.processSocketConnection(socketConnectionData);
  }

  close(): void {
    this.#logger.debug('close()');

    this.#io.close();
  }
}
