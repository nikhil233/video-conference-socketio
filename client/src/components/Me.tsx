import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { cn } from '../lib/utils';

export const Me: React.FC = () => {
  const { localStream, displayName, isProducing, isVideoEnabled, isAudioEnabled } = useSelector((state: RootState) => state.room);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update video stream when video is toggled on
  useEffect(() => {
    if (videoRef.current && localStream && isVideoEnabled) {
      videoRef.current.srcObject = localStream;
    }
  }, [isVideoEnabled, localStream]);

  return (
    <div className="huddle-peer-card group">
      <div className="relative w-full h-full bg-slate-700">
        {isVideoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-600">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-white">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'You'}
                </span>
              </div>
              <p className="text-gray-300 text-sm">Camera off</p>
            </div>
          </div>
        )}
        
        {/* Status indicators */}
        <div className="absolute top-3 left-3 flex gap-2">
          {!isVideoEnabled && (
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
              Camera Off
            </div>
          )}
          {!isAudioEnabled && (
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
              Mic Off
            </div>
          )}
          {!isProducing && (
            <div className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-medium">
              Connecting...
            </div>
          )}
        </div>
        
        {/* Name overlay */}
        <div className="huddle-peer-name">
          {displayName} (You)
        </div>
      </div>
    </div>
  );
};
