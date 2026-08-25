# 🛡️ NexusGuard — AI-Powered Security Testing Platform

A full-stack web application for running security scans against targets, viewing
AI-assisted vulnerability insights, and monitoring alerts in real time.

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand + Recharts |
| Backend  | FastAPI (Python) + **SQLAlchemy 2 async ORM** + Alembic migrations + JWT auth |
| Database | PostgreSQL 16 (asyncpg) |
| Extras   | WebSocket live alerts · Google Gemini AI analysis (optional) · Redis (optional queue) |

---

## ✨ Features

- 🔐 **JWT authentication** — register / login / role-based admin access
- 🔑 **Local password reset** — no email server needed:
  1. Click *Forgot password?* on the login page and enter your email
  2. The backend verifies the email exists in the database
  3. An inline *Set New Password* form appears (same strength rules as signup)
  4. Password is reset and you're returned to the login page
- 🖥️ **Security scans** — run scans, track status/risk score/findings
- 🚨 **Alerts dashboard** with severity levels and AI insights
- 📊 **Admin panel** — manage users, view all scans/logs
- 📈 **Real-time updates** over WebSockets

> ⚠️ The password-reset flow is intentionally email-free for local development.
> Anyone who knows an account's email can reset it. Before deploying publicly,
> re-enable a tokened/email-verified flow (`/api/auth/reset-password` with tokens is still supported).

---

## 🚀 Quick Start

### Option A — Docker Compose (recommended)

```bash
cp server/.env.example server/.env   # then edit SECRET_KEY etc.
docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:8080      |
| API      | http://localhost:8000/docs |
| Postgres | localhost:5432 (`nexusguard`/`nexusguard`) |
| Redis    | localhost:6379             |

Stop everything with `Ctrl+C`, or `docker compose down -v` to also wipe the database volume.

### Option B — Local development

**Backend** (Python 3.12+):

```bash
cd server
python -m venv venv
venv\Scripts\activate            # Windows  (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # then edit values
uvicorn main:app --reload        # → http://localhost:8000/docs
```

**Frontend** (Node 20+ or Bun):

```bash
cd client
npm install                      # or: bun install
npm run dev                      # → http://localhost:5173
```

---

## ⚙️ Environment Variables (`server/.env`)

| Variable         | Required | Description                                              |
|------------------|----------|----------------------------------------------------------|
| `SECRET_KEY`     | ✅       | JWT signing secret — use a long random string           |
| `DATABASE_URL`   | ✅       | `postgresql+asyncpg://user:pass@host:5432/dbname`       |
| `GOOGLE_API_KEY` | –        | Google Gemini key; falls back to the local analyzer      |
| `REDIS_URL`      | –        | Defaults to `redis://localhost:6379/0`                  |
| `FRONTEND_URL`   | –        | Origin used to build reset links (default `http://localhost:5173`) |
| `CORS_ORIGINS`   | –        | Comma-separated extra origins; defaults cover all localhost dev ports |

---

## 📡 API Overview

Interactive docs at **`/docs`** (Swagger) and **`/redoc`**.

| Area              | Endpoints                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Auth              | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`   |
| Password reset    | `POST /api/auth/forgot-password` *(returns `exists`)* · `POST /api/auth/reset-password-by-email` · token flow via `/api/auth/reset-password` |
| Scans             | `POST /api/scans` · `GET /api/scans` · `DELETE /api/scans/{id}`            |
| Alerts / Logs     | `/api/alerts` · `/api/dashboard` · `/api/users` · `/api/admin` · `/api/settings` |
| Health            | `GET /health`                                                             |

All data access goes through the SQLAlchemy async ORM models in `server/models.py`
(schema changes → Alembic migration in `server/migrations/`). No raw SQL anywhere.

---

## 📁 Project Structure

```
securityTesterApp/
├── docker-compose.yml          # db + redis + backend + frontend stack
├── client/                     # React + Vite frontend
│   ├── Dockerfile              # build w/ Vite → serve w/ nginx (SPA fallback)
│   ├── nginx.conf              # static serving, /api & /ws proxying
│   └── src/
│       ├── pages/              # Login (2-step reset), Signup, Dashboard, Admin…
│       └── store/              # Zustand stores (auth, security, scan)
└── server/                     # FastAPI backend
    ├── main.py                 # app factory, routers, startup tasks
    ├── api/                    # auth, scans, alerts, dashboard, users, admin, settings
    ├── models.py               # SQLAlchemy ORM models (users, scans, alerts, logs…)
    ├── database.py             # async engine + session factory
    ├── auth.py                 # password hashing, JWT handling
    ├── services/               # scanner, AI analyzers, rate limiter
    └── migrations/             # Alembic migrations
```

---

## 🔧 Useful Commands

```bash
docker compose up --build          # rebuild & start the whole stack
docker compose logs -f backend     # tail backend logs
docker compose down -v             # stop and remove volumes

# Backend only
uvicorn main:app --reload

# Frontend production build
cd client && npx vite build        # outputs to client/dist
```

## 📝 License

MIT — free to use and modify.
