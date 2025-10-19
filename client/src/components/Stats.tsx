import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { formatBitrate, formatBytes } from '../utils';

export const Stats: React.FC = () => {
  const { stats, peers, isConnected } = useSelector((state: RootState) => state.room);
  const [connectionStats, setConnectionStats] = useState<any>(null);

  useEffect(() => {
    const updateStats = () => {
      // This would be implemented to get real WebRTC stats
      // For now, we'll show basic room stats
      setConnectionStats({
        totalPeers: stats.totalPeers,
        totalProducers: stats.totalProducers,
        totalConsumers: stats.totalConsumers,
        connectionState: isConnected ? 'connected' : 'disconnected',
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, [stats, isConnected]);

  return (
    <div className="stats-overlay">
      <div className="stats-header">
        <h3>Room Statistics</h3>
      </div>
      
      <div className="stats-content">
        <div className="stats-section">
          <h4>Connection</h4>
          <div className="stat-item">
            <span className="stat-label">Status:</span>
            <span className={`stat-value ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>


        <div className="stats-section">
          <h4>Room Info</h4>
          <div className="stat-item">
            <span className="stat-label">Total Peers:</span>
            <span className="stat-value">{stats.totalPeers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Producers:</span>
            <span className="stat-value">{stats.totalProducers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Consumers:</span>
            <span className="stat-value">{stats.totalConsumers}</span>
          </div>
        </div>

        <div className="stats-section">
          <h4>Peers</h4>
          {Object.values(peers).map((peer) => (
            <div key={peer.id} className="peer-stat">
              <span className="peer-name">{peer.displayName}</span>
              <span className="peer-status">{peer.joined ? 'Joined' : 'Joining'}</span>
            </div>
          ))}
        </div>

        {connectionStats && (
          <div className="stats-section">
            <h4>Connection Stats</h4>
            <div className="stat-item">
              <span className="stat-label">State:</span>
              <span className="stat-value">{connectionStats.connectionState}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
