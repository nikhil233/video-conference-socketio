import { Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';

export interface PeerInfo {
  id: string;
  displayName: string;
  device: any;
  joined: boolean;
  rtpCapabilities?: mediasoup.types.RtpCapabilities;
  sctpCapabilities?: mediasoup.types.SctpCapabilities;
  producers?: mediasoup.types.Producer[];
}

export interface RoomInfo {
  id: string;
  peers: PeerInfo[];
  router: mediasoup.types.Router;
}

export interface SocketConnectionData {
  socket: Socket;
  peerId: string;
  remoteAddress: string;
}

export interface CreateRoomData {
  roomId: string;
  consumerReplicas?: number;
}

export interface JoinRoomData {
  displayName: string;
  device: any;
  rtpCapabilities: mediasoup.types.RtpCapabilities;
  sctpCapabilities: mediasoup.types.SctpCapabilities;
}

export interface CreateTransportData {
  direction: 'send' | 'recv';
  sctpCapabilities?: mediasoup.types.SctpCapabilities;
  forceTcp?: boolean;
}

export interface ProduceData {
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: mediasoup.types.RtpParameters;
  appData: any;
}

export interface ConsumeData {
  transportId: string;
  producerId: string;
  rtpCapabilities: mediasoup.types.RtpCapabilities;
}

export interface SocketRequest {
  method: string;
  data?: any;
}

export interface SocketResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

export interface SocketNotification {
  method: string;
  data?: any;
}

export interface WorkerInfo {
  worker: mediasoup.types.Worker;
  webRtcServer: mediasoup.types.WebRtcServer;
  idx: number;
}
