#!/bin/bash

# Fix .env file issues on VPS for Docker deployment

echo "🔍 Debugging .env file on VPS..."

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo "📄 .env file contents:"
    cat .env
    echo ""
    echo "📊 .env file permissions:"
    ls -la .env
else
    echo "❌ .env file NOT found!"
    echo "Creating .env file..."
    
    # Create .env file with template
    cat > .env << 'EOF'
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_APPLICATION_CREDENTIALS=/app/long-flash-452213-u9-8ae0b27b310f.json
EOF
    
    echo "✅ Created .env template file"
    echo "⚠️  IMPORTANT: Edit .env file with your actual API keys!"
fi

echo ""
echo "🔧 Testing Docker Compose .env loading..."

# Test if docker-compose can read the .env file
echo "📋 Environment variables that Docker Compose will load:"
docker-compose config | grep -E 'OPENAI|GOOGLE' || echo "❌ No environment variables found in compose config"

echo ""
echo "🐳 Testing inside running container (if any)..."

# Check if container is running and test env vars
if docker ps | grep -q "voice-test-app"; then
    echo "📦 Container is running. Checking environment variables inside container:"
    docker exec voice-test-app env | grep -E 'OPENAI|GOOGLE' || echo "❌ No API keys found in container"
else
    echo "📦 Container is not running"
fi

echo ""
echo "💡 Solutions if .env is not working:"
echo "1. Make sure .env file is in the same directory as docker-compose.yml"
echo "2. Restart Docker Compose: docker-compose down && docker-compose up -d"
echo "3. Use explicit environment variables in docker-compose.yml"
echo "4. Check file permissions: chmod 644 .env"

echo ""
echo "🚀 To fix immediately, run:"
echo "   nano .env                    # Edit with your API keys"
echo "   ./docker-deploy.sh restart   # Restart with new env vars"
