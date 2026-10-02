FROM node:20-slim

# Installer OpenSSL + Chromium pour Puppeteer
RUN apt-get update -y && apt-get install -y \
    openssl chromium fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
    libdrm2 libexpat1 libgbm1 libglib2.0-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 libxshmfence1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de configuration monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/

# Copier uniquement les package.json pour profiter du cache Docker
COPY apps/api/package.json ./apps/api/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/collab/package.json ./apps/collab/
COPY apps/persistence/package.json ./apps/persistence/

# Chromium système utilisé par Puppeteer : pas de téléchargement à l'install
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Version de pnpm figée (identique à la CI) : sans version, l'image prenait
# la dernière majeure, qui refuse l'installation quand des scripts de build
# (prisma, bcrypt…) ne sont pas explicitement approuvés (ERR_PNPM_IGNORED_BUILDS)
RUN npm install -g pnpm@9.15.9 && pnpm install --frozen-lockfile

# Copier le code source
COPY apps/api/ ./apps/api/

# Générer le client Prisma
RUN pnpm --filter @collab/api exec prisma generate

ENV NODE_ENV=production

EXPOSE 3000
CMD ["pnpm", "--filter", "@collab/api", "run", "dev"]