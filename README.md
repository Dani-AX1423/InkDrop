# 💧 InkDrop

> **Drop ink into dark water; watch it evaporate.**  
> Anonymous, ephemeral multi-room real-time communication platform built on Next.js, Node.js + Socket.io, and Upstash Redis. Zero disk writes, pure volatile memory.

---

## 🌊 Overview

InkDrop is designed around a strict **zero-disk principle**. Chat rooms, messages, user presences, and dropped images exist exclusively in memory or fast serverless Redis with automated TTL expiration. When the last participant departs a room or the room's countdown timer reaches zero, all associated keys and metadata dissolve immediately without leaving traces on disk.

### Key Features

- **Ephemeral Pools**: Public or password-protected rooms with configurable time-to-live (5m, 15m, 30m, 1h, or unlimited).
- **Zero-Disk Architecture**: Ephemeral images and chat streams live solely in volatile memory; zero server disk storage or persistent databases.
- **Single-Ring Water Ripple**: Elegant, fluid click-ripple micro-interactions and ambient water ripples honoring `prefers-reduced-motion`.
- **In-Flight Trie Moderation**: Obfuscation and leetspeak scrubber ($O(M)$ normalizer) filtering sensitive terms without blocking legitimate communication.
- **Sliding-Window Rate Limiting**: 5 messages per 2-second burst limit with live client cooldown bar and 60-second background garbage collection.
- **Dedicated Ephemeral Image Drops**: Inline drag-and-drop or clipboard paste of images (client-side compression & size validation) with dedicated rate limits.
- **Failover Circuit Breaker**: Gracefully falls back to localized memory storage if remote Redis is unavailable or disconnected.
- **Resilient Cold-Start Handling**: Automatic server wake-up detection, exponential backoff health probing (`/health`), and seamless mid-session reconnection.

---

## 🛠️ Tech Stack

