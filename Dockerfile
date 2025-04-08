# Dockerfile for Cloud Run Worker with TypeScript

# 1. Base Image: Node.js 20 LTS
FROM node:20-slim

# 2. Set working directory
WORKDIR /usr/src/app

# 3. Install OS dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.worker.json ./

# 5. Install dependencies
RUN npm ci

# 7. Install npm dependencies
RUN npm ci

# 7.1 Install Playwright browsers and dependencies
RUN npx playwright install --with-deps chromium # Or install all: RUN npx playwright install --with-deps

# 8. Copy source files needed for the worker
COPY worker.ts ./
COPY src/lib ./src/lib

# 9. Build TypeScript
RUN npm run build:worker

# 10. Prune dev dependencies (optional, makes image smaller)
RUN npm prune --production

# 11. Expose port
EXPOSE 3001

# 12. Start the worker
CMD [ "node", "dist/worker.js" ]