# Docker Development Deployment Guide

This guide explains how to use the `docker-deploy.sh` script to deploy and manage your Voice Testing App in development.

## Quick Start

### 1. Make the script executable
```bash
chmod +x docker-deploy.sh
```

### 2. Deploy the application
```bash
./docker-deploy.sh deploy
```

### 3. Access your application
Open your browser and go to: **https://voice-test.renovavision.tech**

## Available Commands

### Full Deployment
```bash
./docker-deploy.sh deploy          # Full deployment with backup, build, and health checks
```

### Individual Operations
```bash
./docker-deploy.sh build           # Build Docker image only
./docker-deploy.sh deploy-app      # Deploy without rebuilding
./docker-deploy.sh status          # Show deployment status
./docker-deploy.sh logs            # Show application logs
./docker-deploy.sh restart         # Restart the application
./docker-deploy.sh quick-restart   # Quick restart without rebuild
./docker-deploy.sh stop            # Stop the application
./docker-deploy.sh cleanup         # Clean up old Docker images
./docker-deploy.sh help            # Show help message
```

## Deployment Process

The deployment script performs the following steps:

1. **Prerequisites Check** - Verifies Docker and Docker Compose are installed
2. **Network Setup** - Creates Traefik network if it doesn't exist
3. **Container Management** - Stops existing container if running
4. **Image Building** - Builds new Docker image with dependency caching
5. **Application Deployment** - Starts the application using docker-compose
6. **Health Check** - Verifies the application is responding
7. **SSL Verification** - Checks SSL certificate status
8. **Status Report** - Shows deployment status and resource usage
9. **Cleanup** - Removes old Docker images and dangling images

## Prerequisites

- Docker installed and running (version 20.10+ recommended)
- Docker Compose available (either `docker-compose` or `docker compose`)
- Traefik reverse proxy running (for SSL)
- Domain pointing to your server
- Google Cloud credentials file present

## Configuration

### Environment Variables
The script uses your existing `docker-compose.yml` file. Make sure it's configured with:
- Correct Traefik labels
- Proper volume mounts
- Environment variables

### Image Caching
The script optimizes for development by:
- Using Docker layer caching for faster rebuilds
- Keeping Python dependencies cached between builds
- Cleaning up old images to save disk space

## Monitoring

### Check Status
```bash
./docker-deploy.sh status
```

### View Logs
```bash
./docker-deploy.sh logs
```

### Health Check
The script automatically performs health checks during deployment. You can manually check:
```bash
curl -f http://localhost:8000/
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   ./docker-deploy.sh logs
   
   # Check status
   ./docker-deploy.sh status
   ```

2. **Build fails**
   - Verify all files are present
   - Check Docker daemon is running
   - Ensure sufficient disk space

3. **Health check fails**
   - Check if port 8000 is available
   - Verify application is starting correctly
   - Check container logs for errors

4. **SSL issues**
   - Verify Traefik is running
   - Check domain DNS settings
   - Ensure Let's Encrypt resolver is configured

### Quick Restart

For development iterations, use quick restart:
```bash
# Quick restart without rebuilding
./docker-deploy.sh quick-restart

# Check status
./docker-deploy.sh status
```

## Production Considerations

### Development Optimization
- Fast builds with dependency caching
- Quick restart capability for iterations
- Automatic cleanup of old images

### Monitoring
- Health checks during deployment
- Resource usage monitoring
- Log aggregation and viewing

## File Structure

```
voices_test/
├── docker-deploy.sh        # This deployment script
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Docker image definition
├── .dockerignore          # Docker build exclusions
├── deploy.log             # Deployment logs (auto-created)
└── ...                    # Application files
```

## Examples

### First Time Deployment
```bash
# Full deployment
./docker-deploy.sh deploy
```

### Update Existing Deployment
```bash
# Deploy with new code
./docker-deploy.sh deploy
```

### Quick Restart
```bash
# Restart without rebuilding
./docker-deploy.sh restart
```

### Check Application Health
```bash
# View status and logs
./docker-deploy.sh status
./docker-deploy.sh logs
```

### Emergency Stop
```bash
# Stop the application
./docker-deploy.sh stop
```

## Support

If you encounter issues:

1. Check the deployment logs: `tail -f deploy.log`
2. Verify Docker status: `docker ps`
3. Check container logs: `./docker-deploy.sh logs`
4. Verify network connectivity: `docker network ls`

---

**Remember**: Always test deployments in a staging environment before production!
