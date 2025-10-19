import * as mediasoup from 'mediasoup';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { AwaitQueue } from 'awaitqueue';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Logger } from './Logger';
import { SocketServer } from './SocketServer';
import { Room } from './Room';
import { appConfig } from './config';
import { WorkerInfo } from './types';

export interface ServerEvents {
  'new-room': (room: Room) => void;
}

export class Server extends EnhancedEventEmitter<ServerEvents> {
  readonly #config: typeof appConfig;
  readonly #logger: Logger;
  readonly #httpServer: any;
  readonly #socketServer: SocketServer;
  readonly #rooms: Map<string, Room> = new Map();
  readonly #roomCreationAwaitQueue: AwaitQueue = new AwaitQueue();
  #nextMediasoupWorkerIdx = 0;

  constructor({ config, httpServer, socketServer }: {
    config: typeof appConfig;
    httpServer: any;
    socketServer: SocketServer;
  }) {
    super();
    this.#config = config;
    this.#logger = new Logger('Server');
    this.#httpServer = httpServer;
    this.#socketServer = socketServer;

    this.#handleSocketServer();
  }

  static async create({ config }: { config: typeof appConfig }): Promise<Server> {
    const logger = new Logger('Server');

    // Create HTTP server
    const httpServer = config.http.tls
      ? createHttpsServer({
          cert: readFileSync(config.http.tls.cert),
          key: readFileSync(config.http.tls.key),
        })
      : createHttpServer();

    // Create Socket.io server
    const socketServer = SocketServer.create({
      httpServer,
      httpOriginHeader: config.domain,
    });

    // Create mediasoup workers and WebRTC servers
    await Server.#createMediasoupWorkersAndWebRtcServers(config);

    const server = new Server({
      config,
      httpServer,
      socketServer,
    });

    return server;
  }

    static async #createMediasoupWorkersAndWebRtcServers(config: typeof appConfig): Promise<void> {
    const logger = new Logger('Server');

    // Check mediasoup library
    console.log('Mediasoup library version:', mediasoup.version);
    console.log('Mediasoup createWorker function:', typeof mediasoup.createWorker);
    
