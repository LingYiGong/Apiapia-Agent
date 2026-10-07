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
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_results text;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS generated_images text;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_invocations text;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS thinking_duration_ms integer DEFAULT 0;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS finish_reason varchar(20) DEFAULT 'stop';
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_query varchar(255);
                END IF;

                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_settings') THEN
                    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS image_model varchar(120);
                    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS web_search_mode varchar(10) DEFAULT 'auto';
                END IF;

                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser boolean DEFAULT false;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_all_models boolean DEFAULT false;
                    UPDATE users SET can_access_all_models = true WHERE is_superuser = true;
                END IF;

                -- Caller-supplied provider credentials. create_all() only builds
                -- the unique constraint on a fresh database, so an existing
                -- install needs it applied explicitly.
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'model_configs') THEN
                    -- Keep only the newest row per (user, provider, model) so the
                    -- unique index can be built. Safe because the table was never
                    -- writable before the /settings/model-configs endpoints.
                    DELETE FROM model_configs a
                    USING model_configs b
                    WHERE a.user_id = b.user_id
                      AND a.provider = b.provider
                      AND a.model = b.model
                      AND (a.updated_at, a.id) < (b.updated_at, b.id);

                    CREATE UNIQUE INDEX IF NOT EXISTS uq_model_config_user_provider_model
                        ON model_configs (user_id, provider, model);
                END IF;

                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'conversations') THEN
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pin_order integer DEFAULT 0;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone;

                    -- Backfill last_message_at for existing conversations using max message created_at or fallback to created_at
                    UPDATE conversations c
                    SET last_message_at = COALESCE(
                        (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id),
                        c.created_at
                    )
                    WHERE c.last_message_at IS NULL;
                END IF;

                -- Composite indexes for high-frequency queries and stats
                CREATE INDEX IF NOT EXISTS idx_conversations_user_active ON conversations (user_id, is_deleted, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_conversations_user_pin ON conversations (user_id, is_deleted, is_pinned, pin_order);
                CREATE INDEX IF NOT EXISTS idx_conversations_user_last_msg ON conversations (user_id, is_deleted, last_message_at DESC);
                CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at ASC);
                CREATE INDEX IF NOT EXISTS idx_messages_role_created ON messages (role, created_at);
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
