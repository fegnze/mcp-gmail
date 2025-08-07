FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001 -G nodejs

# Create auth directory and set permissions
RUN mkdir -p /app/auth && \
    chown -R mcpuser:nodejs /app

USER mcpuser

EXPOSE 8080

CMD ["bun", "run", "start"]