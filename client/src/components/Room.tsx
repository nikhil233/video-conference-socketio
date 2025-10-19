import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { RoomClient } from '../RoomClient';
import { Peer } from './Peer';
import { Me } from './Me';
import { Stats } from './Stats';
import { getRandomRoomId, getRandomPeerId, getRandomDisplayName } from '../utils';
import { setRoomId, setPeerId, setDisplayName, setConnected, setProducing, addPeer, removePeer, setActiveSpeaker, setSpeakingPeers, setLocalStream, addConsumer, removeConsumer, resetRoom } from '../redux/slices/roomSlice';

export const Room: React.FC = () => {
  const dispatch = useDispatch();
  const { roomId, peerId, displayName, isConnected, peers, localStream } = useSelector((state: RootState) => state.room);
  const [roomClient, setRoomClient] = useState<RoomClient | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create');
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputDisplayName, setInputDisplayName] = useState('React User');
  const roomRef = useRef<HTMLDivElement>(null);

  // Check for room ID in URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl && !roomId && !peerId && !displayName) {
      // Auto-join with random name when room ID is in URL
      const newPeerId = getRandomPeerId();
      const newDisplayName = getRandomDisplayName();
      
      dispatch(setRoomId(roomIdFromUrl));
      dispatch(setPeerId(newPeerId));
      dispatch(setDisplayName(newDisplayName));
    }
  }, [roomId, peerId, displayName, dispatch]);

  useEffect(() => {
    const initializeRoom = async () => {
      if (!roomId || !peerId || !displayName) {
        return;
      }

      const client = new RoomClient();
      setRoomClient(client);

      // Set up event listeners
      client.on('connected', () => {
        dispatch(setConnected(true));
      });

      client.on('disconnected', () => {
        dispatch(setConnected(false));
      });

      client.on('new-peer', (peer) => {
        dispatch(addPeer(peer));
      });

      client.on('peer-closed', (peerId) => {
        dispatch(removePeer(peerId));
      });

      client.on('active-speaker', (peerId) => {
        dispatch(setActiveSpeaker(peerId));
      });

      client.on('speaking-peers', (peerVolumes) => {
        dispatch(setSpeakingPeers(peerVolumes));
      });

      client.on('new-consumer', (consumerData) => {
        // Handle new consumer
        dispatch(addConsumer(consumerData));
      });

      client.on('consumer-closed', (consumerId) => {
        dispatch(removeConsumer(consumerId));
      });

      client.on('production-started', () => {
        dispatch(setProducing(true));
        
        // Set local stream when production starts
        const stream = client.getLocalStream();
        if (stream) {
          dispatch(setLocalStream(stream));
        }
      });

      try {
        await client.join({ roomId, peerId, displayName });
      } catch (error) {
        // Handle join error silently
      }
    };

    initializeRoom();

    return () => {
      if (roomClient) {
        roomClient.disconnect();
      }
    };
  }, [roomId, peerId, displayName, dispatch]);

  const handleJoinRoom = () => {
    setShowJoinForm(true);
  };

  const handleCreateRoom = () => {
    // setJoinMode('create');
    // setShowJoinForm(true);
    handleSubmitJoin();
  };

  const handleJoinExistingRoom = () => {
    setJoinMode('join');
    setShowJoinForm(true);
  };

  const handleSubmitJoin = () => {
    if (!inputDisplayName.trim()) {
      alert('Please enter your display name');
      return;
    }

    if (joinMode === 'join' && !inputRoomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    const newRoomId = joinMode === 'create' ? getRandomRoomId() : inputRoomId.trim();
    const newPeerId = getRandomPeerId();
    const newDisplayName = inputDisplayName.trim();

    dispatch(setRoomId(newRoomId));
    dispatch(setPeerId(newPeerId));
    dispatch(setDisplayName(newDisplayName));

    // Reset form
    setShowJoinForm(false);
    setInputRoomId('');
    setInputDisplayName('');
  };

  const handleCancelJoin = () => {
    setShowJoinForm(false);
    setInputRoomId('');
    setInputDisplayName('');
  };

  const handleLeaveRoom = () => {
    if (roomClient) {
      roomClient.disconnect();
    }
    dispatch(resetRoom());
    window.location.href = '/';
  };

  const handleToggleStats = () => {
    setShowStats(!showStats);
  };

  const generateShareUrl = () => {
    if (!roomId) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?room=${roomId}`;
  };

  const copyShareUrl = async () => {
    const shareUrl = generateShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  if (!isConnected) {
    return (
      <div className="room-container">
        <div className="join-room">
          <h1>Video Conference</h1>
          <p>Join a room to start video conferencing</p>
          
          {!showJoinForm ? (
            <div className="join-options">
              <button onClick={handleCreateRoom} className="join-button create">
                Create New Room
              </button>
              <button onClick={handleJoinExistingRoom} className="join-button join">
                Join Existing Room
              </button>
            </div>
          ) : (
            <div className="join-form">
              <h3>{joinMode === 'create' ? 'Create New Room' : 'Join Existing Room'}</h3>
              
              <div className="form-group">
                <label htmlFor="displayName">Display Name:</label>
                <input
                  type="text"
                  id="displayName"
                  value={inputDisplayName}
                  onChange={(e) => setInputDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={50}
                />
              </div>

              {joinMode === 'join' && (
                <div className="form-group">
                  <label htmlFor="roomId">Room ID:</label>
                  <input
                    type="text"
                    id="roomId"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    placeholder="Enter room ID"
                    maxLength={64}
                  />
                </div>
              )}

              <div className="form-actions">
                <button onClick={handleSubmitJoin} className="submit-button">
                  {joinMode === 'create' ? 'Create & Join' : 'Join Room'}
                </button>
                <button onClick={handleCancelJoin} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="room-container" ref={roomRef}>
      <div className="room-header">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <div className="room-id-display">
            <span className="room-id-label">Room ID:</span>
            <span className="room-id-value" onClick={() => navigator.clipboard.writeText(roomId || '')} title="Click to copy">
              {roomId}
            </span>
          </div>
          <div className="share-url-display">
            <span className="share-url-label">Share URL:</span>
            <div className="share-url-container">
              <input 
                type="text" 
                value={generateShareUrl()} 
                readOnly 
                className="share-url-input"
                title="Share this URL with others to join the room"
              />
              <button onClick={copyShareUrl} className="copy-button" title="Copy share URL">
                📋
              </button>
            </div>
          </div>
        </div>
        <div className="room-controls">
          <button onClick={handleToggleStats} className="stats-button">
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          <button onClick={handleLeaveRoom} className="leave-button">
            Leave Room
          </button>
        </div>
      </div>

      <div className="room-content">
        <div className="video-grid">
          <Me />
          {Object.values(peers).map((peer) => (
            <Peer key={peer.id} peer={peer} />
          ))}
        </div>

        {showStats && <Stats />}
      </div>
    </div>
  );
};
