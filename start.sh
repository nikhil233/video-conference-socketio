#!/bin/bash

# Video Conference Application Startup Script

echo "🚀 Starting Video Conference Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Function to start server
start_server() {
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    
    echo "🔧 Building server..."
    npm run build

    echo "🌐 Starting server on port 3000..."
    npm start &

    SERVER_PID=$!
    cd ..
}

# Function to start client
start_client() {
    echo "📦 Installing client dependencies..."
    cd client
    npm install
    
    echo "🎨 Starting client on port 3001..."
    npm run dev &
    CLIENT_PID=$!
    cd ..
}

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
    fi
    if [ ! -z "$CLIENT_PID" ]; then
        kill $CLIENT_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start both server and client
start_server
sleep 2
start_client

echo "✅ Application started successfully!"
echo "🌐 Server: http://localhost:3000"
echo "🎨 Client: http://localhost:3001"
echo "📊 Health: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop the application"

# Wait for processes
wait
