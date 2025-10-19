import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { setVideoEnabled, setAudioEnabled, setScreenSharing } from '../redux/slices/roomSlice';
import { Mic, MicOff, Video, VideoOff, Monitor, Phone, PhoneOff } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface ControlPanelProps {
  onLeave: () => void;
  onToggleVideo: () => Promise<void>;
  onToggleAudio: () => Promise<void>;
  onToggleScreenShare: () => Promise<void>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onLeave,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
}) => {
  const dispatch = useDispatch();
  const { isVideoEnabled, isAudioEnabled, isScreenSharing } = useSelector((state: RootState) => state.room);

  const handleVideoToggle = async () => {
    try {
      await onToggleVideo();
      dispatch(setVideoEnabled(!isVideoEnabled));
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const handleAudioToggle = async () => {
    try {
      await onToggleAudio();
      dispatch(setAudioEnabled(!isAudioEnabled));
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const handleScreenShareToggle = async () => {
    try {
      await onToggleScreenShare();
      dispatch(setScreenSharing(!isScreenSharing));
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  };

  return (
    <div className="huddle-controls">
      {/* Audio Control */}
      <Button
        onClick={handleAudioToggle}
        className={cn(
          "huddle-control-button mic",
          !isAudioEnabled && "muted"
        )}
        size="icon"
        variant="ghost"
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </Button>

      {/* Video Control */}
      <Button
        onClick={handleVideoToggle}
        className={cn(
          "huddle-control-button camera",
          !isVideoEnabled && "off"
        )}
        size="icon"
        variant="ghost"
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </Button>

      {/* Screen Share Control */}
      <Button
        onClick={handleScreenShareToggle}
        className={cn(
          "huddle-control-button",
          isScreenSharing && "active"
        )}
        size="icon"
        variant="ghost"
        title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      >
        <Monitor className="w-5 h-5" />
      </Button>

      {/* Leave Call */}
      <Button
        onClick={onLeave}
        className="huddle-control-button leave"
        size="icon"
        variant="ghost"
        title="Leave call"
      >
        <PhoneOff className="w-5 h-5" />
      </Button>
    </div>
  );
};
