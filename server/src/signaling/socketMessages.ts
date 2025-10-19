export interface SocketMessage {
  method: string;
  data?: any;
}

export interface RequestMessage extends SocketMessage {
  method: string;
  data?: any;
}

export interface ResponseMessage {
  ok: boolean;
  data?: any;
  error?: string;
}

export interface NotificationMessage extends SocketMessage {
  method: string;
  data?: any;
}

// Request methods
export const REQUEST_METHODS = {
  GET_ROUTER_RTP_CAPABILITIES: 'getRouterRtpCapabilities',
  JOIN: 'join',
  CREATE_WEBRTC_TRANSPORT: 'createWebRtcTransport',
  CONNECT_WEBRTC_TRANSPORT: 'connectWebRtcTransport',
  PRODUCE: 'produce',
  CONSUME: 'consume',
  RESUME_CONSUMER: 'resumeConsumer',
  PAUSE_CONSUMER: 'pauseConsumer',
  CLOSE_PRODUCER: 'closeProducer',
  CLOSE_CONSUMER: 'closeConsumer',
  CLOSE_TRANSPORT: 'closeTransport',
  GET_PRODUCER_STATS: 'getProducerStats',
  GET_CONSUMER_STATS: 'getConsumerStats',
  GET_TRANSPORT_STATS: 'getTransportStats',
} as const;

// Notification methods
export const NOTIFICATION_METHODS = {
  NEW_PEER: 'newPeer',
  PEER_CLOSED: 'peerClosed',
  ACTIVE_SPEAKER: 'activeSpeaker',
  SPEAKING_PEERS: 'speakingPeers',
  NEW_CONSUMER: 'newConsumer',
  CONSUMER_CLOSED: 'consumerClosed',
  PRODUCER_CLOSED: 'producerClosed',
  TRANSPORT_CLOSED: 'transportClosed',
} as const;

export type SocketRequest = RequestMessage;
export type SocketResponse = ResponseMessage;
export type SocketNotification = NotificationMessage;
export type RequestMethod = typeof REQUEST_METHODS[keyof typeof REQUEST_METHODS];
export type NotificationMethod = typeof NOTIFICATION_METHODS[keyof typeof NOTIFICATION_METHODS];
