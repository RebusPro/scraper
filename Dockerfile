# Dockerfile for VPS Worker with TypeScript

# 1. Base Image: Node.js 20
FROM node:20

# 2. Set working directory
WORKDIR /usr/src/app

# 3. Copy package files and tsconfig
# Copy these first to leverage Docker cache for dependencies
COPY package*.json ./
COPY tsconfig.worker.json ./

# 4. Install project dependencies
# Use npm ci for reproducible installs based on package-lock.json
RUN npm ci

# 5. Install Playwright browsers AND their OS dependencies
# The --with-deps flag handles installing necessary system libraries for the browser
RUN npx playwright install --with-deps chromium

# 6. Copy the rest of the application source code
COPY worker.ts ./
COPY src/lib ./src/lib

# 7. Build TypeScript worker code
RUN npm run build:worker

# 8. Prune development dependencies (optional, makes image slightly smaller)
RUN npm prune --production

# 9. Expose the worker port
EXPOSE 3001

# 10. Define the command to run the worker
CMD [ "node", "dist/worker.js" ]