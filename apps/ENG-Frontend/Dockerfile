# Stage 1: Build React App
FROM node:18-alpine AS builder

ARG HTTP_PROXY
ARG HTTPS_PROXY

RUN npm config set proxy $HTTP_PROXY && npm config set https-proxy $HTTPS_PROXY && npm config set strict-ssl false

WORKDIR /app

# Install native dependencies for node-gyp and canvas
RUN apk add --no-cache python3 py3-setuptools make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Install dependencies first (better layer caching)
COPY apps/ENG-Frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend source code
COPY apps/ENG-Frontend/ ./

# Build the React application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Replace default Nginx configuration (nginx.conf is at the root context)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