| Area | Technologies |
| :--- | :--- |
| **Frontend** | [Next.js 14 (App Router)](https://nextjs.org), [React 18](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Lucide React](https://lucide.dev) |
| **Backend** | [Node.js](https://nodejs.org), [Express](https://expressjs.com), [Socket.io](https://socket.io) |
| **State & Cache** | [Upstash Redis](https://upstash.com) (REST API + Lua scripts) with in-memory fallback |
| **Deployment** | Client on [Vercel](https://vercel.com), Server on [Render](https://render.com) |

---

## 🏛️ Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │            Vercel Edge               │
                      │    apps/client (Next.js App Router)   │
                      └──────────────────┬───────────────────┘
                                         │
                         HTTPS & WSS     │ Socket.io & REST
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          Render Web Service          │
                      │        apps/server (Node.js)         │
                      │  - Socket Gateway with Heartbeat     │
                      │  - In-Flight Trie Moderation         │
                      │  - Sliding-Window Rate Limiter       │
                      │  - In-Memory Fallback Map            │
                      └──────────────────┬───────────────────┘
                                         │
                               REST / Lua│ Atomic Pipelines
                                         ▼
                      ┌──────────────────────────────────────┐
                      │         Upstash Serverless           │
                      │          Redis REST Layer            │
                      │  (Room TTL Expiry & State Sync)      │
                      └──────────────────────────────────────┘
```

- **Client on Vercel**: High-performance static and SSR frontend delivery with security headers (CSP, HSTS, frame isolation).
- **Server on Render**: Persistent Node.js process hosting WebSocket connections (`/health` probe endpoint for uptime verification).
- **State in Upstash Redis**: Ephemeral state synchronization across server restarts with automatic Redis key expiration (TTL).
- **Zero-Disk Design**: No uploaded files or chat records are ever saved to local block storage or database tables.

---

## 📸 Screenshots

<!-- Replace placeholders with actual application screenshots when deployed -->
| Lobby & Active Pools | Ephemeral Room View |
| :---: | :---: |
| *[Screenshot Placeholder: Lobby View with Dark Water Ripple]* | *[Screenshot Placeholder: Active Room with Chat & Ephemeral Drop]* |

---

## 💻 Local Setup

### Prerequisites
- Node.js >= 18.0.0 (Node 20 LTS recommended, see `.nvmrc`)
- npm >= 9.0.0

### 1. Clone & Install
```bash
git clone https://github.com/your-username/inkdrop.git
cd inkdrop
npm install
```

### 2. Configure Environment Files
Copy the provided sample files into each app:
```bash
cp apps/client/.env.example apps/client/.env.local
cp apps/server/.env.example apps/server/.env
```

### 3. Run Both Applications
Run the client and server concurrently from the root workspace:
```bash
npm run dev
```

The apps will be available at:
- Client: `http://localhost:3000`
- Server: `http://localhost:4000`

---

## 🔑 Environment Variables

### Client (`apps/client/.env.local`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SERVER_URL` | **Yes** (in dev) | `http://localhost:4000` | HTTP/WSS endpoint of the backend Socket.io server. |

### Server (`apps/server/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `4000` | Port on which the HTTP server listens (Render automatically sets this in production). |
| `CLIENT_ORIGIN` | **Yes** (in prod)| `http://localhost:3000` | Allowed client origin(s) for CORS and WebSocket access (comma-separated list). |
| `UPSTASH_REDIS_REST_URL` | No | *Empty* | Upstash Redis REST API URL. If omitted, uses in-memory map storage. |
| `UPSTASH_REDIS_REST_TOKEN` | No | *Empty* | Upstash Redis REST API access token. |

---

## 🚀 Deployment Guide

### Part A: Server Deployment (Render)

1. Create a **Web Service** on [Render](https://render.com) pointing to this repository (or use the provided `render.yaml` blueprint).
2. Configure settings:
   - **Environment**: Node
   - **Root Directory**: Leave blank (monorepo root) or run commands targeting `apps/server`.
   - **Build Command**: `npm install && npm run build --workspace=apps/server`
   - **Start Command**: `npm run start --workspace=apps/server`
   - **Health Check Path**: `/health`
   - **Plan**: `free` (or `starter` to avoid cold starts)
3. Set Environment Variables on Render:
   - `CLIENT_ORIGIN`: Your anticipated Vercel URL (e.g. `https://your-inkdrop-app.vercel.app,https://your-inkdrop-app-*.vercel.app`)
   - `UPSTASH_REDIS_REST_URL`: Upstash REST URL from your Upstash console.
   - `UPSTASH_REDIS_REST_TOKEN`: Upstash REST token.
4. Deploy the service and note your Render URL (e.g. `https://inkdrop-backend.onrender.com`).

### Part B: Client Deployment (Vercel)

> [!IMPORTANT]
> Vercel hosts **only** the Next.js client (`apps/client`). Persistent WebSocket connections require a long-running Node service and cannot be hosted on Vercel Serverless Functions.

1. Import the repository in [Vercel](https://vercel.com).
2. Under **Project Settings**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/client` (Click Edit and select `apps/client`)
3. Add Environment Variables:
   - `NEXT_PUBLIC_SERVER_URL`: `https://inkdrop-backend.onrender.com` (your Render server URL).
4. Deploy the client.
5. **Update Server CORS**: Once deployed, ensure your Render server's `CLIENT_ORIGIN` matches your final Vercel domain.

---

## 📜 Scripts Reference

Run these commands from the repository root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs both client and server concurrently with styled console logs. |
| `npm run build` | Builds both apps (`apps/server` via `tsc`, `apps/client` via `next build`). |
| `npm run typecheck` | Validates TypeScript types across both workspaces without emitting code. |
| `npm run lint` | Runs ESLint and Next.js static checks with 0 warnings. |
| `npm run test` | Executes unit tests and end-to-end WebSocket security verification suite. |
| `npm run start` | Starts the production server bundle (`apps/server/dist/index.js`). |

---

## ⏱️ Limitations & Cold Starts

- **Free-Tier Cold Starts**: On Render's free tier, inactive instances spin down after 15 minutes. Initial connections can take 30–50 seconds while the instance boots. InkDrop features built-in waking indicators and health probes (`/health`) to notify users during boot.
- **In-Memory Volatility**: If remote Redis credentials are not provided, state is kept strictly in the server process's RAM. Restarting the server process will clear all active pools.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
