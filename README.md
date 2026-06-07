# Collab Editor

Éditeur de texte collaboratif temps réel — architecture production-grade construite from scratch.

> Stack : React + Tiptap + Yjs + Fastify + PostgreSQL + Redis + Kafka + Kubernetes

---

## Table des matières

- [Présentation](#présentation)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Démarrage rapide (Docker Compose)](#démarrage-rapide-docker-compose)
- [Déploiement Kubernetes](#déploiement-kubernetes)
- [Monitoring](#monitoring)
- [Tests de charge](#tests-de-charge)
- [CI/CD](#cicd)
- [Structure du monorepo](#structure-du-monorepo)
- [Variables d'environnement](#variables-denvironnement)
- [Contraintes importantes](#contraintes-importantes)

---

## Présentation

Collab Editor permet à plusieurs utilisateurs d'éditer simultanément le même document avec synchronisation temps réel, historique de versions, commentaires, mentions, export et import de documents.

**Fonctionnalités principales :**
- Édition collaborative temps réel (CRDT Yjs — convergence garantie)
- Curseurs et avatars des collaborateurs en temps réel
- Commentaires ancrés avec fil de discussion
- Historique de versions avec diff visuel
- Export PDF / HTML / Markdown
- Import .md / .docx / .txt
- Recherche full-text (PostgreSQL tsvector)
- Mentions @utilisateur avec notifications
- Gestion des permissions par document (owner / editor / commenter / viewer)
- Mode hors-ligne avec resynchronisation automatique
- PWA installable

---

## Architecture
Clients (Browser / Desktop / Mobile)
│
│  WebSocket (ws://)  +  REST (https://)
▼
[ Nginx Ingress — sticky sessions par docId ]
│
├──► [ API Service ]        Fastify REST + Prisma + PostgreSQL
│
└──► [ Collab Service ]     Yjs + y-websocket + Redis Pub/Sub + Kafka
│
├──► [ Redis ]          Pub/Sub inter-instances
│
└──► [ Kafka ]          Log des opérations CRDT
│
[ Persistence ]    Consumer Kafka → OperationLog (PostgreSQL)

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript + Tiptap v3 + Tailwind CSS v3 |
| Collaboration | Yjs + y-websocket v1.5.4 |
| API REST | Fastify + Prisma 4.16.2 + PostgreSQL 14 |
| Auth | JWT (access 15min + refresh 7j) + bcrypt |
| Messaging | Redis Pub/Sub + Apache Kafka |
| Infra dev | Docker Compose |
| Infra prod | Kubernetes (Minikube) |
| CI/CD | GitHub Actions + GHCR |
| Monitoring | Prometheus + Grafana + Loki + Promtail + Alertmanager |
| Tests de charge | K6 |
| PWA | Workbox (vite-plugin-pwa) |

---

## Démarrage rapide (Docker Compose)

### Prérequis

- Docker Desktop
- Node.js 20
- pnpm 9

### Windows — stopper PostgreSQL natif

```powershell
# PowerShell admin
Stop-Service -Name postgresql* -Force
```

### Démarrer la stack

```bash
docker compose up -d

# Vérifier que tous les services sont healthy
docker compose ps
```

### Accès

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API REST | http://localhost:3000 |
| Collab WebSocket | ws://localhost:4000 |
| MinIO Console | http://localhost:9001 |

### Commandes utiles

```bash
# Logs en temps réel
docker compose logs -f api
docker compose logs -f collab

# Migrations Prisma (si nécessaire)
docker compose exec api sh -c "cd /app && pnpm --filter @collab/api exec prisma migrate deploy"

# ⚠️ Ne jamais faire docker compose down -v — détruit les données PostgreSQL
```

---

## Déploiement Kubernetes

### Prérequis

- Minikube
- kubectl
- Docker Desktop

### Démarrer Minikube

```bash
minikube start --cpus=4 --memory=8192
minikube addons enable ingress
```

### Configurer /etc/hosts (Windows)

Ajouter dans `C:\Windows\System32\drivers\etc\hosts` :
127.0.0.1    collab.local

### Déployer

```bash
# Namespace et RBAC
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Bases de données
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/kafka/

# Applications
kubectl apply -f k8s/api/
kubectl apply -f k8s/collab/
kubectl apply -f k8s/persistence/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Vérifier
kubectl get pods -n collab
```

### Accès à l'application

```bash
# Terminal 1 — garder ouvert
minikube tunnel

# Terminal 2 — garder ouvert
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
```

Application accessible sur `http://collab.local:8080`

### Migrations Prisma sur K8s

```bash
kubectl exec -n collab deployment/api -- \
  //app/apps/api/node_modules/.bin/prisma migrate deploy \
  --schema=//app/apps/api/prisma/schema.prisma
```

### Forcer le re-pull des images après un build CI

```bash
kubectl rollout restart deployment/api -n collab
kubectl rollout restart deployment/collab -n collab
kubectl rollout restart deployment/frontend -n collab
```

---

## Monitoring

### Déployer le stack monitoring

```bash
# Namespace + RBAC
kubectl apply -f k8s/monitoring/namespace.yaml
kubectl apply -f k8s/monitoring/rbac.yaml

# Prometheus
kubectl apply -f k8s/monitoring/prometheus/

# Grafana
kubectl apply -f k8s/monitoring/grafana/

# Alertmanager
kubectl apply -f k8s/monitoring/alertmanager/

# Loki + Promtail
kubectl apply -f k8s/monitoring/loki/
kubectl apply -f k8s/monitoring/promtail/

# Vérifier
kubectl get pods -n monitoring
```

### Accès aux UIs

```bash
# Prometheus
kubectl port-forward -n monitoring service/prometheus 9090:9090
# → http://localhost:9090

# Grafana (admin / admin)
kubectl port-forward -n monitoring service/grafana 3000:3000
# → http://localhost:3000

# Alertmanager
kubectl port-forward -n monitoring service/alertmanager 9093:9093
# → http://localhost:9093
```

### Métriques custom exposées par le serveur collab

| Métrique | Type | Description |
|----------|------|-------------|
| `collab_websocket_connections_active` | Gauge | Connexions WebSocket actives par document |
| `collab_operations_total` | Counter | Opérations Yjs reçues depuis le démarrage |
| `collab_operation_duration_seconds` | Histogram | Durée de traitement des opérations (p95) |

---

## Tests de charge

### Prérequis

Installer K6 : https://dl.k6.io/msi/k6-latest-amd64.msi

### Lancer les tests

```bash
# Test charge API REST (20 VUs)
k6 run k6/test-api.js

# Test charge WebSocket (20 VUs)
k6 run k6/test-websocket.js
```

### Résultats observés sur Minikube

| Test | VUs | Succès | Latence p95 |
|------|-----|--------|-------------|
| API HTTP | 20 | 90% | 300ms (réussies) |
| WebSocket | 20 | 100% | 44ms (connexion) |

---

## CI/CD

Pipeline GitHub Actions déclenché sur push/PR vers `main` :

1. **Lint & Type Check** — `tsc --noEmit` sur API + Frontend
2. **Build & Push Docker** — images publiées sur GHCR
3. **Security Scan** — Trivy (CRITICAL + HIGH)

### Images Docker
ghcr.io/babacarane/collab-editor/api:latest
ghcr.io/babacarane/collab-editor/collab:latest
ghcr.io/babacarane/collab-editor/persistence:latest
ghcr.io/babacarane/collab-editor/frontend:latest

---

## Structure du monorepo
collab-editor/
├── apps/
│   ├── frontend/        React + Vite + Tiptap + Yjs + Tailwind
│   ├── api/             Fastify REST + Prisma
│   ├── collab/          WebSocket Yjs + Redis Pub/Sub + Kafka
│   └── persistence/     Consumer Kafka → OperationLog
├── packages/
│   └── shared/          Types partagés
├── k8s/                 Manifests Kubernetes
│   └── monitoring/      Prometheus + Grafana + Loki + Alertmanager
├── k6/                  Scripts tests de charge
├── docker-compose.yml
└── .github/workflows/   CI/CD GitHub Actions

---

## Variables d'environnement

### API

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://collabuser:collabpass123@postgres:5432/collab` |
| `JWT_SECRET` | Secret JWT | `dev_secret` |
| `PORT` | Port HTTP | `3000` |

### Collab

| Variable | Description | Défaut |
|----------|-------------|--------|
| `JWT_SECRET` | Secret JWT | `dev_secret` |
| `COLLAB_PORT` | Port WebSocket | `4000` |
| `REDIS_URL` | URL Redis | `redis://redis:6379` |
| `KAFKA_BROKER` | Broker Kafka | `kafka:29092` |

### Frontend

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL API REST | `http://localhost:3000` |
| `VITE_COLLAB_URL` | URL WebSocket collab | `ws://localhost:4000` |

---

## Contraintes importantes

> Ces contraintes ont été apprises en cours de développement — ne pas les ignorer.

- **y-websocket doit rester à v1.5.4** — la v3 a supprimé le support serveur
- **Prisma doit rester à v4.16.2** — ne pas upgrader à v7
- **Ne jamais faire `docker compose down -v`** — détruit le volume PostgreSQL
- **`CI=true` bloque `prisma migrate dev`** — utiliser `prisma migrate deploy`
- **Kafka `InconsistentClusterIdException`** — supprimer Zookeeper + Kafka + leurs PVCs ensemble
- **Les tags Docker GHCR doivent être en minuscules** — enforced via CI
- **`kubectl exec` sur Git Bash Windows** — préfixer les chemins avec `//`
- **React StrictMode** doit être retiré de `main.tsx` — double-destruction du WebSocket provider
- **PWA nécessite HTTPS** — le Service Worker ne s'enregistre pas sur `collab.local` sans TLS