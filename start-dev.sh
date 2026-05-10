#!/bin/bash

# VoiceOrchid Development Startup Script
# This script sets up and starts the development environment

set -e

echo "🚀 VoiceOrchid Development Startup"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "Creating from template..."
    cp .env.example .env.local
    echo -e "${YELLOW}Please edit .env.local with your configuration${NC}"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

# Start services
echo "📦 Starting services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check API health
echo "🔍 Checking API health..."
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is ready${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Check database migrations
echo "📊 Running database migrations..."
docker-compose exec -T api alembic upgrade head

echo ""
echo -e "${GREEN}✅ VoiceOrchid is ready!${NC}"
echo ""
echo "Services:"
echo "  - API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/api/docs"
echo "  - UI: http://localhost:5173"
echo "  - Database: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f api"
echo "  Stop: docker-compose down"
echo "  Restart API: docker-compose restart api"
