# Build stage
FROM node:18-slim as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm ci for reproducible builds
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Serve stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 