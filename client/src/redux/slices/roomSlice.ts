import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PeerInfo } from '../../RoomClient';

export interface RoomState {
  roomId: string | null;
  peerId: string | null;
  displayName: string | null;
  isConnected: boolean;
  isProducing: boolean;
  isConsuming: boolean;
  peers: Record<string, PeerInfo>;
  activeSpeaker: string | null;
  speakingPeers: Array<{ peerId: string; volume: number }>;
  localStream: MediaStream | null;
  consumers: Record<string, { consumerId: string; peerId: string; kind: string; track: MediaStreamTrack }>;
  stats: {
    totalPeers: number;
    totalProducers: number;
    totalConsumers: number;
  };
}

const initialState: RoomState = {
  roomId: null,
  peerId: null,
  displayName: null,
  isConnected: false,
  isProducing: false,
  isConsuming: false,
  peers: {},
  activeSpeaker: null,
  speakingPeers: [],
  localStream: null,
  consumers: {},
  stats: {
    totalPeers: 0,
    totalProducers: 0,
    totalConsumers: 0,
  },
};

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setRoomId: (state, action: PayloadAction<string>) => {
      state.roomId = action.payload;
    },
    setPeerId: (state, action: PayloadAction<string>) => {
      state.peerId = action.payload;
    },
    setDisplayName: (state, action: PayloadAction<string>) => {
      state.displayName = action.payload;
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setProducing: (state, action: PayloadAction<boolean>) => {
      state.isProducing = action.payload;
    },
    setConsuming: (state, action: PayloadAction<boolean>) => {
      state.isConsuming = action.payload;
    },
    addPeer: (state, action: PayloadAction<PeerInfo>) => {
      state.peers[action.payload.id] = action.payload;
      state.stats.totalPeers = Object.keys(state.peers).length;
    },
    removePeer: (state, action: PayloadAction<string>) => {
      delete state.peers[action.payload];
      state.stats.totalPeers = Object.keys(state.peers).length;
    },
    setActiveSpeaker: (state, action: PayloadAction<string | null>) => {
      state.activeSpeaker = action.payload;
    },
    setSpeakingPeers: (state, action: PayloadAction<Array<{ peerId: string; volume: number }>>) => {
      state.speakingPeers = action.payload;
    },
    setLocalStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.localStream = action.payload;
    },
    updateStats: (state, action: PayloadAction<{ totalProducers: number; totalConsumers: number }>) => {
      state.stats.totalProducers = action.payload.totalProducers;
      state.stats.totalConsumers = action.payload.totalConsumers;
    },
    addConsumer: (state, action: PayloadAction<{ consumerId: string; peerId: string; kind: string; track: MediaStreamTrack }>) => {
      state.consumers[action.payload.consumerId] = action.payload;
      state.stats.totalConsumers = Object.keys(state.consumers).length;
    },
    removeConsumer: (state, action: PayloadAction<string>) => {
      delete state.consumers[action.payload];
      state.stats.totalConsumers = Object.keys(state.consumers).length;
    },
    resetRoom: (state) => {
      return { ...initialState };
    },
  },
});

export const {
  setRoomId,
  setPeerId,
  setDisplayName,
  setConnected,
  setProducing,
  setConsuming,
  addPeer,
  removePeer,
  setActiveSpeaker,
  setSpeakingPeers,
  setLocalStream,
  updateStats,
  addConsumer,
  removeConsumer,
  resetRoom,
} = roomSlice.actions;

export default roomSlice.reducer;
