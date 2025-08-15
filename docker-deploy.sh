#!/bin/bash

# Voice Testing App Docker Deployment Script
# This script handles building, deploying, and managing the Docker container

set -e  # Exit on any error

# Configuration
APP_NAME="voice-test-app"
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
LOG_FILE="./deploy.log"

# Docker Compose command detection
DOCKER_COMPOSE_CMD=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check for docker-compose (legacy) or docker compose (newer)
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        log "Using legacy docker-compose command"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        log "Using newer docker compose command"
    else
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Traefik network exists
    if ! docker network ls | grep -q "traefik"; then
        log_warning "Traefik network not found. Creating it..."
        docker network create traefik
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating backup of current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_NAME="${APP_NAME}_backup_$(date +%Y%m%d_%H%M%S)"
    
    if docker ps -q -f name="$APP_NAME" | grep -q .; then
        log "Stopping current container for backup..."
        $DOCKER_COMPOSE_CMD down
        
        # Backup current image if it exists
        if docker images | grep -q "$APP_NAME"; then
            docker save "$APP_NAME" > "$BACKUP_DIR/${BACKUP_NAME}.tar"
            log_success "Backup created: $BACKUP_DIR/${BACKUP_NAME}.tar"
        fi
    else
        log "No running container found, skipping backup"
    fi
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    # Build with no cache for clean build
    docker build --no-cache -t "$APP_NAME:latest" .
    
    if [ $? -eq 0 ]; then
        log_success "Docker image built successfully"
    else
        log_error "Failed to build Docker image"
        exit 1
    fi
}

# Deploy application
deploy_app() {
    log "Deploying application..."
    
    # Start the application
    $DOCKER_COMPOSE_CMD up -d
    
    if [ $? -eq 0 ]; then
        log_success "Application deployed successfully"
    else
        log_error "Failed to deploy application"
        exit 1
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:8000/" > /dev/null 2>&1; then
            log_success "Health check passed after $attempt attempts"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Check SSL certificate
check_ssl() {
    log "Checking SSL certificate status..."
    
    # Wait a bit for Let's Encrypt to process
    sleep 30
    
    if command -v openssl &> /dev/null; then
        if openssl s_client -connect voice-test.renovavision.tech:443 -servername voice-test.renovavision.tech < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
            log_success "SSL certificate is valid"
        else
            log_warning "SSL certificate validation failed or still processing"
        fi
    else
        log_warning "OpenSSL not available, skipping SSL check"
    fi
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo "=================="
    
    # Container status
    $DOCKER_COMPOSE_CMD ps
    
    echo ""
    
    # Container logs (last 10 lines)
    log "Recent container logs:"
    $DOCKER_COMPOSE_CMD logs --tail=10
    
    echo ""
    
    # Network status
    log "Network status:"
    docker network ls | grep traefik
    
    echo ""
    
    # Resource usage
    log "Resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current deployment
    docker-compose down
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        log "Restoring from backup: $LATEST_BACKUP"
        docker load < "$LATEST_BACKUP"
        
        # Start with previous image
        $DOCKER_COMPOSE_CMD up -d
        
        log_success "Rollback completed"
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# Cleanup old backups
cleanup_backups() {
    log "Cleaning up old backups (keeping last 5)..."
    
    if [ -d "$BACKUP_DIR" ]; then
        cd "$BACKUP_DIR"
        ls -t *.tar 2>/dev/null | tail -n +6 | xargs -r rm -f
        cd - > /dev/null
        log_success "Backup cleanup completed"
    fi
}

# Main deployment function
main_deploy() {
    log "🚀 Starting Docker deployment..."
    
    check_prerequisites
    create_backup
    build_image
    deploy_app
    
    # Wait for deployment to stabilize
    log "Waiting for deployment to stabilize..."
    sleep 20
    
    if health_check; then
        check_ssl
        show_status
        cleanup_backups
        log_success "🎉 Docker deployment completed successfully!"
        log "🌐 Your app is available at: https://voice-test.renovavision.tech"
    else
        log_error "Health check failed, initiating rollback..."
        rollback
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     - Full deployment (default)"
    echo "  build      - Build Docker image only"
    echo "  deploy-app - Deploy without rebuilding"
    echo "  status     - Show deployment status"
    echo "  logs       - Show application logs"
    echo "  restart    - Restart the application"
    echo "  stop       - Stop the application"
    echo "  rollback   - Rollback to previous version"
    echo "  cleanup    - Clean up old backups"
    echo "  help       - Show this help message"
    echo ""
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main_deploy
        ;;
    "build")
        check_prerequisites
        build_image
        ;;
    "deploy-app")
        check_prerequisites
        deploy_app
        health_check
        show_status
        ;;
    "status")
        show_status
        ;;
    "logs")
        $DOCKER_COMPOSE_CMD logs -f
        ;;
    "restart")
        log "Restarting application..."
        $DOCKER_COMPOSE_CMD restart
        log_success "Application restarted"
        ;;
    "stop")
        log "Stopping application..."
        $DOCKER_COMPOSE_CMD down
        log_success "Application stopped"
        ;;
    "rollback")
        rollback
        ;;
    "cleanup")
        cleanup_backups
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        log_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
