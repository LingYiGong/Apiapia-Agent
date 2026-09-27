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
        # Safely ensure new metric columns exist on messages table and users table
        await conn.execute(text("""
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens integer DEFAULT 0;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens integer DEFAULT 0;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT 0;
                END IF;

                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser boolean DEFAULT false;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
                END IF;

                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'conversations') THEN
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
                END IF;
            END $$;
        """))

        # Automatically promote the first user to superuser if no superuser exists yet
        await conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
                    IF NOT EXISTS (SELECT 1 FROM users WHERE is_superuser = true) THEN
                        UPDATE users SET is_superuser = true 
                        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
                    END IF;
                END IF;
            END $$;
        """))
