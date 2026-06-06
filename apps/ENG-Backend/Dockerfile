# Stage 1: Build & Serve Backend
FROM node:18-alpine

ARG HTTP_PROXY
ARG HTTPS_PROXY

RUN npm config set proxy $HTTP_PROXY && npm config set https-proxy $HTTPS_PROXY && npm config set strict-ssl false

WORKDIR /app

# Install native dependencies for node-gyp and canvas
RUN apk add --no-cache python3 py3-setuptools make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Expose backend port
EXPOSE 2005

# Start backend (Production ready)
CMD ["node", "server.js"]
