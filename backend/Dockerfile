# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build
RUN ls -la dist/

# Production stage
FROM node:18-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy service account key file if it exists
COPY service-account-key.json* ./

# Verify the files are copied
RUN ls -la

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "start"] 