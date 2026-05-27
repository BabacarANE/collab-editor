# Éditeur Collaboratif Temps Réel — État du Projet

> Synthèse de la session de développement — Mai 2026  
> Référence : CDC v2.0 + BACKLOG.md  
> Repository : https://github.com/BabacarANE/collab-editor.git

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Monorepo | pnpm workspaces |
| Frontend | React 18 + Vite + TypeScript + Tiptap |
| API REST | Fastify + Prisma 4 + PostgreSQL 14 |
| Auth | JWT (access 15min + refresh 7j) + bcrypt |
| State | Zustand + persist |
| Infra dev | Docker Compose |
| Runtime | Node.js 20 (via nvm-windows) |

---

## Architecture du monorepo

```
collab-editor/
├── apps/
│   ├── frontend/        React + Vite + Tiptap
│   ├── api/             Fastify REST + Prisma
│   ├── collab/          (à faire — serveur WebSocket Yjs)
│   └── persistence/     (à faire — consumer Kafka)
├── packages/
│   └── shared/          types partagés
├── docker-compose.yml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Infrastructure Docker Compose

| Service | Image | Port | Statut |
|---------|-------|------|--------|
| postgres | postgres:14-alpine | 5432 | ✅ healthy |
| redis | redis:7-alpine | 6379 | ✅ healthy |
| zookeeper | confluentinc/cp-zookeeper:7.6.0 | 2181 | ✅ healthy |
| kafka | confluentinc/cp-kafka:7.6.0 | 9092 | ✅ healthy |
| minio | minio/minio:latest | 9000/9001 | ✅ healthy |
| api | node:20-slim | 3000 | ✅ running |

### Credentials PostgreSQL
- User : `collabuser`
- Password : `collabpass123`
- Database : `collab`
- Auth : `trust` (pg_hba.conf modifié — pas de mot de passe requis en dev)

### Problèmes rencontrés et solutions
- PostgreSQL Windows natif (v17/v18) occupait le port 5432 → stoppé via `Stop-Service -Name postgresql* -Force` (PowerShell admin) au démarrage
- Prisma driver Rust incompatible avec connexion TCP depuis Windows vers Docker → API exécutée dans Docker
- `pg` driver Node incompatible SCRAM-SHA-256 → pg_hba.conf passé en `trust`
- Node.js v24 incompatible avec pg 8.x → downgradé vers Node 20 via nvm-windows
- pnpm binaires non accessibles sur Windows → frontend lancé via npm (Copilot fix)

---

## Schéma Prisma (migré ✅)

Tables créées dans PostgreSQL :
- `User` — id, email, passwordHash, createdAt, updatedAt
- `Workspace` — id, name, createdAt, updatedAt
- `WorkspaceMember` — workspaceId, userId, role (ADMIN/MEMBER)
- `Document` — id, title, workspaceId, ownerId, deletedAt, createdAt, updatedAt
- `Permission` — documentId, userId, role (OWNER/EDITOR/COMMENTER/VIEWER)
- `ShareLink` — id, documentId, token, role, password, expiresAt
- `RefreshToken` — id, userId, token, expiresAt
- `_prisma_migrations` — interne Prisma

---

## API REST — Routes implémentées ✅

### Auth (`/api/auth`)
| Méthode | Route | Description | Statut |
|---------|-------|-------------|--------|
| POST | `/register` | Créer un compte | ✅ |
| POST | `/login` | Connexion | ✅ |
| POST | `/refresh` | Rotation du refresh token | ✅ |
| POST | `/logout` | Révocation du refresh token | ✅ |

### Documents (`/api/documents`)
| Méthode | Route | Description | Statut |
|---------|-------|-------------|--------|
| POST | `/` | Créer un document | ✅ |
| GET | `/:id` | Récupérer un document | ✅ |
| PATCH | `/:id` | Modifier le titre | ✅ |
| DELETE | `/:id` | Soft delete | ✅ |
| GET | `/workspace/:workspaceId` | Lister les documents | ✅ |

---

## Frontend — Ce qui est fait ✅

- Page de connexion / inscription (`LoginPage.tsx`)
- Éditeur Tiptap avec toolbar (`EditorPage.tsx`)
  - Gras, Italique, Souligné
  - H1, H2
  - Liste à puces
  - Bloc de code
- Store auth Zustand avec persistance localStorage
- Client axios avec intercepteur JWT
- Vite config sur port 5173

---

## Fichiers importants

### `apps/api/.env`
```
DATABASE_URL=postgresql://collabuser:collabpass123@127.0.0.1:5432/collab?sslmode=disable&schema=public
JWT_SECRET=change_me_in_production
PORT=3000
```

### `docker-compose.yml` — service api
```yaml
api:
  image: node:20-slim
  command: sh -c "apt-get update -y && apt-get install -y openssl && npm install -g pnpm && pnpm install && pnpm --filter @collab/api exec prisma generate && pnpm --filter @collab/api run dev"
  ports:
    - "3000:3000"
  volumes:
    - .:/app
  environment:
    DATABASE_URL: postgresql://collabuser:collabpass123@postgres:5432/collab
    JWT_SECRET: change_me_in_production
    PORT: 3000
    CI: "true"
  depends_on:
    postgres:
      condition: service_healthy
