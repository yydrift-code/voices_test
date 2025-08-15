# Docker Setup for Voice Testing App

This guide explains how to containerize and run the Voice Testing App using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (usually comes with Docker Desktop)
- At least 2GB of available RAM

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Build and run the application:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   Open your browser and go to: http://localhost:8000

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t voice-test-app .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8000:8000 voice-test-app
   ```

3. **Run in detached mode:**
   ```bash
   docker run -d -p 8000:8000 --name voice-test-container voice-test-app
   ```

## Build Script

Use the provided build script for convenience:

```bash
./docker-build.sh
```

## Container Features

- **Multi-stage build** for optimized image size
- **FFmpeg support** for audio processing
- **Health checks** for monitoring container status
- **Volume mounting** for persistent audio storage
- **Environment variable support** for configuration

## Configuration

### Environment Variables

The following environment variables can be set:

- `PYTHONUNBUFFERED=1` - Ensures Python output is not buffered
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google Cloud credentials

### Port Configuration

- **Container Port:** 8000 (internal)
- **Host Port:** 8000 (external, configurable in docker-compose.yml)

### Volume Mounts

- `./static/audio:/app/static/audio` - Audio file storage
- `./long-flash-452213-u9-8ae0b27b310f.json:/app/long-flash-452213-u9-8ae0b27b310f.json:ro` - Google credentials (read-only)

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Check what's using port 8000
   lsof -i :8000
   
   # Change port in docker-compose.yml
   ports:
     - "8001:8000"  # Use port 8001 instead
   ```

2. **Permission denied:**
   ```bash
   # Make sure the build script is executable
   chmod +x docker-build.sh
   ```

3. **Container won't start:**
   ```bash
   # Check container logs
   docker logs voice-test-app
   
   # Check container status
   docker ps -a
   ```

### Health Check

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker inspect voice-test-app | grep -A 10 Health

# Manual health check
curl -f http://localhost:8000/
```

## Development

### Rebuilding the Image

After making changes to the code:

```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Viewing Logs

```bash
# Follow logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs voice-test-app
```

## Production Considerations

- **Security:** The container runs as root by default. Consider using a non-root user for production.
- **Resource Limits:** Add resource constraints in docker-compose.yml:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.0'
  ```
- **Networking:** Use a reverse proxy (nginx) for production deployments.
- **Monitoring:** Integrate with monitoring solutions like Prometheus/Grafana.

## File Structure

```
voices_test/
├── Dockerfile              # Container definition
├── docker-compose.yml      # Multi-container setup
├── .dockerignore          # Files to exclude from build
├── docker-build.sh        # Build automation script
├── DOCKER_README.md       # This file
├── requirements.txt        # Python dependencies
├── main.py                # Main application
└── ...                    # Other application files
```

## Support

If you encounter issues:

1. Check the container logs: `docker logs voice-test-app`
2. Verify the container is running: `docker ps`
3. Check the health status: `docker inspect voice-test-app`
4. Ensure all required files are present in the build context
