import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { getDeviceInfo } from './utils';

export interface PeerInfo {
  id: string;
  displayName: string;
  device: any;
  joined: boolean;
  rtpCapabilities?: mediasoupClient.types.RtpCapabilities;
  sctpCapabilities?: any;
}

export interface RoomClientEvents {
  'connected': () => void;
  'disconnected': () => void;
  'new-peer': (peer: PeerInfo) => void;
  'peer-closed': (peerId: string) => void;
  'active-speaker': (peerId: string) => void;
  'speaking-peers': (peerVolumes: Array<{ peerId: string; volume: number }>) => void;
  'new-consumer': (consumerData: { consumerId: string; peerId: string; kind: string; track: MediaStreamTrack }) => void;
  'consumer-closed': (consumerId: string) => void;
  'producer-closed': (producerId: string) => void;
  'transport-closed': (transportId: string) => void;
  'production-started': () => void;
}
const PC_PROPRIETARY_CONSTRAINTS =
{
	optional : [ { googDscp: true } ]
};

export class RoomClient {
  private socket?: Socket;
  private mediasoupDevice?: mediasoupClient.Device;
  private sendTransport?: mediasoupClient.types.Transport;
  private recvTransport?: mediasoupClient.types.Transport;
  private sendTransportServerDtlsParams: any = null;
  private recvTransportServerDtlsParams: any = null;
  private producers: Map<string, mediasoupClient.types.Producer> = new Map();
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private peers: Map<string, PeerInfo> = new Map();
  private localStream?: MediaStream;
  private localVideoTrack?: MediaStreamTrack;
  private localAudioTrack?: MediaStreamTrack;
  private isProducing = false;
  private isConsuming = false;

  constructor(private serverUrl: string = 'http://localhost:3000') {}

  async join({ roomId, peerId, displayName }: {
    roomId: string;
    peerId: string;
    displayName: string;
  }): Promise<void> {
    console.log('Joining room:', { roomId, peerId, displayName });
    
    // Connect Socket.io
    this.socket = io(`${this.serverUrl}?roomId=${roomId}&peerId=${peerId}`, {
      transports: ['websocket'],
      timeout: 20000,
    });

    console.log('Socket created, setting up...');
      await this.setupSocket();
    
      // Load device
      const { routerRtpCapabilities } = await this.request('getRouterRtpCapabilities');
      console.log('Creating mediasoup device...');
      console.log('User agent:', navigator.userAgent);
      console.log('MediaDevices supported:', !!navigator.mediaDevices);
      console.log('getUserMedia supported:', !!navigator.mediaDevices?.getUserMedia);
      
      // Check WebRTC support
      console.log('RTCPeerConnection supported:', !!window.RTCPeerConnection);
      console.log('WebRTC getStats supported:', !!(window.RTCPeerConnection && window.RTCPeerConnection.prototype.getStats));
      
      // Check for known problematic browsers
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
      const isFirefox = /Firefox/.test(navigator.userAgent);
      
      console.log('Browser detection:', { isIOS, isSafari, isChrome, isFirefox });
      
      if (isIOS) {
        console.warn('iOS detected - mediasoup has known limitations on iOS devices');
      }
      
      this.mediasoupDevice = new mediasoupClient.Device();
    
      
      // Check if RTP capabilities are valid
      if (!routerRtpCapabilities || !routerRtpCapabilities.codecs || routerRtpCapabilities.codecs.length === 0) {
        throw new Error('Invalid or empty router RTP capabilities received from server');
      }
      
      await this.mediasoupDevice.load({ routerRtpCapabilities: routerRtpCapabilities });

      console.log('Can produce video:', this.mediasoupDevice.canProduce('video'));
      console.log('Can produce audio:', this.mediasoupDevice.canProduce('audio'));
      


    // Join room
    console.log('Joining room with device info...');
    

    // Create transports
    console.log('Creating transports...');
    await this.createTransports();


    const { peers } = await this.request('join', {
      displayName,
      device: getDeviceInfo(),
      rtpCapabilities: this.mediasoupDevice.rtpCapabilities,
      sctpCapabilities: this.mediasoupDevice.sctpCapabilities,
    });
    console.log('Joined room successfully, peers:', peers);
    

    // Handle existing peers
    console.log('Handling existing peers...');
    console.log('Number of existing peers:', peers.length);
    for (const peer of peers) {
      console.log('Handling existing peer:', peer);
      this.handleNewPeer(peer);
    }
    console.log('Finished handling existing peers. Server should now send newConsumer requests for existing producers.');


    // Start producing media
    console.log('Starting to produce media...');
    await this.produceMedia();
    console.log('Media production started');


  }

