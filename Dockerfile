# ---- Base Node ----
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ---- Build Dependencies ----
# Needed for compiling canvas and other native addons
FROM base AS dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# ---- Build Stage ----
FROM dependencies AS build
COPY . .
RUN npm run build
# Pre-download assets during build so they are in the image
RUN npx ts-node scripts/download_assets.ts

# ---- Production Release ----
FROM base AS release
# Runtime libraries for canvas
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Copy assets (downloaded in build stage)
COPY --from=build /app/assets ./assets

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
