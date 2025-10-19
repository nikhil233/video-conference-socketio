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

  // Handle video and audio streams from consumers
  useEffect(() => {
    console.log(`🎥 Peer ${peer.id} - checking consumers:`, Object.keys(consumers).length, 'consumers available');
    console.log(`🎥 Peer ${peer.id} - all consumers:`, consumers);

    // Find video and audio consumers for this peer
    const videoConsumer = Object.values(consumers).find(
      consumer => consumer.peerId === peer.id && consumer.kind === 'video'
    );
    const audioConsumer = Object.values(consumers).find(
      consumer => consumer.peerId === peer.id && consumer.kind === 'audio'
    );

    console.log(`🎥 Peer ${peer.id} - video consumer found:`, videoConsumer);
    console.log(`🔊 Peer ${peer.id} - audio consumer found:`, audioConsumer);

    // Handle video track
    if (videoRef.current) {
      if (videoConsumer && videoConsumer.track) {
        console.log(`🎥 Attaching video track for peer ${peer.id}:`, {
          trackId: videoConsumer.track.id,
          trackKind: videoConsumer.track.kind,
          trackEnabled: videoConsumer.track.enabled,
          trackReadyState: videoConsumer.track.readyState,
          trackMuted: videoConsumer.track.muted
        });
        
        const mediaStream = new MediaStream([videoConsumer.track]);
        videoRef.current.srcObject = mediaStream;
        
        // Add event listeners to video track
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
    }

    // Handle audio track
    if (audioRef.current) {
      if (audioConsumer && audioConsumer.track) {
        console.log(`🔊 Attaching audio track for peer ${peer.id}:`, {
          trackId: audioConsumer.track.id,
          trackKind: audioConsumer.track.kind,
          trackEnabled: audioConsumer.track.enabled,
          trackReadyState: audioConsumer.track.readyState,
          trackMuted: audioConsumer.track.muted
        });
        
        const audioStream = new MediaStream([audioConsumer.track]);
        audioRef.current.srcObject = audioStream;
        
        // Add event listeners to audio track
        audioConsumer.track.addEventListener('ended', () => {
          console.log(`🔊 Audio track ended for peer ${peer.id}`);
        });
        
        audioConsumer.track.addEventListener('mute', () => {
          console.log(`🔊 Audio track muted for peer ${peer.id}`);
        });
        
        audioConsumer.track.addEventListener('unmute', () => {
          console.log(`🔊 Audio track unmuted for peer ${peer.id}`);
        });
        
        console.log(`🔊 Audio element srcObject set for peer ${peer.id}`);
      } else {
        console.log(`🔊 No audio track found for peer ${peer.id}`);
        audioRef.current.srcObject = null;
      }
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
        <audio 
          ref={audioRef} 
          autoPlay 
          playsInline 
          className="peer-audio"
          style={{ display: 'none' }}
        />
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
