# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./nexusguard.db")
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-this")
    api_key: str = os.getenv("API_KEY", "test-api-key")
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    max_ports: int = 20
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    rate_limit: str = "10/minute"

settings = Settings()
