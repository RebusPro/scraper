# Dockerfile for Cloud Run Worker with TypeScript

# 1. Base Image: Node.js 20 LTS
FROM node:20-slim

# 2. Set working directory
WORKDIR /usr/src/app

# 3. Install OS dependencies for Playwright/Chromium (Combined)
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
    # Clean up in the same layer
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.worker.json ./

# 5. Install dependencies (including @sparticuz/chromium)
RUN npm ci

# 6. Install Playwright browsers and dependencies - REMOVED
# REMOVED: RUN npx playwright install chromium --with-deps
# Rely on @sparticuz/chromium provided via npm ci and OS deps from apt-get

# 7. Copy source files needed for the worker
COPY worker.ts ./
COPY src/lib ./src/lib

# 8. Build TypeScript
RUN npm run build:worker

# 9. Prune dev dependencies (optional, makes image smaller)
RUN npm prune --production

# 10. Expose port
EXPOSE 3001

# 11. Start the worker
CMD [ "node", "dist/worker.js" ]