import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface Config {
  mediasoup: {
    numWorkers: number;
    workerSettings: {
      logLevel: string;
      logTags: string[];
    };
    webRtcServerOptions: {
      listenInfos: Array<{
        protocol: 'udp' | 'tcp';
        ip: string;
        announcedAddress?: string;
        port: number;
      }>;
    };
    routerOptions: {
      mediaCodecs: Array<{
        kind: 'audio' | 'video';
        mimeType: string;
        clockRate: number;
        channels?: number;
        parameters?: any;
        rtcpFeedback?: Array<{
          type: string;
          parameter?: string;
        }>;
      }>;
    };
  };
  http: {
    listenIp: string;
    listenPort: number;
    tls?: {
      cert: string;
      key: string;
    };
  };
  domain: string;
}

export const appConfig: Config = {
  mediasoup: {
    numWorkers: parseInt(process.env.MEDIASOUP_NUM_WORKERS || '1'),
    workerSettings: {
      logLevel: process.env.MEDIASOUP_WORKER_LOG_LEVEL || 'warn',
      logTags: (process.env.MEDIASOUP_WORKER_LOG_TAGS || 'info,ice,dtls,rtp,srtp,rtcp').split(','),
    },
    webRtcServerOptions: {
      listenInfos: [
        {
          protocol: 'udp',
          ip: process.env.WEBRTC_LISTEN_IP || '0.0.0.0',
          announcedAddress: process.env.ANNOUNCED_IP || undefined, // Let mediasoup auto-detect
          port: parseInt(process.env.WEBRTC_INITIAL_AVAILABLE_PORT || '40000'),
        },
        {
          protocol: 'tcp',
          ip: process.env.WEBRTC_LISTEN_IP || '0.0.0.0',
          announcedAddress: process.env.ANNOUNCED_IP || undefined, // Let mediasoup auto-detect
          port: parseInt(process.env.WEBRTC_INITIAL_AVAILABLE_PORT || '40000'),
        },
      ],
    },
    routerOptions: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
  },
  http: {
    listenIp: process.env.HTTP_LISTEN_IP || '0.0.0.0',
    listenPort: parseInt(process.env.HTTP_LISTEN_PORT || '3000'),
    tls: process.env.HTTP_TLS_CERT && process.env.HTTP_TLS_KEY ? {
      cert: process.env.HTTP_TLS_CERT,
      key: process.env.HTTP_TLS_KEY,
    } : undefined,
  },
  domain: process.env.DOMAIN || 'localhost:3001',
};
