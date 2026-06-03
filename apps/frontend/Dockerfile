FROM node:20-slim AS builder

WORKDIR /app/apps/frontend

COPY apps/frontend/package.json apps/frontend/.npmrc* ./
RUN npm install

COPY apps/frontend/ .
RUN npm run build

# Image de production avec nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]