```

### Commandes de démarrage
```bash
# PowerShell admin — stopper PostgreSQL Windows
Stop-Service -Name postgresql* -Force

# Git Bash
cd ~/Desktop/Projet_Perso/collab-editor
nvm use 20
docker compose up -d

# Frontend (PowerShell dans apps/frontend)
npm run dev
```

---

## Ce qui reste à faire

### Phase 1 — Fondations (quelques tâches restantes)
- [ ] Workspace CRUD (`POST /api/workspaces`, `GET`, membres)
- [ ] Tests unitaires Auth + Documents
- [ ] README.md racine complet
- [ ] Améliorer le frontend : liste des documents, création depuis l'UI

### Phase 2 — Collaboration Temps Réel (non commencée)
- [ ] Serveur WebSocket (`apps/collab`) — Node.js + uWebSockets.js
  - Handshake JWT
  - Rooms par docId
  - Intégration `y-websocket-server` + Yjs
  - Broadcast CRDT
- [ ] Redis Pub/Sub inter-instances
- [ ] Intégration Yjs côté frontend
  - `yjs`, `y-prosemirror`, `y-websocket`
  - `Y.Doc` par document
  - Connexion Tiptap ↔ Yjs
- [ ] Présence & curseurs distants
  - Protocol `awareness` Yjs
  - Affichage curseurs colorés
  - Avatars collaborateurs
- [ ] Mode hors-ligne
  - `y-indexeddb` pour persistance locale
  - Reconnexion avec backoff exponentiel
  - Merge automatique au retour

## Design UI — reporté après Phase 2
- Tailwind CSS à intégrer dans apps/frontend
- Composants : sidebar documents, header, toolbar améliorée
- Thème sombre / clair
- Responsive mobile

### Phase 3 — Fonctionnalités
- [ ] Commentaires & annotations
- [ ] Mentions @utilisateur
- [ ] Historique & versions (snapshots)
- [ ] Export PDF, DOCX, Markdown
- [ ] Import DOCX, Markdown
- [ ] Recherche full-text

### Phase 4 — Scale & Production
- [ ] Kubernetes (manifests, HPA, StatefulSets)
- [ ] CI/CD GitHub Actions
- [ ] Monitoring (Prometheus + Grafana + Loki)
- [ ] Tests de charge (K6)
- [ ] PWA + Service Worker

---

## Prochaine session — Par où commencer

**Recommandation : commencer par le serveur WebSocket (Phase 2.1)**

1. Initialiser `apps/collab` avec uWebSockets.js + Yjs
2. Ajouter le service `collab` dans `docker-compose.yml`
3. Connecter le frontend Tiptap à Yjs
4. Tester la collaboration entre deux onglets

**Contexte à donner en début de session :**
- Coller ce fichier PROJET_ETAT.md
- Mentionner : Node 20, pnpm 9, Docker Desktop Windows, PostgreSQL Windows natif sur port 5432 (à stopper)
- Repository : https://github.com/BabacarANE/collab-editor.git
