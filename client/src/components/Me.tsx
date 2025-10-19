import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

export const Me: React.FC = () => {
  const { localStream, displayName, isProducing } = useSelector((state: RootState) => state.room);
  const videoRef = useRef<HTMLVideoElement>(null);


  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const handleToggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const handleToggleScreenShare = () => {
    // This would be implemented in the RoomClient
    console.log('Toggle screen share');
  };

  return (
    <div className="me-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="local-video"
        />
        <div className="video-overlay">
          <span className="peer-name">{displayName} (You)</span>
          {!isProducing && <span className="status-indicator">Connecting...</span>}
        </div>
      </div>
      
      <div className="controls">
        <button
          onClick={handleToggleVideo}
          className="control-button video-button"
          title="Toggle Video"
        >
          📹
        </button>
        <button
          onClick={handleToggleAudio}
          className="control-button audio-button"
          title="Toggle Audio"
        >
          🎤
        </button>
        <button
          onClick={handleToggleScreenShare}
          className="control-button screen-button"
          title="Share Screen"
        >
          🖥️
        </button>
      </div>
    </div>
  );
};
