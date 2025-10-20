import * as mediasoup from 'mediasoup';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Logger } from './Logger';
import { Peer } from './Peer';
import { SocketConnectionData, PeerInfo, RoomInfo } from './types';
import { appConfig } from './config';

export interface RoomEvents {
  'close': () => void;
  'new-peer': (peer: Peer) => void;
  'peer-disconnected': (peer: Peer) => void;
}

export class Room extends EnhancedEventEmitter<RoomEvents> {
  readonly #roomId: string;
  readonly #config: typeof appConfig;
  readonly #mediasoupRouter: mediasoup.types.Router;
  readonly #mediasoupWebRtcServer: mediasoup.types.WebRtcServer;
  #mediasoupAudioLevelObserver?: mediasoup.types.AudioLevelObserver;
  #mediasoupActiveSpeakerObserver?: mediasoup.types.ActiveSpeakerObserver;
  readonly #logger: Logger;
  readonly #peers: Map<string, Peer> = new Map();
  readonly #joiningPeers: Map<string, Peer> = new Map();
  readonly #closed = false;

  constructor({
    roomId,
    config,
    mediasoupRouter,
    mediasoupWebRtcServer,
  }: {
    roomId: string;
    config: typeof appConfig;
    mediasoupRouter: mediasoup.types.Router;
    mediasoupWebRtcServer: mediasoup.types.WebRtcServer;
  }) {
    super();
    this.#roomId = roomId;
    this.#config = config;
    this.#mediasoupRouter = mediasoupRouter;
    this.#mediasoupWebRtcServer = mediasoupWebRtcServer;
    this.#logger = new Logger(`Room:${roomId}`);

    this.#createAudioLevelObserver();
    this.#createActiveSpeakerObserver();
  }

  static async create({
    roomId,
    config,
    mediasoupRouter,
    mediasoupWebRtcServer,
  }: {
    roomId: string;
    config: typeof appConfig;
    mediasoupRouter: mediasoup.types.Router;
    mediasoupWebRtcServer: mediasoup.types.WebRtcServer;
  }): Promise<Room> {
    const room = new Room({
      roomId,
      config,
      mediasoupRouter,
      mediasoupWebRtcServer,
    });

    return room;
  }

  get id(): string {
    return this.#roomId;
  }

  get closed(): boolean {
    return this.#closed;
  }

  get mediasoupRouter(): mediasoup.types.Router {
    return this.#mediasoupRouter;
  }

  get mediasoupWebRtcServer(): mediasoup.types.WebRtcServer {
    return this.#mediasoupWebRtcServer;
  }

  get peers(): Map<string, Peer> {
    return this.#peers;
  }

  get joiningPeers(): Map<string, Peer> {
    return this.#joiningPeers;
  }

