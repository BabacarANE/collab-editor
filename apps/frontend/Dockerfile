FROM node:20-slim AS builder

WORKDIR /app/apps/frontend

COPY apps/frontend/package.json apps/frontend/.npmrc* ./
RUN npm install

COPY apps/frontend/ .

# Vite build — ignore les erreurs TypeScript (tsc séparé dans le job lint)
RUN npm run build -- --mode production

# Image de production avec nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]