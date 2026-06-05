FROM node:20-slim AS builder

WORKDIR /app/apps/frontend

COPY apps/frontend/package.json apps/frontend/.npmrc* ./
RUN npm install

COPY apps/frontend/ .

# Variable d'environnement Vite pour pointer vers l'Ingress
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -- --mode production

# Image de production avec nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]