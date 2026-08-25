#  NexusGuard

NexusGuard is an AI-powered security testing platform for running security scans against authorized targets, identifying vulnerabilities, monitoring security alerts, and generating AI-assisted security insights.

Built with a React frontend and FastAPI backend, NexusGuard combines PostgreSQL, Redis, WebSockets, Docker, and optional Google Gemini integration into a single security testing platform.

> ⚠️ **Authorized use only:** Only scan websites, systems, or infrastructure that you own or have explicit permission to test.

##  Features

* JWT-based authentication
* User registration and login
* Role-based admin access
* Password reset
* Security scanning
* Scan status and risk scoring
* Vulnerability findings
* Security alerts with severity levels
* AI-assisted vulnerability analysis with Google Gemini
* Real-time updates using WebSockets
* Security dashboard and metrics
* User management
* Security and audit logs
* Redis caching and background processing support
* API rate limiting
* Swagger and ReDoc API documentation
* Docker and Docker Compose support

##  Tech Stack

### Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Zustand
* Recharts

### Backend

* Python
* FastAPI
* SQLAlchemy 2 Async
* Alembic
* PostgreSQL 16
* asyncpg
* Redis
* JWT
* WebSockets

### Infrastructure & Services

* Docker
* Docker Compose
* Nginx
* Google Gemini API



##  Project Structure

```text
NexusGuard/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   └── ...
│   ├── Dockerfile
│   └── nginx.conf
│
├── server/
│   ├── api/
│   │   ├── auth.py
│   │   ├── scans.py
│   │   ├── alerts.py
│   │   ├── dashboard.py
│   │   ├── users.py
│   │   ├── admin.py
│   │   └── settings.py
│   ├── services/
│   │   ├── scanner.py
│   │   ├── vuln_scanner.py
│   │   ├── ai_analyzer.py
│   │   └── ...
│   ├── migrations/
│   ├── auth.py
│   ├── database.py
│   ├── models.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── docker-compose.yml
├── .gitignore
├── LICENSE
└── README.md
```

##  Getting Started

### Prerequisites

For the recommended setup, install:

* Git
* Docker
* Docker Compose

For local development without Docker, you will also need:

* Python 3.12+
* Node.js 20+
* npm
* PostgreSQL 16+
* Redis

Check your installation:

```bash
git --version
docker --version
docker compose version
```

### 1. Clone the repository

```bash
git clone https://github.com/yemizerfe/NexusGuard.git
cd NexusGuard
docker compose up
```
