# NexusGuard

NexusGuard is an AI-powered security testing platform for running security
scans against authorized targets, identifying vulnerabilities, monitoring
security alerts, and generating AI-assisted security insights.

The application combines a React frontend with a FastAPI backend,
PostgreSQL, Redis, WebSockets, and optional Google Gemini integration.

> ⚠️ NexusGuard is intended for authorized security testing only. Only scan
> systems, websites, or infrastructure that you own or have explicit
> permission to test.



## Features

* JWT-based authentication
* User registration and login
* Password reset
* Role-based access control
* Security scanning
* Scan status and risk scores
* Vulnerability findings
* Security alerts with severity levels
* AI-assisted vulnerability analysis with Google Gemini
* Real-time updates using WebSockets
* Dashboard and security metrics
* Admin panel
* User management
* Security logs
* Redis support for caching and background processing
* API rate limiting
* Swagger and ReDoc API documentation
* Docker and Docker Compose support



##  Tech Stack

 Layer            Technology         
 ---------------- ------------------
- Frontend         . React 19           
- Language         . TypeScript         
- Build Tool       . Vite               
- Styling          . Tailwind CSS       
- UI Components    . shadcn/ui          
- State Management . Zustand            
- Charts           . Recharts           
- Backend          . FastAPI            
- Language         . Python             
- ORM              . SQLAlchemy 2 Async 
- Database         . PostgreSQL 16      
- Database Driver  . asyncpg            
- Migrations       . Alembic            
- Authentication   . JWT                
- Real-Time        . WebSockets         
- Cache / Queue    . Redis              
- AI               . Google Gemini      
- Web Server       . Nginx              
- Containerization . Docker             
- Orchestration    . Docker Compose    



##  Project Structure

```text
securityTesterApp/
│
├── docker-compose.yml
├── .gitignore
├── LICENSE
├── README.md
│
├── client/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── store/
│       ├── services/
│       ├── hooks/
│       ├── App.tsx
│       └── main.tsx
│
└── server/
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    ├── main.py
    ├── auth.py
    ├── database.py
    ├── models.py
    │
    ├── api/
    │   ├── auth/
    │   ├── scans/
    │   ├── alerts/
    │   ├── dashboard/
    │   ├── users/
    │   ├── admin/
    │   └── settings/
    │
    ├── services/
    │   ├── scanner/
    │   ├── analyzers/
    │   └── rate_limiter/
    │
    └── migrations/
```



#  Getting Started

## Prerequisites

### Docker Setup

Install:

* Git
* Docker
* Docker Compose

Verify the installations:

```bash
git --version
docker --version
docker compose version
```


##  Installation

Clone the repository:

```bash
git clone https://github.com/yemizerfe/NexusGuard.git
cd securityTesterApp
docker compose up