    // Test basic mediasoup functionality
    try {
      console.log('Testing mediasoup library...');
      const testWorker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info'],
        appData: { test: true },
      });
      console.log('Test worker created successfully, PID:', testWorker.pid);
      
      // Test router creation with minimal codecs
      const testRouter = await testWorker.createRouter({
        mediaCodecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          }
        ],
      });
      console.log('Test router created, RTP capabilities:', JSON.stringify(testRouter.rtpCapabilities, null, 2));
      console.log('Test router RTP capabilities type:', typeof testRouter.rtpCapabilities);
      console.log('Test router RTP capabilities keys:', Object.keys(testRouter.rtpCapabilities || {}));
      console.log('Test router codecs length:', testRouter.rtpCapabilities?.codecs?.length || 0);
      
      // Close test worker
      testWorker.close();
      console.log('Test worker closed');
    } catch (error) {
      console.error('Mediasoup library test failed:', error);
      throw error;
    }

    // Read from ENV with fallback to config
    const numWorkers = process.env.MEDIASOUP_NUM_WORKERS
      ? parseInt(process.env.MEDIASOUP_NUM_WORKERS)
      : config.mediasoup.numWorkers;

    logger.info('Creating %d mediasoup workers...', numWorkers);

    for (let idx = 0; idx < numWorkers; ++idx) {
      console.log(`Creating mediasoup worker ${idx}...`);
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.workerSettings.logLevel as any,
        logTags: config.mediasoup.workerSettings.logTags as any,
        appData: { idx },
      });
      console.log(`Worker ${idx} created successfully, PID: ${worker.pid}`);
      
      // Test worker capabilities
      console.log(`Worker ${idx} appData:`, worker.appData);
      console.log(`Worker ${idx} closed:`, worker.closed);

      worker.on('died', () => {
        logger.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });

      // Create WebRtcServer with incremented ports
      console.log(`Creating WebRTC server for worker ${idx}...`);
      
      // Create both UDP and TCP listen infos
      const listenInfos = config.mediasoup.webRtcServerOptions.listenInfos.map(listenInfo => ({
        protocol: listenInfo.protocol,
        ip: listenInfo.ip,
        announcedAddress: listenInfo.announcedAddress,
        port: listenInfo.port + idx,
      }));
      
      console.log(`WebRTC server listen infos:`, listenInfos);
      console.log(`Announced address for worker ${idx}:`, listenInfos[0].announcedAddress || 'auto-detect');
      
      const webRtcServer = await worker.createWebRtcServer({
        listenInfos: listenInfos,
      });
      console.log(`WebRTC server created for worker ${idx} on ports:`, listenInfos.map(li => `${li.protocol}:${li.port}`).join(', '));
      console.log(`WebRTC server details:`, {
        id: webRtcServer.id,
        closed: webRtcServer.closed
      });

      Server.#mediasoupWorkersAndWebRtcServers.set(idx, { worker, webRtcServer, idx });

      logger.info('mediasoup worker created [pid:%d, idx:%d]', worker.pid, idx);
    }
  }

  static #mediasoupWorkersAndWebRtcServers: Map<number, WorkerInfo> = new Map();

  #handleSocketServer(): void {
    this.#socketServer.on('get-or-create-room', (data, callback, errorCallback) => {
      this.#getOrCreateRoom(data)
        .then(room => callback(room))
        .catch(error => errorCallback(error));
    });
  }

  async #getOrCreateRoom({ roomId }: { roomId: string }): Promise<Room> {
    return this.#roomCreationAwaitQueue.push(async () => {
      let room = this.#rooms.get(roomId);

      if (room) {
        return room;
      }

      this.#logger.info('Creating a new Room [roomId:%s]', roomId);

      const { worker, webRtcServer } = this.#getNextMediasoupWorkerAndWebRtcServer();

      // console.log('Creating router with media codecs:', JSON.stringify(this.#config.mediasoup.routerOptions.mediaCodecs, null, 2));
      
      let mediasoupRouter;
      try {
        mediasoupRouter = await worker.createRouter({
          mediaCodecs: this.#config.mediasoup.routerOptions.mediaCodecs,
        });
        
        // Check if RTP capabilities are valid
        if (!mediasoupRouter.rtpCapabilities || !mediasoupRouter.rtpCapabilities.codecs || mediasoupRouter.rtpCapabilities.codecs.length === 0) {
          console.error('Router RTP capabilities are empty!');
          console.error('Router object:', mediasoupRouter);
          console.error('Worker info:', { pid: worker.pid, closed: worker.closed });
          throw new Error('Router created but RTP capabilities are empty or invalid');
        }
        
        console.log('Router RTP capabilities validation passed');
        console.log('Number of codecs:', mediasoupRouter.rtpCapabilities.codecs.length);
        console.log('Number of header extensions:', mediasoupRouter.rtpCapabilities.headerExtensions?.length || 0);
      } catch (error) {
        console.error('Failed to create router:', error);
        console.error('Worker info:', { pid: worker.pid, closed: worker.closed });
        throw error;
      }

      room = await Room.create({
        roomId,
        config: this.#config,
        mediasoupRouter,
        mediasoupWebRtcServer: webRtcServer,
      });

      this.#rooms.set(room.id, room);
      this.#handleRoom(room);
      this.emit('new-room', room);

      return room;
    });
  }

  #getNextMediasoupWorkerAndWebRtcServer(): WorkerInfo {
    const workerInfo = Server.#mediasoupWorkersAndWebRtcServers.get(this.#nextMediasoupWorkerIdx);

    if (!workerInfo) {
      throw new Error('No mediasoup workers available');
    }

    this.#nextMediasoupWorkerIdx = (this.#nextMediasoupWorkerIdx + 1) % Server.#mediasoupWorkersAndWebRtcServers.size;

    return workerInfo;
  }

  #handleRoom(room: Room): void {
    room.on('close', () => {
      this.#rooms.delete(room.id);
    });
  }

  get rooms(): Map<string, Room> {
    return this.#rooms;
  }

  getRoom(roomId: string): Room | undefined {
    return this.#rooms.get(roomId);
  }

  getTotalRooms(): number {
    return this.#rooms.size;
  }

  getTotalPeers(): number {
    let totalPeers = 0;
    for (const room of this.#rooms.values()) {
      totalPeers += room.peers.size;
    }
    return totalPeers;
  }

  getTotalProducers(): number {
    let totalProducers = 0;
    for (const room of this.#rooms.values()) {
      for (const peer of room.peers.values()) {
        totalProducers += peer.producers.size;
      }
    }
    return totalProducers;
  }

  getTotalConsumers(): number {
    let totalConsumers = 0;
    for (const room of this.#rooms.values()) {
      for (const peer of room.peers.values()) {
        totalConsumers += peer.consumers.size;
      }
    }
    return totalConsumers;
  }

  getWorkerStats(): Array<{ idx: number; pid: number; memory: any; cpu: any }> {
    const stats: Array<{ idx: number; pid: number; memory: any; cpu: any }> = [];

    for (const { worker, idx } of Server.#mediasoupWorkersAndWebRtcServers.values()) {
      stats.push({
        idx,
        pid: worker.pid,
        memory: worker.getResourceUsage(),
        cpu: worker.getResourceUsage(),
      });
    }

    return stats;
  }

  getRoomStats(): Array<{ roomId: string; peers: number; producers: number; consumers: number }> {
    const stats: Array<{ roomId: string; peers: number; producers: number; consumers: number }> = [];

    for (const room of this.#rooms.values()) {
      let producers = 0;
      let consumers = 0;

      for (const peer of room.peers.values()) {
        producers += peer.producers.size;
        consumers += peer.consumers.size;
      }

      stats.push({
        roomId: room.id,
        peers: room.peers.size,
        producers,
        consumers,
      });
    }

    return stats;
  }

  async run(): Promise<void> {
    this.#logger.info('Starting server...');

    // Add health check endpoint
    const express = require('express');
    const app = express();
    
    // Add CORS middleware to allow all origins
    app.use((req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });
    
    app.get('/health', (req: any, res: any) => {
      res.json({
        status: 'healthy',
        workers: this.getWorkerStats(),
        rooms: this.getRoomStats(),
        uptime: process.uptime(),
      });
    });

    app.get('/metrics', (req: any, res: any) => {
      res.json({
        totalRooms: this.getTotalRooms(),
        totalPeers: this.getTotalPeers(),
        totalProducers: this.getTotalProducers(),
        totalConsumers: this.getTotalConsumers(),
      });
    });

    // Add CORS headers to all HTTP responses
    this.#httpServer.on('request', (req: any, res: any) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Pass to Express app
      app(req, res);
    });

    return new Promise((resolve, reject) => {
      this.#httpServer.listen(this.#config.http.listenPort, this.#config.http.listenIp, () => {
        console.log(`Server running on port ${this.#config.http.listenPort} on ip ${this.#config.http.listenIp}`);
        this.#logger.info('Server running [port:%d]', this.#config.http.listenPort);
        resolve();
      });

      this.#httpServer.on('error', (error: Error) => {
        this.#logger.error('HTTP server error: %s', error.message);
        reject(error);
      });
    });
  }

  async close(): Promise<void> {
    this.#logger.info('Closing server...');

    // Close all rooms
    for (const room of this.#rooms.values()) {
      room.close();
    }

    // Close Socket.io server
    this.#socketServer.close();

    // Close HTTP server
    this.#httpServer.close();

    // Close mediasoup workers
    await this.#closeMediasoupWorkers();
  }

  async #closeMediasoupWorkers(): Promise<void> {
    this.#logger.info('Closing mediasoup workers...');

    for (const { worker } of Server.#mediasoupWorkersAndWebRtcServers.values()) {
      worker.close();
    }

    Server.#mediasoupWorkersAndWebRtcServers.clear();
  }
}
