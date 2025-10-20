import { Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Logger } from './Logger';
import { PeerInfo, CreateTransportData, ProduceData, ConsumeData } from './types';
import { REQUEST_METHODS, NOTIFICATION_METHODS, SocketRequest, SocketResponse } from './signaling/socketMessages';
import {
  InvalidStateError,
  TransportNotFoundError,
  ProducerNotFoundError,
  ConsumerNotFoundError,
  InvalidRequestError,
} from './errors';

export interface PeerEvents {
  'joined': (peers: PeerInfo[], callback: (peers: PeerInfo[]) => void) => void;
  'new-producer': (data: { producer: mediasoup.types.Producer }) => void;
  'disconnected': () => void;
  'create-webrtc-transport': (data: CreateTransportData, resolve: (transport: mediasoup.types.WebRtcTransport) => void, reject: (error: Error) => void) => void;
  'get-router-rtp-capabilities': (callback: (caps: mediasoup.types.RtpCapabilities) => void) => void;
  'get-can-consume': (data: { producerId: string; rtpCapabilities: mediasoup.types.RtpCapabilities }, callback: (canConsume: boolean) => void) => void;
}

export class Peer extends EnhancedEventEmitter<PeerEvents> {
  readonly #socket: Socket;
  readonly #peerId: string;
  readonly #roomId: string;
  readonly #logger: Logger;
  readonly #transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();
  readonly #producers: Map<string, mediasoup.types.Producer> = new Map();
  readonly #consumers: Map<string, mediasoup.types.Consumer> = new Map();
  readonly #dataProducers: Map<string, mediasoup.types.DataProducer> = new Map();
  readonly #dataConsumers: Map<string, mediasoup.types.DataConsumer> = new Map();

  #closed = false;
  #joined = false;
  #displayName?: string;
  #device?: any;
  #rtpCapabilities?: mediasoup.types.RtpCapabilities;
  #sctpCapabilities?: mediasoup.types.SctpCapabilities;

  constructor({ socket, peerId, roomId, remoteAddress }: { socket: Socket; peerId: string; roomId: string; remoteAddress: string }) {
    super();
    this.#socket = socket;
    this.#peerId = peerId;
    this.#roomId = roomId;
    this.#logger = new Logger(`Peer:${peerId}`);

    this.#handleSocket();
  }

  static create({ socket, peerId, roomId, remoteAddress }: { socket: Socket; peerId: string; roomId: string; remoteAddress: string }): Peer {
    return new Peer({ socket, peerId, roomId, remoteAddress });
  }

  get id(): string {
    return this.#peerId;
  }

  get roomId(): string {
    return this.#roomId;
  }

  get displayName(): string | undefined {
    return this.#displayName;
  }

  get device(): any {
    return this.#device;
  }

  get rtpCapabilities(): mediasoup.types.RtpCapabilities | undefined {
    return this.#rtpCapabilities;
  }

  get sctpCapabilities(): mediasoup.types.SctpCapabilities | undefined {
    return this.#sctpCapabilities;
  }

  get joined(): boolean {
    return this.#joined;
  }

  get closed(): boolean {
    return this.#closed;
  }

  get socket(): Socket {
    return this.#socket;
  }

  get transports(): Map<string, mediasoup.types.WebRtcTransport> {
    return this.#transports;
  }

  get producers(): Map<string, mediasoup.types.Producer> {
    return this.#producers;
  }

  get consumers(): Map<string, mediasoup.types.Consumer> {
    return this.#consumers;
  }

  get dataProducers(): Map<string, mediasoup.types.DataProducer> {
    return this.#dataProducers;
  }

  get dataConsumers(): Map<string, mediasoup.types.DataConsumer> {
    return this.#dataConsumers;
  }

