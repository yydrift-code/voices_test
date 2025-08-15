#!/bin/bash

# Voice Testing App Docker Build Script

echo "🚀 Building Voice Testing App Docker Container..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t voice-test-app .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "🔧 To run the container:"
    echo "   docker run -p 8000:8000 voice-test-app"
    echo ""
    echo "🌐 Or use docker-compose:"
    echo "   docker-compose up -d"
    echo ""
    echo "📱 The app will be available at: http://localhost:8000"
else
    echo "❌ Docker build failed!"
    exit 1
fi
