import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { PeerInfo } from '../RoomClient';

interface PeerProps {
  peer: PeerInfo;
}

export const Peer: React.FC<PeerProps> = ({ peer }) => {
  const { activeSpeaker, speakingPeers, consumers } = useSelector((state: RootState) => state.room);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingVolume, setSpeakingVolume] = useState(0);

  useEffect(() => {
    const speakingPeer = speakingPeers.find(p => p.peerId === peer.id);
    if (speakingPeer) {
      setIsSpeaking(true);
      setSpeakingVolume(speakingPeer.volume);
    } else {
      setIsSpeaking(false);
      setSpeakingVolume(0);
    }
  }, [speakingPeers, peer.id]);

  // Handle video stream from consumers
  useEffect(() => {
    if (!videoRef.current) return;

    console.log(`🎥 Peer ${peer.id} - checking consumers:`, Object.keys(consumers).length, 'consumers available');
    console.log(`🎥 Peer ${peer.id} - all consumers:`, consumers);

    // Find video consumer for this peer
    const videoConsumer = Object.values(consumers).find(
      consumer => consumer.peerId === peer.id && consumer.kind === 'video'
    );
    const audioConsumer = Object.values(consumers).find(
      consumer => consumer.peerId === peer.id && consumer.kind === 'audio'
    );

    console.log(`🎥 Peer ${peer.id} - video consumer found:`, videoConsumer);

    if (videoConsumer && videoConsumer.track) {
      console.log(`🎥 Attaching video track for peer ${peer.id}:`, {
        trackId: videoConsumer.track.id,
        trackKind: videoConsumer.track.kind,
        trackEnabled: videoConsumer.track.enabled,
        trackReadyState: videoConsumer.track.readyState,
        trackMuted: videoConsumer.track.muted
      });
      
      const mediaStream = new MediaStream([videoConsumer.track]);
      if (audioConsumer && audioConsumer.track) {
        const audioStream = new MediaStream([audioConsumer.track]);
        if (audioRef.current) {
          audioRef.current.srcObject = audioStream;
        }
      }
      videoRef.current.srcObject = mediaStream;
      
      // Add event listeners to track
      videoConsumer.track.addEventListener('ended', () => {
        console.log(`🎥 Video track ended for peer ${peer.id}`);
      });
      
      videoConsumer.track.addEventListener('mute', () => {
        console.log(`🎥 Video track muted for peer ${peer.id}`);
      });
      
      videoConsumer.track.addEventListener('unmute', () => {
        console.log(`🎥 Video track unmuted for peer ${peer.id}`);
      });
      
      console.log(`🎥 Video element srcObject set for peer ${peer.id}`);
    } else {
      console.log(`🎥 No video track found for peer ${peer.id} - available consumers:`, Object.values(consumers).map(c => ({ peerId: c.peerId, kind: c.kind, hasTrack: !!c.track })));
      videoRef.current.srcObject = null;
    }
  }, [consumers, peer.id]);

  const isActiveSpeaker = activeSpeaker === peer.id;

  return (
    <div className={`peer-container ${isActiveSpeaker ? 'active-speaker' : ''} ${isSpeaking ? 'speaking' : ''}`}>
      <div className="video-wrapper">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="peer-video"
        />
        {audioRef.current && <audio ref={audioRef} autoPlay playsInline  className="peer-audio" />}
        <div className="video-overlay">
          <span className="peer-name">{peer.displayName}</span>
          {isSpeaking && (
            <div className="speaking-indicator">
              <div 
                className="volume-bar"
                style={{ height: `${Math.max(speakingVolume * 100, 10)}%` }}
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="peer-info">
        <span className="peer-id">ID: {peer.id}</span>
        <span className="peer-status">
          {peer.joined ? 'Connected' : 'Connecting...'}
        </span>
      </div>
    </div>
  );
};