  #handleSocket(): void {
    // Handle disconnect
    this.#socket.on('disconnect', () => {
      if (!this.#closed) {
        this.close();
        if (this.#joined) {
          this.emit('disconnected');
        }
      }
    });

    // Handle requests with acknowledgments
    this.#socket.on('request', async (request: SocketRequest, callback: (response: SocketResponse) => void) => {
      try {
        const response = await this.#handleRequest(request.method, request.data);
        callback({ ok: true, data: response });
      } catch (error) {
        this.#logger.error('Request failed [method:%s]: %s', request.method, (error as Error).message);
        callback({ ok: false, error: (error as Error).message });
      }
    });
  }

  async #handleRequest(method: string, data: any): Promise<any> {
    switch (method) {
      case REQUEST_METHODS.GET_ROUTER_RTP_CAPABILITIES: {
        return new Promise((resolve) => {
          this.emit('get-router-rtp-capabilities', (caps: mediasoup.types.RtpCapabilities) => resolve({ routerRtpCapabilities: caps }));
        });
      }

      case REQUEST_METHODS.JOIN: {
        const { displayName, device, rtpCapabilities, sctpCapabilities } = data;

        if (this.#joined) {
          throw new InvalidStateError('Peer already joined');
        }

        this.#joined = true;
        this.#displayName = displayName;
        this.#device = device;
        this.#rtpCapabilities = rtpCapabilities;
        this.#sctpCapabilities = sctpCapabilities;

        // const otherPeers = Array.from(this.#room.getOtherPeers(this).values()).filter(p => p.id !== this.#peerId);
        return new Promise((resolve) => {
          this.emit('joined', (peers: PeerInfo[]) => resolve({ peers }));
        });
      }

      case REQUEST_METHODS.CREATE_WEBRTC_TRANSPORT: {
        const { sctpCapabilities, forceTcp, appData } = data;
        
        const transport = await new Promise<mediasoup.types.WebRtcTransport>((resolve, reject) => {
          this.emit('create-webrtc-transport',
            { direction: appData.direction, sctpCapabilities, forceTcp },
            resolve, reject
          );
        });

        this.#transports.set(transport.id, transport);
        this.#handleTransport(transport);

        console.log('Hello from peer Transport created :', this.#peerId, transport.id);

        
        return {
          transportId: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters,
        };
      }

      case REQUEST_METHODS.CONNECT_WEBRTC_TRANSPORT: {
        const { transportId, dtlsParameters } = data;
        
        const transport = this.#assertAndGetWebRtcTransport(transportId);

        try {
          await transport.connect({ dtlsParameters });
          return {};
        } catch (error) {
          this.#logger.error('Failed to connect transport [transportId:%s]: %s', transportId, (error as Error).message);
          throw error;
        }
      }

      case REQUEST_METHODS.PRODUCE: {
        const { transportId, kind, rtpParameters, appData } = data;
        
        const transport = this.#assertAndGetWebRtcTransport(transportId);
        
        const producer = await transport.produce({
          kind,
          rtpParameters,
          appData: { peerId: this.id, source: appData.source },
        });

        this.#producers.set(producer.id, producer);
        this.#handleProducer(producer);
        this.emit('new-producer', { producer });

        return { producerId: producer.id };
      }

      case REQUEST_METHODS.CONSUME: {
        const { transportId, producerId, rtpCapabilities } = data;
        
        const transport = this.#assertAndGetWebRtcTransport(transportId);

        const canConsume = await new Promise<boolean>((resolve) => {
          this.emit('get-can-consume', { producerId, rtpCapabilities }, resolve);
        });

        if (!canConsume) {
          throw new InvalidRequestError('Cannot consume');
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        this.#consumers.set(consumer.id, consumer);
        this.#handleConsumer(consumer);

        return {
          consumerId: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused,
        };
      }

      case REQUEST_METHODS.RESUME_CONSUMER: {
        const { consumerId } = data;
        const consumer = this.#assertAndGetConsumer(consumerId);

        await consumer.resume();
        return {};
      }

      case REQUEST_METHODS.PAUSE_CONSUMER: {
        const { consumerId } = data;
        const consumer = this.#assertAndGetConsumer(consumerId);

        await consumer.pause();
        return {};
      }

      case REQUEST_METHODS.CLOSE_PRODUCER: {
        const { producerId } = data;
        const producer = this.#assertAndGetProducer(producerId);

        producer.close();
        this.#producers.delete(producerId);
        return {};
      }

      case REQUEST_METHODS.CLOSE_CONSUMER: {
        const { consumerId } = data;
        const consumer = this.#assertAndGetConsumer(consumerId);

        consumer.close();
        this.#consumers.delete(consumerId);
        return {};
      }

      case REQUEST_METHODS.CLOSE_TRANSPORT: {
        const { transportId } = data;
        const transport = this.#assertAndGetWebRtcTransport(transportId);

        transport.close();
        this.#transports.delete(transportId);
        return {};
      }

      default: {
        throw new InvalidRequestError(`Unknown method: ${method}`);
      }
    }
  }

  #handleTransport(transport: mediasoup.types.WebRtcTransport): void {
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('@close', () => {
      this.#transports.delete(transport.id);
      this.notify(NOTIFICATION_METHODS.TRANSPORT_CLOSED, { transportId: transport.id });
    });

    transport.on('@newproducer', (producer) => {
      this.#producers.set(producer.id, producer);
    });

    transport.on('@producerclose', (producer) => {
      this.#producers.delete(producer.id);
    });

    // Note: Consumer events are handled in the consumer creation process
  }

  #handleProducer(producer: mediasoup.types.Producer): void {
    producer.on('@close', () => {
      this.#producers.delete(producer.id);
      this.notify(NOTIFICATION_METHODS.PRODUCER_CLOSED, { producerId: producer.id });
      this.emit('producer-closed', { producer });
    });

    producer.on('videoorientationchange', (videoOrientation: any) => {
      this.notify('producerVideoOrientationChanged', {
        producerId: producer.id,
        videoOrientation,
      });
    });
  }

  #handleConsumer(consumer: mediasoup.types.Consumer): void {
    consumer.on('@close', () => {
      this.#consumers.delete(consumer.id);
      this.notify(NOTIFICATION_METHODS.CONSUMER_CLOSED, { consumerId: consumer.id });
    });

    consumer.on('producerpause', () => {
      this.notify('consumerPaused', { consumerId: consumer.id });
    });

    consumer.on('producerresume', () => {
      this.notify('consumerResumed', { consumerId: consumer.id });
    });

    consumer.on('score', (score: any) => {
      this.notify('consumerScore', {
        consumerId: consumer.id,
        score,
      });
    });
  }

  #assertAndGetWebRtcTransport(transportId: string): mediasoup.types.WebRtcTransport {
    const transport = this.#transports.get(transportId);
    if (!transport) {
      throw new TransportNotFoundError(`Transport with id "${transportId}" not found`);
    }
    return transport;
  }

  #assertAndGetProducer(producerId: string): mediasoup.types.Producer {
    const producer = this.#producers.get(producerId);
    if (!producer) {
      throw new ProducerNotFoundError(`Producer with id "${producerId}" not found`);
    }
    return producer;
  }

  #assertAndGetConsumer(consumerId: string): mediasoup.types.Consumer {
    const consumer = this.#consumers.get(consumerId);
    if (!consumer) {
      throw new ConsumerNotFoundError(`Consumer with id "${consumerId}" not found`);
    }
    return consumer;
  }

  notify(method: string, data?: any): void {
    if (this.#closed) return;
    
    this.#socket.emit('notification', { method, data });
  }

  async consume({ producer }: { producer: mediasoup.types.Producer }): Promise<void> {

    console.log('Hello from peer :', this.#peerId ,this.#socket.id);
    const transport = this.#getConsumerWebRtcTransport();
    
    if (!transport) {
      console.log('Hello from peer Transport not found :', this.#peerId ,this.#socket.id);
      return;
    }
    const canConsume = await new Promise<boolean>((resolve) => {
      this.emit('get-can-consume',
        { producerId: producer.id, rtpCapabilities: this.#rtpCapabilities! },
        resolve
      );
    });

    if (!canConsume) {
      console.log('Hello from peer Cannot consume :', this.#peerId ,this.#socket.id);
      return;
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: this.#rtpCapabilities!,
      paused: true,
    });


    console.log('Hello from peer Consumer created :', this.#peerId ,this.#socket.id);

    this.#consumers.set(consumer.id, consumer);
    this.#handleConsumer(consumer);

    // Notify client
    console.log('Hello from peer Notifying client :', this.#peerId ,this.#socket.id);
    await this.#request('newConsumer', {
      peerId: (producer.appData as any).peerId,
      producerId: producer.id,
      consumerId: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    });

    await consumer.resume();
  }

  #getConsumerWebRtcTransport(): mediasoup.types.WebRtcTransport | undefined {
    const transport = Array.from(this.#transports.values()).find((t) => t.appData.direction === 'recv');
    return transport;
  }

  async #request(method: string, data?: any): Promise<any> {
    console.log('request() sending request:', method, this.#peerId ,this.#socket.id);
    return new Promise((resolve, reject) => {
      console.log('request() sending request:', method, this.#peerId ,this.#socket.id);
      this.#socket.emit('request', { method, data }, (response: SocketResponse) => {
        if (response.ok) {
          console.log('request() received response:', response.data);
          resolve(response.data);
        } else {
          console.log('request() received error:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  }

  serialize(): PeerInfo {
    return {
      id: this.id,
      displayName: this.#displayName || '',
      device: this.#device,
      joined: this.#joined,
      rtpCapabilities: this.#rtpCapabilities,
      sctpCapabilities: this.#sctpCapabilities,
      producers: Array.from(this.#producers.values()),
      
    };
  }

  close(): void {
    if (this.#closed) return;

    this.#logger.debug('close()');

    this.#closed = true;

    // Close all transports
    for (const transport of this.#transports.values()) {
      transport.close();
    }

    // Close all producers
    for (const producer of this.#producers.values()) {
      producer.close();
    }

    // Close all consumers
    for (const consumer of this.#consumers.values()) {
      consumer.close();
    }

    // Close all data producers
    for (const dataProducer of this.#dataProducers.values()) {
      dataProducer.close();
    }

    // Close all data consumers
    for (const dataConsumer of this.#dataConsumers.values()) {
      dataConsumer.close();
    }

    this.#socket.disconnect(true);
  }
}
