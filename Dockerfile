# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1000 nebula && \
    adduser -u 1000 -G nebula -s /bin/sh -D nebula

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/

# Create necessary directories
RUN mkdir -p /workspace /home/nebula/.nebula && \
    chown -R nebula:nebula /app /workspace /home/nebula

# Switch to non-root user
USER nebula

# Set environment
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:$PATH"

# Default entrypoint
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
