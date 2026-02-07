# Use the official Bun image
FROM oven/bun:latest

# Create app directory
WORKDIR /app

# Copy package manifest and lockfile first for better caching
COPY package.json bun.lock tsconfig.json ./

# Copy source and other necessary files
COPY src ./src
COPY firebase-service-account.json ./firebase-service-account.json

# Install production dependencies
RUN bun install --production --no-save

# Set production environment
ENV NODE_ENV=production

# Expose health port for Docker healthchecks
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:3006/health || exit 1

# Run the app
CMD ["bun", "run", "start"]
