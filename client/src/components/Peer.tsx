import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { PeerInfo } from '../RoomClient';
import { cn } from '../lib/utils';

interface PeerProps {
  peer: PeerInfo;
}

export const Peer: React.FC<PeerProps> = ({ peer }) => {
  const { activeSpeaker, speakingPeers, consumers, peerProducerAvailability } = useSelector((state: RootState) => state.room);
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
  
  // Check if video producer is available
  const hasVideoProducer = peerProducerAvailability[peer.id]?.hasVideo !== false;
  const hasAudioProducer = peerProducerAvailability[peer.id]?.hasAudio !== false;
  
  // Check if we have a video consumer (active video stream)
  const hasVideoConsumer = Object.values(consumers).some(
    consumer => consumer.peerId === peer.id && consumer.kind === 'video'
  );
  
  // Show video if we have both producer and consumer
  const shouldShowVideo = hasVideoProducer && hasVideoConsumer;

  return (
    <div className={cn(
      "huddle-peer-card group",
      isActiveSpeaker && "active-speaker",
      isSpeaking && "speaking"
    )}>
      <div className="relative w-full h-full bg-gray-700">
        {shouldShowVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-600">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-white">
                  {peer.displayName ? peer.displayName.charAt(0).toUpperCase() : peer.id.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-gray-300 text-sm">Camera off</p>
            </div>
          </div>
        )}
        <audio 
          ref={audioRef} 
          autoPlay 
          playsInline 
          className="hidden"
        />
        
        {/* Status indicator */}
        <div className={cn(
          "huddle-status-indicator",
          peer.joined ? "connected" : "connecting"
        )} />
        
        {/* Audio status indicator */}
        <div className="absolute top-3 left-3 flex gap-2">
          {!hasAudioProducer && (
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
              Mic Off
            </div>
          )}
        </div>
        
        {/* Peer name overlay */}
        <div className="huddle-peer-name">
          {peer.displayName} ({peer.id})
        </div>
        
        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute bottom-3 right-3">
            <div className="speaking-visualizer">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="speaking-bar"
                  style={{
                    height: `${Math.max(speakingVolume * 100 * (0.5 + Math.random() * 0.5), 20)}%`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
