FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/persistence

COPY apps/persistence/package.json ./
COPY apps/persistence/prisma/ ./prisma/
RUN npm install && npm run prisma:generate

COPY apps/persistence/ .

ENV NODE_ENV=production

CMD ["npm", "run", "dev"]