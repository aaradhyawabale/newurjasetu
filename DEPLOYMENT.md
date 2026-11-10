# UrjaSetu — Deployment & Production Architecture Guide

UrjaSetu is deployed in a high-availability decoupled cloud architecture:
- **Frontend**: Next.js 14 App Router on **Vercel**
- **Backend API & Compute**: Next.js Server on **Render** (Docker/Node runtime)
- **Database**: Cloud PostgreSQL on **Supabase** (IPv4 Connection Pooler)

---

## 1. Live Deployment Endpoints

| Component | Provider | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | [https://newurjasetu.vercel.app](https://newurjasetu.vercel.app) | **Live & Healthy** |
| **Backend API** | Render | [https://urjasetu-backend-gwwc.onrender.com](https://urjasetu-backend-gwwc.onrender.com) | **Live & Healthy** |
| **Database** | Supabase | `aws-0-ap-southeast-2.pooler.supabase.com:5432` | **Live & Seeded** |

---

## 2. Architecture & Request Routing

```
[ Browser / Client ]
         │
         │  (HTTPS requests to https://newurjasetu.vercel.app)
         ▼
[ Vercel Frontend ] ──(beforeFiles rewrite: /api/*)──► [ Render Backend ]
         │                                                      │
         │ (Static assets, RSC, UI bundles)                    │ (Prisma ORM, GIS compute, Auth)
         │                                                      ▼
         └──────────────────────────────────────────────► [ Supabase PostgreSQL ]
```

- **Same-Origin API Rewrites**: The Next.js frontend rewrites all `/api/*` calls server-to-server to the Render backend via `beforeFiles` in `next.config.mjs`.
- **Session & Cookie Security**: `Set-Cookie` tokens (`urjasetu_session`) are forwarded seamlessly without cross-site third-party cookie restrictions.
- **IPv4 Connection Pooling**: Render communicates with Supabase through Supabase's IPv4 Session Pooler on port 5432.

---

## 3. Environment Variables Reference

### Render Backend (`urjasetu-backend-gwwc`)

| Key | Description | Example / Current Setting |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Dynamic port bound by Render | Provided automatically by Render (defaults to 10000) |
| `DATABASE_URL` | Supabase IPv4 Pooler URL | `postgresql://postgres.rlzftahanacfzqsperwr:Urjasetu%40urjasetu@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres` |
| `FRONTEND_URL` | Allowed CORS origin | `https://newurjasetu.vercel.app` |
| `JWT_SECRET` | Auth token signing secret | *(Configured secure secret)* |
| `NUGEN_API_KEY` | External GIS / ML API key | *(Configured key)* |

### Vercel Frontend (`newurjasetu`)

| Key | Description | Example / Current Setting |
| :--- | :--- | :--- |
| `BACKEND_URL` | Render backend endpoint | `https://urjasetu-backend-gwwc.onrender.com` |
| `NEXT_PUBLIC_PRIORITY_MODE` | UI feature flag | `true` |
| `DATABASE_URL` *(optional fallback)* | Supabase Pooler URL | `postgresql://postgres.rlzftahanacfzqsperwr:Urjasetu%40urjasetu@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres` |

---

## 4. Default Seeded Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Urban Infrastructure Planner** | `demo@urjasetu.gov.in` | `UrjaSetuDemo2026!` |

---

## 5. Free-Tier Operational Caveats

- **Render Cold Starts**: On Render's free tier, the web service automatically spins down after 15 minutes of inactivity. When a new request arrives after inactivity, the first response may take 30–50 seconds to wake up the container. Subsequent requests respond in sub-second time.
- **Supabase Inactivity Pause**: Supabase free-tier projects pause after 1 week of zero queries. Active development or occasional queries via the app prevent pausing.

---

## 6. How to Deploy Updates

- **Automatic Deployments**: Any commit pushed to the `main` branch of `aaradhyawabale/newurjasetu` triggers automated builds and deployments on both Vercel and Render.
- **Database Migrations / Schema Changes**:
  Run locally against the Supabase database:
  ```bash
  npx prisma db push
  ```
