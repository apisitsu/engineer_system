# Stage 1: Build React App
FROM node:18-alpine AS builder

WORKDIR /app

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
