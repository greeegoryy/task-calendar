
# ==========================================
# Stage 1 - Build React application
# ==========================================

FROM node:22-bookworm-slim AS build

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install dependencies from package-lock.json
RUN npm ci

# Copy application source code
COPY . .

# Build React + TypeScript application
RUN npm run build


# ==========================================
# Stage 2 - Serve application with Nginx
# ==========================================

FROM nginx:alpine

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled React application
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
