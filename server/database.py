# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()


from sqlalchemy.engine import make_url

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./nexusguard.db")

if DATABASE_URL.startswith(("postgresql://", "postgres://")):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    url = make_url(DATABASE_URL)
    query = dict(url.query)
    query.pop("sslmode", None)
    query.pop("channel_binding", None)
    DATABASE_URL = url.set(
        drivername="postgresql+asyncpg",
        query=query
    ).render_as_string(hide_password=False)


engine = create_async_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False} if 'sqlite' in DATABASE_URL else {})

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
