FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/collab

COPY apps/collab/package.json apps/collab/package-lock.json* ./
RUN npm install

COPY apps/collab/ .

ENV NODE_ENV=production

EXPOSE 4000
CMD ["npm", "run", "dev"]