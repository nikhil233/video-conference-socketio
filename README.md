# Socket.io Video Conferencing Application

A real-time video conferencing application built with Socket.io, mediasoup, and React. This application provides high-quality video and audio communication with features like screen sharing, active speaker detection, and audio level indicators.

## Features

- 🎥 **Real-time Video/Audio**: High-quality WebRTC-based video and audio communication
- 🖥️ **Screen Sharing**: Share your screen with other participants
- 🎤 **Active Speaker Detection**: Automatically highlight the current speaker
- 📊 **Audio Level Indicators**: Visual feedback for speaking participants
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔧 **Configurable Workers**: Environment-based mediasoup worker configuration
- 📈 **Statistics Overlay**: Real-time connection and performance statistics
- 🚀 **Scalable Architecture**: Built for production deployment

## Architecture

### Server Components
- **Server**: Main orchestrator managing mediasoup workers and rooms
- **Room**: Manages peer connections and media routing within a room
- **Peer**: Handles individual peer connections and media streams
- **SocketServer**: Socket.io wrapper for real-time communication

### Client Components
- **RoomClient**: Manages WebRTC connections and media streams
- **Room**: Main room component with video grid layout
- **Peer**: Individual peer video component
- **Me**: Local user component with controls
- **Stats**: Statistics overlay component

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser with WebRTC support

## Installation

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
```env
NODE_ENV=development
MEDIASOUP_NUM_WORKERS=1
HTTP_LISTEN_PORT=3000
DOMAIN=localhost
```

### Client Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode

1. Start the server:
```bash
cd server
npm run dev
```

2. Start the client (in a new terminal):
```bash
cd client
npm run dev
```

3. Open your browser and navigate to `http://localhost:3001`

### Production Mode

1. Build the server:
```bash
cd server
npm run build
```

2. Build the client:
```bash
cd client
npm run build
```

3. Start the server:
```bash
cd server
npm start
```

4. Serve the client files using a web server (nginx, Apache, etc.)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `MEDIASOUP_NUM_WORKERS` | Number of mediasoup workers | `1` |
| `HTTP_LISTEN_PORT` | HTTP server port | `3000` |
| `HTTP_LISTEN_IP` | HTTP server IP | `0.0.0.0` |
| `DOMAIN` | Server domain | `localhost` |
| `WEBRTC_LISTEN_IP` | WebRTC server IP | `0.0.0.0` |
| `WEBRTC_INITIAL_AVAILABLE_PORT` | Starting WebRTC port | `40000` |

### mediasoup Configuration

The application uses configurable mediasoup workers that can be scaled based on your needs:

- **Single Worker**: Suitable for development and small deployments
- **Multiple Workers**: Recommended for production with high concurrent users

## API Reference

### Socket.io Events

#### Client to Server Requests

- `getRouterRtpCapabilities`: Get router RTP capabilities
- `join`: Join a room with display name and device info
- `createWebRtcTransport`: Create WebRTC transport for media
- `connectWebRtcTransport`: Connect WebRTC transport
- `produce`: Start producing media (audio/video)
- `consume`: Start consuming media from other peers
- `resumeConsumer`: Resume a paused consumer
- `pauseConsumer`: Pause a consumer
- `closeProducer`: Close a producer
- `closeConsumer`: Close a consumer
- `closeTransport`: Close a transport

#### Server to Client Notifications

- `newPeer`: New peer joined the room
- `peerClosed`: Peer left the room
- `activeSpeaker`: Active speaker changed
- `speakingPeers`: Speaking peers with volume levels
- `newConsumer`: New media consumer available
- `consumerClosed`: Consumer was closed
- `producerClosed`: Producer was closed
- `transportClosed`: Transport was closed

## Deployment

### Docker Deployment

1. Create a Dockerfile for the server:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

2. Build and run:
```bash
docker build -t video-conference-server .
docker run -p 3000:3000 video-conference-server
```

### Production Considerations

1. **Reverse Proxy**: Use nginx or Apache for SSL termination
2. **Load Balancing**: Distribute load across multiple server instances
3. **Monitoring**: Implement health checks and metrics collection
4. **Firewall**: Open WebRTC ports (40000-49999) for media traffic
5. **SSL/TLS**: Enable HTTPS for secure connections

### Health Checks

The server provides health check endpoints:

- `GET /health`: Basic health status
- `GET /metrics`: Detailed metrics and statistics

## Troubleshooting

### Common Issues

1. **WebRTC Connection Failed**
   - Check firewall settings for WebRTC ports
   - Verify STUN/TURN server configuration
   - Ensure HTTPS in production

2. **Audio/Video Not Working**
   - Check browser permissions for camera/microphone
   - Verify mediasoup worker configuration
   - Check network connectivity

3. **High CPU Usage**
   - Reduce number of concurrent peers per room
   - Optimize video resolution and bitrate
   - Scale with additional mediasoup workers

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=mediasoup-demo:*
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review mediasoup documentation

## Acknowledgments

- Built with [mediasoup](https://mediasoup.org/) for WebRTC media handling
- Uses [Socket.io](https://socket.io/) for real-time communication
- Inspired by the mediasoup demo application
