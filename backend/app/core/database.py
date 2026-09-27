from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

Base = declarative_base()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db():
    """FastAPI dependency for obtaining async SQLAlchemy database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize PostgreSQL extensions and database tables."""
    # Explicitly import all models so Base.metadata knows about them
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        # Create all defined SQLAlchemy tables (users, conversations, messages, settings, etc.)
        await conn.run_sync(Base.metadata.create_all)
        # Safely ensure new metric columns exist on messages table
        await conn.execute(text("""
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens integer DEFAULT 0;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens integer DEFAULT 0;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT 0;
                END IF;
            END $$;
        """))
