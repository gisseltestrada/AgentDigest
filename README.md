# AgentDigest

A personal knowledge system that ingests content (articles, videos, docs, websites), processes it with AI agents, and lets you ask questions over your own library with cited answers.

> **Status: early scaffolding.** The backend and frontend projects are bootstrapped and running, but the AI agent pipeline, data stores, and deployment infrastructure described below are the target architecture and not yet implemented. See [Current Status](#current-status) for what actually exists today.

## Repository Structure

This repo contains two independently deployable projects:

```
AgentDigest/
├── AgentDigestAPI/   # NestJS backend — REST API + background worker
└── AgentDigestUI/    # Angular frontend
```

| Project | Stack | Purpose |
|---|---|---|
| [AgentDigestAPI](AgentDigestAPI/) | NestJS 11 (Node.js, TypeScript) | Auth, source management, query/knowledge services, agent orchestration |
| [AgentDigestUI](AgentDigestUI/) | Angular 22 | Dashboard, source upload, knowledge library, chat-style Q&A |

## Target Architecture

The diagram below is the intended end-state architecture this project is being built toward.

```
Frontend (Angular)
   │  HTTPS (REST / WebSocket)
   ▼
Backend API (Node.js / NestJS)
   ├─ Auth Service (JWT / Refresh Token)
   ├─ User & Profile Service
   ├─ Source Management (upload, links, metadata)
   ├─ Query Service (ask questions)
   ├─ Knowledge Service (artifacts, notes, tags)
   └─ Agent Orchestrator (workflows)
   │  Internal API (gRPC/REST)
   ▼
AI Agents & Processing Layer
   ├─ Ingestion Agent      — fetches content from URLs, processes uploads
   ├─ Parsing & Extraction Agent — extracts text/metadata from PDF, HTML, YouTube, DOCX, etc.
   ├─ Chunking Agent       — splits content into meaningful chunks
   ├─ Embedding Agent      — generates embeddings for semantic search
   └─ Reasoning / QA Agent — answers questions using retrieved context + LLM, with citations
   │
   ├──► External Services: LLM Provider (OpenAI/Anthropic/local), Embedding Model, Transcription Service (Whisper/Azure Speech)
   │
   ▼
Data Stores
   ├─ PostgreSQL — users, sources, content metadata, tags/notes, chat history, permissions
   ├─ Vector Database (pgvector) — embeddings + chunk references
   ├─ File Storage (MinIO / S3-compatible) — original/extracted files, thumbnails
   └─ Cache / Queue (Redis) — caching, job queue, session store
```

**Deployment pipeline (planned):** Dockerized services (frontend, backend, agents, PostgreSQL + pgvector, Redis, MinIO) orchestrated with Kubernetes (k3s/kubeadm), built and deployed via GitHub Actions, self-hosted behind NGINX Ingress with cert-manager for TLS, monitored with Prometheus + Grafana and log aggregation (EFK/Loki).

## Current Status

**AgentDigestAPI**
- NestJS project scaffolded with separate entry points for an API process (`main-api.ts`) and a background worker process (`main-worker.ts`)
- Basic `/health` endpoint
- No database, queue, storage, or agent integrations wired up yet

**AgentDigestUI**
- Angular project scaffolded with routing configured but no routes/pages defined yet
- No API integration yet

**Not yet started:** AI agents (ingestion, parsing, chunking, embedding, reasoning/QA), PostgreSQL/pgvector, MinIO, Redis, Docker/Kubernetes manifests, CI/CD pipeline.

## Getting Started

### Prerequisites
- Node.js `24.18.0` (see [`.nvmrc`](.nvmrc))
- npm

### Backend (AgentDigestAPI)

```bash
cd AgentDigestAPI
npm install
npm run start:dev        # API process, http://localhost:3000
npm run start:worker:dev # background worker process
```

### Frontend (AgentDigestUI)

```bash
cd AgentDigestUI
npm install
npm start                # http://localhost:4200
```

## Roadmap

- [ ] Auth (JWT / refresh tokens) and user/profile service
- [ ] PostgreSQL schema for sources, content metadata, tags/notes, chat history
- [ ] Source ingestion (URL fetch + file upload) and parsing/extraction (PDF, HTML, YouTube, DOCX)
- [ ] Chunking + embedding pipeline with pgvector
- [ ] Reasoning/QA agent with cited answers over retrieved context
- [ ] File storage via MinIO/S3
- [ ] Redis for caching, job queue, and sessions
- [ ] Angular pages: Dashboard, Sources/Upload, Library, Ask Questions (chat), Settings
- [ ] Dockerize all services; Kubernetes manifests
- [ ] CI/CD via GitHub Actions
- [ ] Monitoring/alerting (Prometheus + Grafana, log aggregation)