  async #createAudioLevelObserver(): Promise<void> {
    this.#mediasoupAudioLevelObserver = await this.#mediasoupRouter.createAudioLevelObserver({
      maxEntries: 1,
      threshold: -80,
      interval: 800,
    });

    this.#mediasoupAudioLevelObserver.on('volumes', (volumes) => {
      const speakingPeers: Array<{ peerId: string; volume: number }> = [];

        for (const volume of volumes) {
          const peer = this.#getPeerByProducerId(volume.producer.id);
          if (peer) {
            speakingPeers.push({
              peerId: peer.id,
              volume: volume.volume,
            });
          }
        }

      // Notify all peers about speaking peers
      for (const peer of this.#peers.values()) {
        peer.notify('speakingPeers', { peerVolumes: speakingPeers });
      }
    });

    this.#mediasoupAudioLevelObserver.on('silence', () => {
      // Notify all peers about silence
      for (const peer of this.#peers.values()) {
        peer.notify('speakingPeers', { peerVolumes: [] });
      }
    });
  }

  async #createActiveSpeakerObserver(): Promise<void> {
    this.#mediasoupActiveSpeakerObserver = await this.#mediasoupRouter.createActiveSpeakerObserver({
      interval: 800,
    });

    this.#mediasoupActiveSpeakerObserver.on('dominantspeaker', (dominantSpeaker: any) => {
      const peer = this.#getPeerByProducerId(dominantSpeaker.producer.id);
      if (peer) {
        // Notify all peers about active speaker
        for (const otherPeer of this.#peers.values()) {
          otherPeer.notify('activeSpeaker', { peerId: peer.id });
        }
      }
    });
  }

  #getPeerByProducerId(producerId: string): Peer | undefined {
    for (const peer of this.#peers.values()) {
      if (peer.producers.has(producerId)) {
        return peer;
      }
    }
    return undefined;
  }

  processSocketConnection({ socket, peerId, remoteAddress }: SocketConnectionData): void {
    this.#logger.debug('processSocketConnection() [peerId:%s]', peerId);

    // If the Peer is already in the room, close it first
    this.#mayCloseExistingPeer(peerId);

    console.log('processSocketConnection() creating peer [peerId:%s]', peerId);
    const peer = Peer.create({
      socket,
      peerId,
      roomId: this.#roomId,
      remoteAddress,
    });

    this.#joiningPeers.set(peer.id, peer);
    this.#handlePeer(peer);
  }

  #mayCloseExistingPeer(peerId: string): void {
    const existingPeer = this.#peers.get(peerId) || this.#joiningPeers.get(peerId);

    if (existingPeer) {
      this.#logger.debug('mayCloseExistingPeer() closing existing peer [peerId:%s]', peerId);
      existingPeer.close();
    }
  }

  #handlePeer(peer: Peer): void {
    peer.on('joined', (callback) => {
      console.log('handlePeer() peer joined [peerId:%s]', peer.id);

      this.#joiningPeers.delete(peer.id);
      this.#peers.set(peer.id, peer);

      const otherPeers = this.#getOtherPeers(peer);

      // Send existing peers to joining peer
      callback(otherPeers.map(p => p.serialize()));

      // Notify other peers about new peer
      for (const otherPeer of otherPeers) {
        otherPeer.notify('newPeer', { peer: peer.serialize() });

        // Create consumers for existing producers
        for (const producer of otherPeer.producers.values()) {
          console.log('handlePeer() creating consumer for producer [peerId:%s]', peer.id);
          void peer.consume({ producer });
        }
      }

      this.emit('new-peer', peer);
    });

    peer.on('new-producer', ({ producer }) => {
      this.#logger.debug('handlePeer() new producer [peerId:%s, producerId:%s]', peer.id, producer.id);

      // Audio level detection
      if (producer.kind === 'audio') {
        this.#mediasoupAudioLevelObserver?.addProducer({ producerId: producer.id }).catch(() => {});
        this.#mediasoupActiveSpeakerObserver?.addProducer({ producerId: producer.id }).catch(() => {});
      }

      // Distribute to all other peers
      const otherPeers = this.#getOtherPeers(peer);
      for (const otherPeer of otherPeers) {
        void otherPeer.consume({ producer });
      }
    });

    peer.on('producer-closed', ({ producer }) => {
      this.#logger.debug('handlePeer() producer closed [peerId:%s, producerId:%s]', peer.id, producer.id);

      // Notify all other peers about the producer closure
      const otherPeers = this.#getOtherPeers(peer);
      for (const otherPeer of otherPeers) {
        otherPeer.notify('producerClosed', { producerId: producer.id });
      }
    });

    peer.on('disconnected', () => {
      this.#logger.debug('handlePeer() peer disconnected [peerId:%s]', peer.id);

      this.#peers.delete(peer.id);

      const otherPeers = this.#getOtherPeers(peer);
      for (const otherPeer of otherPeers) {
        otherPeer.notify('peerClosed', { peerId: peer.id });
      }

      this.emit('peer-disconnected', peer);

      // If this is the last peer, close the room
      if (this.#peers.size === 0 && this.#joiningPeers.size === 0) {
        this.#logger.debug('handlePeer() last peer left, closing room [roomId:%s]', this.#roomId);
        this.close();
      }
    });

    // Handle WebRTC transport creation
    peer.on('create-webrtc-transport', async ({ direction, sctpCapabilities, forceTcp }, resolve, reject) => {
      try {
        const transport = await this.#mediasoupRouter.createWebRtcTransport({
          webRtcServer: this.#mediasoupWebRtcServer,
          enableUdp: !forceTcp,
          enableTcp: true,
          preferUdp: true,
          appData: { direction },
        });

        resolve(transport);
      } catch (error) {
        this.#logger.error('Failed to create transport for peer [peerId:%s]: %s', peer.id, (error as Error).message);
        reject(error);
      }
    });

    // Handle router RTP capabilities
    peer.on('get-router-rtp-capabilities', (callback) => {
      callback(this.#mediasoupRouter.rtpCapabilities);
    });

    // Handle can consume check
    peer.on('get-can-consume', ({ producerId, rtpCapabilities }, callback) => {
      try {
        const canConsume = this.#mediasoupRouter.canConsume({
          producerId,
          rtpCapabilities,
        });
        callback(canConsume);
      } catch (error) {
        callback(false);
      }
    });
  }

  #getOtherPeers(peer: Peer): Peer[] {
    return Array.from(this.#peers.values()).filter(p => p.id !== peer.id);
  }

  serialize(): RoomInfo {
    return {
      id: this.#roomId,
      peers: Array.from(this.#peers.values()).map(p => p.serialize()),
      router: this.#mediasoupRouter,
    };
  }

  close(): void {
    if (this.#closed) return;

    this.#logger.debug('close()');

    // Close all peers
    for (const peer of this.#peers.values()) {
      peer.close();
    }

    for (const peer of this.#joiningPeers.values()) {
      peer.close();
    }

    this.#peers.clear();
    this.#joiningPeers.clear();

    // Close mediasoup router
    this.#mediasoupRouter.close();

    this.emit('close');
  }
}