  private setupSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      // Set a timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        console.log('Connected to server');
        clearTimeout(timeout);
        this.emit('connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        clearTimeout(timeout);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.emit('disconnected');
      });

      this.socket.on('notification', ({ method, data }) => {
        this.handleNotification(method, data);
      });

      this.socket.on('request', async ({ method, data }, callback) => {
        try {
          const response = await this.handleRequest(method, data);
          callback({ ok: true, data: response });
        } catch (error) {
          callback({ ok: false, error: (error as Error).message });
        }
      });
    });
  }

  private async request(method: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      console.log(`Sending request: ${method}`, data);
      
      // Set a timeout for the request
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for ${method}`));
      }, 15000);

      this.socket.emit('request', { method, data }, (response: any) => {
        clearTimeout(timeout);
        console.log(`Received response for ${method}:`, response);
        if (response.ok) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  private async handleRequest(method: string, data: any): Promise<any> {
    console.log(`Client received request: ${method}`, data);
    
    switch (method) {
      case 'newConsumer': {
        console.log('=== NEW CONSUMER REQUEST ===');
        console.log('This should create a consumer for an existing peer\'s producer');
        console.log('Request data:', JSON.stringify(data, null, 2));
        const { peerId, producerId, consumerId, kind, rtpParameters } = data;
        console.log(`Creating consumer ${consumerId} for peer ${peerId}, producer ${producerId}, kind ${kind}`);
        
        if (!this.recvTransport) {
          console.error('❌ No receive transport available for consumer creation');
          throw new Error('No receive transport available');
        }

        console.log('✅ Receive transport is available, creating consumer...');
        const consumer = await this.recvTransport.consume({
          id: consumerId,
          producerId,
          kind,
          rtpParameters,
        });

        console.log(`✅ Consumer ${consumerId} created successfully`);
        console.log('Consumer track details:', {
          trackExists: !!consumer.track,
          trackId: consumer.track?.id,
          trackKind: consumer.track?.kind,
          trackEnabled: consumer.track?.enabled,
          trackReadyState: consumer.track?.readyState,
          trackMuted: consumer.track?.muted
        });

        this.consumers.set(consumer.id, consumer);
        console.log(`📊 Total consumers now: ${this.consumers.size}`);
        
        // Add consumer event listeners
        consumer.on('transportclose', () => {
          console.log(`Consumer ${consumerId} transport closed`);
        });
        
        consumer.on('@close', () => {
          console.log(`Consumer ${consumerId} closed`);
        });
        
        consumer.on('@pause', () => {
          console.log(`Consumer ${consumerId} producer paused`);
        });
        
        consumer.on('@resume', () => {
          console.log(`Consumer ${consumerId} producer resumed`);
        });
        
        // Resume the consumer to start receiving media
        console.log(`🔄 Resuming consumer ${consumerId}...`);
        await consumer.resume();
        console.log(`✅ Consumer ${consumerId} resumed successfully`);
        
        console.log('📡 Emitting new-consumer event to React components...');
        this.handleConsumer(consumer, peerId);
        console.log('✅ new-consumer event emitted');

        return {};
      }
      default:
        throw new Error(`Unknown request method: ${method}`);
    }
  }

  private handleNotification(method: string, data: any): void {
    switch (method) {
      case 'newPeer':
        this.handleNewPeer(data.peer);
        break;
      case 'peerClosed':
        this.handlePeerClosed(data.peerId);
        break;
      case 'activeSpeaker':
        this.emit('active-speaker', data.peerId);
        break;
      case 'speakingPeers':
        this.emit('speaking-peers', data.peerVolumes);
        break;
      case 'newConsumer':
        // This is handled in handleRequest
        
        break;
      case 'consumerClosed':
        this.handleConsumerClosed(data.consumerId);
        break;
      case 'producerClosed':
        this.handleProducerClosed(data.producerId);
        break;
      case 'transportClosed':
        this.handleTransportClosed(data.transportId);
        break;
    }
  }

  private handleNewPeer(peer: PeerInfo): void {
    this.peers.set(peer.id, peer);
    this.emit('new-peer', peer);
  }

  private handlePeerClosed(peerId: string): void {
    this.peers.delete(peerId);
    this.emit('peer-closed', peerId);
  }

  private handleConsumer(consumer: mediasoupClient.types.Consumer, peerId: string): void {
    consumer.on('transportclose', () => {
      this.consumers.delete(consumer.id);
      this.emit('consumer-closed', consumer.id);
    });

    // Emit the consumer with track information in the format expected by Redux
    const consumerData = {
      consumerId: consumer.id,
      peerId,
      kind: consumer.kind,
      track: consumer.track
    };
    
    console.log('📡 Emitting new-consumer event with data:', consumerData);
    console.log('Track details for emission:', {
      trackExists: !!consumer.track,
      trackId: consumer.track?.id,
      trackKind: consumer.track?.kind,
      trackEnabled: consumer.track?.enabled,
      trackReadyState: consumer.track?.readyState
    });
    
    this.emit('new-consumer', consumerData);
    console.log('✅ new-consumer event emitted successfully');
  }

  private handleConsumerClosed(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
      this.emit('consumer-closed', consumerId);
    }
  }

  private handleProducerClosed(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
      this.emit('producer-closed', producerId);
    }
  }

  private handleTransportClosed(transportId: string): void {
    if (this.sendTransport?.id === transportId) {
      this.sendTransport = undefined;
    }
    if (this.recvTransport?.id === transportId) {
      this.recvTransport = undefined;
    }
    this.emit('transport-closed', transportId);
  }

  private async createTransports(): Promise<void> {
    if (!this.mediasoupDevice) {
      throw new Error('Device not loaded');
    }

    // Test WebRTC server connectivity
    console.log('=== WEBRTC SERVER CONNECTIVITY TEST ===');
    try {
      const testResponse = await fetch(`${this.serverUrl}/health`);
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log('✅ Server is accessible via HTTP');
        console.log('Server health:', healthData);
      } else {
        console.warn('⚠️ Server HTTP response:', testResponse.status);
      }
    } catch (error) {
      console.error('❌ Server connectivity test failed:', error);
      console.error('This might indicate network issues');
    }

    console.log('Creating send transport...');
    // Create send transport
    console.log('Creating send transport with UDP preference...');
    const sendTransportData = await this.request('createWebRtcTransport', {
      sctpCapabilities: this.mediasoupDevice.sctpCapabilities,
      forceTcp: false,
      producing        : true,
      consuming        : false,
      appData: { direction: 'send' },
    });
    console.log('Send transport data received:', sendTransportData);

    this.sendTransport = this.mediasoupDevice.createSendTransport({
      id: sendTransportData.transportId,
      iceParameters: sendTransportData.iceParameters,
      iceCandidates: sendTransportData.iceCandidates,
      dtlsParameters: sendTransportData.dtlsParameters,
      sctpParameters: sendTransportData.sctpParameters,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      // proprietaryConstraints : PC_PROPRIETARY_CONSTRAINTS

    });

    // Store the server's DTLS parameters for connection
    this.sendTransportServerDtlsParams = sendTransportData.dtlsParameters;

    // Add transport event listeners
    this.sendTransport.on('connectionstatechange', (state) => {
      console.log('Send transport connection state changed:', state);
      console.log('=== SEND TRANSPORT DIAGNOSTICS ===');
      console.log('Transport ID:', this.sendTransport!.id);
      console.log('Transport closed:', this.sendTransport!.closed);
      console.log('Connection state:', state);
      console.log('ICE gathering state:', this.sendTransport!.iceGatheringState);
      console.log('Transport app data:', this.sendTransport!.appData);
      
      if (state === 'connected') {
        console.log('✅ Send transport is now connected and ready for media');
      } else if (state === 'failed') {
        console.error('❌ Send transport connection failed - local media will not be sent');
        console.error('=== FAILURE DIAGNOSTICS ===');
        console.error('This usually indicates:');
        console.error('1. WebRTC server is not accessible');
        console.error('2. Firewall blocking UDP/TCP ports');
        console.error('3. DTLS handshake failed');
        console.error('4. ICE candidates cannot reach server');
        console.error('5. Network connectivity issues');
      } else if (state === 'connecting') {
        console.log('🔄 Send transport is connecting...');
      } else if (state === 'disconnected') {
        console.log('⚠️ Send transport disconnected');
      }
    });

    // Note: iceconnectionstatechange is not available in mediasoup-client

    this.sendTransport.on('icegatheringstatechange', (state) => {
      console.log('Send transport ICE gathering state changed:', state);
      if (state === 'complete') {
        console.log('✅ Send transport ICE gathering complete');
        console.log('=== ICE GATHERING COMPLETE ===');
        console.log('Note: ICE candidates are not accessible on client-side transport');
        console.log('ICE connectivity will be tested during connection attempt');
      } else if (state === 'gathering') {
        console.log('🔄 Send transport ICE gathering in progress...');
      } else if (state === 'new') {
        console.log('🆕 Send transport ICE gathering starting...');
      }
    });

    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        console.log(`Send transport connecting...`, this.sendTransport!.id);
        console.log('=== CLIENT DTLS PARAMETERS (Generated) ===');
        console.log('Client DTLS role:', dtlsParameters.role);
        console.log('Client DTLS fingerprints:', JSON.stringify(dtlsParameters.fingerprints, null, 2));
        
        // Log the specific SHA-256 fingerprint for comparison
        const sha256Fingerprint = dtlsParameters.fingerprints.find(fp => fp.algorithm === 'sha-256');
        if (sha256Fingerprint) {
          console.log('Client SHA-256 fingerprint:', sha256Fingerprint.value);
        }
        
        console.log('=== SERVER DTLS PARAMETERS (Stored) ===');
        console.log('Server DTLS role:', this.sendTransportServerDtlsParams?.role);
        console.log('Server DTLS fingerprints:', JSON.stringify(this.sendTransportServerDtlsParams?.fingerprints, null, 2));
        
        // Use client-generated DTLS parameters (this is the correct approach)
        console.log('Using client-generated DTLS parameters for connection');
        console.log('=== CONNECTION ATTEMPT DEBUG ===');
        console.log('Transport ID:', this.sendTransport!.id);
        console.log('ICE gathering state:', this.sendTransport!.iceGatheringState);
        
        try {
          const response = await this.request('connectWebRtcTransport', {
            transportId: this.sendTransport!.id,
            dtlsParameters,
          });
          console.log('✅ Send transport connected successfully, response:', response);
          callback();
        } catch (connectError) {
          console.error('❌ Transport connection failed with error:', connectError);
          console.error('=== CONNECTION FAILURE ANALYSIS ===');
          console.error('This could be due to:');
          console.error('1. ICE connectivity check failed - no valid path found');
          console.error('2. WebRTC server not accessible from client');
          console.error('3. Firewall blocking UDP/TCP traffic');
          console.error('4. NAT traversal issues');
          console.error('5. Network configuration problems');
          throw connectError;
        }
      } catch (error) {
        console.error('❌ Send transport connection failed:', error);
        console.error('Error details:', error);
        console.error('Transport state:', this.sendTransport!.connectionState);
        console.error('Transport closed:', this.sendTransport!.closed);
        console.error('=== DTLS FINGERPRINT MISMATCH ANALYSIS ===');
        console.error('This error usually indicates:');
        console.error('1. DTLS certificate fingerprints don\'t match');
        console.error('2. Client and server are using different certificates');
        console.error('3. The transport was created with different DTLS parameters');
        errback(error as Error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        console.log(`Creating ${kind} producer...`, { transportId: this.sendTransport!.id, appData });
        const { producerId } = await this.request('produce', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters,
          appData,
        });
        console.log(`${kind} producer created successfully:`, producerId);
        callback({ id: producerId });
      } catch (error) {
        console.error(`Failed to create ${kind} producer:`, error);
        errback(error as Error);
      }
    });

    // Create receive transport
    console.log('Creating receive transport...');
    const recvTransportData = await this.request('createWebRtcTransport', {
      sctpCapabilities: this.mediasoupDevice.sctpCapabilities,
      forceTcp: false,
      appData: { direction: 'recv' },
    });
    console.log('Receive transport data received:', recvTransportData);

    this.recvTransport = this.mediasoupDevice.createRecvTransport({
      id: recvTransportData.transportId,
      iceParameters: recvTransportData.iceParameters,
      iceCandidates: recvTransportData.iceCandidates,
      dtlsParameters: recvTransportData.dtlsParameters,
      sctpParameters: recvTransportData.sctpParameters,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
    });

    // Store the server's DTLS parameters for connection
    this.recvTransportServerDtlsParams = recvTransportData.dtlsParameters;

    // Add transport event listeners
    this.recvTransport.on('connectionstatechange', (state) => {
      console.log('Receive transport connection state changed:', state);
      console.log('=== RECEIVE TRANSPORT DIAGNOSTICS ===');
      console.log('Transport ID:', this.recvTransport!.id);
      console.log('Transport closed:', this.recvTransport!.closed);
      console.log('Connection state:', state);
      console.log('ICE gathering state:', this.recvTransport!.iceGatheringState);
      console.log('Transport app data:', this.recvTransport!.appData);
      
      if (state === 'connected') {
        console.log('✅ Receive transport is now connected and ready to receive media');
      } else if (state === 'failed') {
        console.error('❌ Receive transport connection failed - remote media will not be received');
        console.error('=== FAILURE DIAGNOSTICS ===');
        console.error('This usually indicates:');
        console.error('1. WebRTC server is not accessible');
        console.error('2. Firewall blocking UDP/TCP ports');
        console.error('3. DTLS handshake failed');
        console.error('4. ICE candidates cannot reach server');
        console.error('5. Network connectivity issues');
      } else if (state === 'connecting') {
        console.log('🔄 Receive transport is connecting...');
      } else if (state === 'disconnected') {
        console.log('⚠️ Receive transport disconnected');
      }
    });

    // Note: iceconnectionstatechange is not available in mediasoup-client

    this.recvTransport.on('icegatheringstatechange', (state) => {
      console.log('Receive transport ICE gathering state changed:', state);
      if (state === 'complete') {
        console.log('Receive transport ICE gathering complete');
      }
    });

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        console.log('Receive transport connecting...', this.recvTransport!.id);
        console.log('=== CLIENT DTLS PARAMETERS (Generated) ===');
        console.log('Client DTLS role:', dtlsParameters.role);
        console.log('Client DTLS fingerprints:', JSON.stringify(dtlsParameters.fingerprints, null, 2));
        
        // Log the specific SHA-256 fingerprint for comparison
        const sha256Fingerprint = dtlsParameters.fingerprints.find(fp => fp.algorithm === 'sha-256');
        if (sha256Fingerprint) {
          console.log('Client SHA-256 fingerprint:', sha256Fingerprint.value);
        }
        
        console.log('=== SERVER DTLS PARAMETERS (Stored) ===');
        console.log('Server DTLS role:', this.recvTransportServerDtlsParams?.role);
        console.log('Server DTLS fingerprints:', JSON.stringify(this.recvTransportServerDtlsParams?.fingerprints, null, 2));
        
        // Use client-generated DTLS parameters (this is the correct approach)
        console.log('Using client-generated DTLS parameters for connection');
        await this.request('connectWebRtcTransport', {
          transportId: this.recvTransport!.id,
          dtlsParameters,
        });
        console.log('✅ Receive transport connected successfully');
        callback();
      } catch (error) {
        console.error('❌ Receive transport connection failed:', error);
        console.error('Error details:', error);
        errback(error as Error);
      }
    });
  }

  private async produceMedia(): Promise<void> {
    console.log('produceMedia called, sendTransport:', !!this.sendTransport, 'isProducing:', this.isProducing);
    
    if (!this.sendTransport || this.isProducing) {
      console.log('Skipping media production - no transport or already producing');
      return;
    }

    try {
      console.log('Requesting user media...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }
      
      // console.log('Checking device capabilities...');
      // console.log('Device loaded:', this.mediasoupDevice?.loaded);
      // console.log('Device RTP capabilities:', this.mediasoupDevice?.rtpCapabilities);
      console.log('Can produce video:', this.mediasoupDevice?.canProduce('video'));
      console.log('Can produce audio:', this.mediasoupDevice?.canProduce('audio'));
      
      if (!this.mediasoupDevice?.canProduce('video')) {
        // console.error("Video is not supported by the mediasoup device");
        // console.error("This could be due to:");
        // console.error("1. Router RTP capabilities missing video codecs");
        // console.error("2. Browser compatibility issues");
        // console.error("3. Device not properly loaded");
        
        // Check if we can at least produce audio
        if (this.mediasoupDevice?.canProduce('audio')) {
          console.log("Video not supported, but audio is available. Proceeding with audio-only mode.");
        } else {
          console.error("Neither video nor audio is supported. Cannot produce media.");
          return;
        }
      }



      // Determine what media to request based on device capabilities
      const mediaConstraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      };
      
      // Only request video if the device can produce it
      if (this.mediasoupDevice?.canProduce('video')) {
        mediaConstraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        };
      } else {
        console.log('Skipping video constraints as device cannot produce video');
      }
      
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log('User media obtained:', this.localStream);

      this.localVideoTrack = this.localStream.getVideoTracks()[0];
      this.localAudioTrack = this.localStream.getAudioTracks()[0];
      console.log('Video track:', this.localVideoTrack, 'Audio track:', this.localAudioTrack);

      // Produce video
      if (this.localVideoTrack && this.mediasoupDevice?.canProduce('video')) {
        // console.log('Producing video...');
        // console.log('Video track details:', {
        //   id: this.localVideoTrack.id,
        //   kind: this.localVideoTrack.kind,
        //   enabled: this.localVideoTrack.enabled,
        //   readyState: this.localVideoTrack.readyState,
        //   muted: this.localVideoTrack.muted
        // });
        
        const videoProducer = await this.sendTransport.produce({
          track: this.localVideoTrack,
          appData: { source: 'webcam' },
        });
        // console.log('Video producer created:', videoProducer.id);
        // console.log('Video producer details:', {
        //   id: videoProducer.id,
        //   kind: videoProducer.kind,
        //   closed: videoProducer.closed,
        //   paused: videoProducer.paused
        // });
        
        // Add producer event listeners
        videoProducer.on('transportclose', () => {
          console.log('Video producer transport closed');
        });
        
        videoProducer.on('@close', () => {
          console.log('Video producer closed');
        });
        
        this.producers.set(videoProducer.id, videoProducer);
      } else if (this.localVideoTrack && !this.mediasoupDevice?.canProduce('video')) {
        console.log('Video track available but device cannot produce video, skipping video production');
      } else {
        console.log('No video track available');
      }

      // Produce audio
      if (this.localAudioTrack) {
        console.log('Producing audio...');
        console.log('Audio track details:', {
          id: this.localAudioTrack.id,
          kind: this.localAudioTrack.kind,
          enabled: this.localAudioTrack.enabled,
          readyState: this.localAudioTrack.readyState,
          muted: this.localAudioTrack.muted
        });
        
        const audioProducer = await this.sendTransport.produce({
          track: this.localAudioTrack,
          appData: { source: 'mic' },
        });
        console.log('Audio producer created:', audioProducer.id);
        console.log('Audio producer details:', {
          id: audioProducer.id,
          kind: audioProducer.kind,
          closed: audioProducer.closed,
          paused: audioProducer.paused
        });
        
        // Add producer event listeners
        audioProducer.on('transportclose', () => {
          console.log('Audio producer transport closed');
        });
        
        audioProducer.on('@close', () => {
          console.log('Audio producer closed');
        });
        
        this.producers.set(audioProducer.id, audioProducer);
      }

      this.isProducing = true;
      console.log('Media production completed, emitting production-started event');
      this.emit('production-started');
    } catch (error) {
      console.error('Failed to produce media:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.error('Media access denied by user');
          alert('Camera and microphone access is required for video conferencing. Please allow access and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          console.error('No media devices found');
          alert('No camera or microphone found. Please connect a camera and microphone and refresh the page.');
        } else if (error.name === 'NotReadableError') {
          console.error('Media device is already in use');
          alert('Camera or microphone is already in use by another application. Please close other applications and refresh the page.');
        } else {
          console.error('Unknown media error:', error.message);
          alert('Failed to access camera and microphone. Please check your device permissions and refresh the page.');
        }
      }
    }
  }

  async toggleVideo(): Promise<void> {
    if (this.localVideoTrack) {
      this.localVideoTrack.enabled = !this.localVideoTrack.enabled;
    }
  }

  async toggleAudio(): Promise<void> {
    if (this.localAudioTrack) {
      this.localAudioTrack.enabled = !this.localAudioTrack.enabled;
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.sendTransport) {
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0];

      // Produce screen video
      if (screenVideoTrack) {
        const screenProducer = await this.sendTransport.produce({
          track: screenVideoTrack,
          appData: { source: 'screen' },
        });
        this.producers.set(screenProducer.id, screenProducer);
      }

      // Produce screen audio
      if (screenAudioTrack) {
        const screenAudioProducer = await this.sendTransport.produce({
          track: screenAudioTrack,
          appData: { source: 'screen-audio' },
        });
        this.producers.set(screenAudioProducer.id, screenAudioProducer);
      }
    } catch (error) {
      console.error('Failed to share screen:', error);
    }
  }

  getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  getPeers(): Map<string, PeerInfo> {
    return this.peers;
  }

  getConsumers(): Map<string, mediasoupClient.types.Consumer> {
    return this.consumers;
  }

  getProducers(): Map<string, mediasoupClient.types.Producer> {
    return this.producers;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
    }
    if (this.recvTransport) {
      this.recvTransport.close();
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  // Event emitter functionality
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }
}
