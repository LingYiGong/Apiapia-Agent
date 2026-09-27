from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import encrypt_api_key
from app.core.config import settings
from app.models.user import User
from app.models.setting import ModelConfig
from app.schemas.setting import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/models", tags=["models"])

# Built-in default model choices available to everyone
DEFAULT_AVAILABLE_MODELS = [
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openai", "description": "高效轻量，高性价比"},
    {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "description": "OpenAI 旗舰全能模型"},
    {"id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet", "provider": "anthropic", "description": "强大代码与推理能力"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "provider": "gemini", "description": "极速响应轻量模型"},
    {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet (OpenRouter)", "provider": "openrouter", "description": "通过 OpenRouter 聚合访问"},
    {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3 (OpenRouter)", "provider": "openrouter", "description": "高智商性价比之选"},
    {"id": "meta-llama/llama-3.1-70b-instruct", "name": "Llama 3.1 70B (OpenRouter)", "provider": "openrouter", "description": "开源旗舰顶尖性能"},
    {"id": "llama3:latest", "name": "Ollama Llama 3 (Local)", "provider": "ollama", "description": "本地隐私大模型"}
]


import httpx

# In-memory cache for OpenRouter models list
_openrouter_cache = {"models": [], "expires_at": 0}


@router.get("/available")
async def list_available_models():
    """List preset available model catalog."""
    return DEFAULT_AVAILABLE_MODELS


@router.get("/openrouter")
async def list_openrouter_models(q: str = ""):
    """
    Fetch all supported models directly from OpenRouter's live API.
    Supports real-time search filtering.
    """
    import time
    now = time.time()
    raw_models = []

    # Use 10-minute cache to avoid hammering OpenRouter API
    if _openrouter_cache["models"] and _openrouter_cache["expires_at"] > now:
        raw_models = _openrouter_cache["models"]
    else:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get("https://openrouter.ai/api/v1/models")
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    raw_models = [
                        {
                            "id": item.get("id"),
                            "name": item.get("name") or item.get("id"),
                            "description": item.get("description", "")[:120],
                            "context_length": item.get("context_length"),
                            "provider": "openrouter"
                        }
                        for item in data
                    ]
                    _openrouter_cache["models"] = raw_models
                    _openrouter_cache["expires_at"] = now + 600
        except Exception as e:
            # Fallback to empty or existing cache on network failure
            raw_models = _openrouter_cache["models"]

    if q and q.strip():
        search = q.strip().lower()
        return [
            m for m in raw_models
            if search in m["id"].lower() or search in m["name"].lower()
        ]
    return raw_models


@router.get("/configured")
async def list_configured_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL FEATURE:
    Dynamically detect and return ONLY models whose providers have an active API Key
    (either configured in backend .env or customized by the current user in model_configs).
    If a provider has NO key configured, its models WILL NOT be displayed.
    """
    # 1. Fetch user's custom model configurations from DB
    stmt = select(ModelConfig).where(ModelConfig.user_id == current_user.id, ModelConfig.enabled == True)
    user_configs = (await db.execute(stmt)).scalars().all()

    # Determine which providers have an active API key
    active_providers = set()

    # Check backend environment variables
    if settings.OPENROUTER_API_KEY:
        active_providers.add("openrouter")
    if settings.OPENAI_API_KEY:
        active_providers.add("openai")
    if settings.ANTHROPIC_API_KEY:
        active_providers.add("anthropic")
    if settings.GEMINI_API_KEY:
        active_providers.add("gemini")

    # Check user-configured keys in DB
    for cfg in user_configs:
        if cfg.api_key_encrypted:
            active_providers.add(cfg.provider.lower())

    # Check if Ollama is accessible
    ollama_models = []
    if settings.OLLAMA_BASE_URL:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
                if res.status_code == 200:
                    tags = res.json().get("models", [])
                    for t in tags:
                        m_name = t.get("name")
                        if m_name:
                            ollama_models.append({
                                "id": m_name,
                                "name": f"{m_name} (Ollama Local)",
                                "provider": "ollama",
                                "description": "本地运行的 Ollama 模型"
                            })
                    if ollama_models:
                        active_providers.add("ollama")
        except Exception:
            pass

    configured_models = []

    # 2. Add OpenRouter models if openrouter key is present
    if "openrouter" in active_providers:
        # Predefined high-quality OpenRouter popular models
        popular_openrouter = [
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "openrouter", "description": "顶尖代码与推理能力"},
            {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "provider": "openrouter", "description": "高性价比顶尖智商"},
            {"id": "openai/gpt-4o", "name": "GPT-4o", "provider": "openrouter", "description": "OpenAI 旗舰全能大模型"},
            {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openrouter", "description": "极速高效高性价比"},
            {"id": "meta-llama/llama-3.1-70b-instruct", "name": "Llama 3.1 70B", "provider": "openrouter", "description": "开源旗舰顶尖性能"},
            {"id": "google/gemini-pro-1.5", "name": "Gemini 1.5 Pro", "provider": "openrouter", "description": "超长百万上下文"},
            {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "provider": "openrouter", "description": "通义千问顶尖开源模型"}
        ]
        # Also try to fetch full models from OpenRouter cache
        live_or_models = await list_openrouter_models()
        seen_ids = set()
        for m in popular_openrouter:
            seen_ids.add(m["id"])
            configured_models.append(m)

        for m in live_or_models:
            if m["id"] not in seen_ids:
                seen_ids.add(m["id"])
                configured_models.append(m)

    # 3. Add OpenAI models if openai key is present
    if "openai" in active_providers:
        configured_models.extend([
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (OpenAI)", "provider": "openai", "description": "OpenAI 官方直连"},
            {"id": "gpt-4o", "name": "GPT-4o (OpenAI)", "provider": "openai", "description": "OpenAI 官方直连全能模型"},
            {"id": "o1-preview", "name": "o1-preview (OpenAI)", "provider": "openai", "description": "OpenAI 深度思维链模型"},
            {"id": "o3-mini", "name": "o3-mini (OpenAI)", "provider": "openai", "description": "OpenAI 快速推理模型"}
        ])

    # 4. Add Anthropic models if anthropic key is present
    if "anthropic" in active_providers:
        configured_models.extend([
            {"id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet (Direct)", "provider": "anthropic", "description": "Anthropic 官方直连"},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (Direct)", "provider": "anthropic", "description": "极速响应轻量 Claude"}
        ])

    # 5. Add Gemini models if gemini key is present
    if "gemini" in active_providers:
        configured_models.extend([
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Direct)", "provider": "gemini", "description": "Google 官方直连极速模型"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Direct)", "provider": "gemini", "description": "Google 官方直连旗舰长文本"}
        ])

    # 6. Add Ollama models if local service is up
    if "ollama" in active_providers:
        configured_models.extend(ollama_models)

    # 7. Merge any explicitly added user custom models
    existing_ids = {m["id"] for m in configured_models}
    for cfg in user_configs:
        if cfg.model not in existing_ids:
            configured_models.append({
                "id": cfg.model,
                "name": f"{cfg.model} ({cfg.provider})",
                "provider": cfg.provider,
                "description": "用户自定义添加"
            })
            existing_ids.add(cfg.model)

    return {
        "active_providers": list(active_providers),
        "total": len(configured_models),
        "models": configured_models
    }


@router.get("", response_model=List[ModelConfigResponse])
async def list_user_model_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ModelConfig).where(ModelConfig.user_id == current_user.id)
    configs = (await db.execute(stmt)).scalars().all()

    result = []
    for cfg in configs:
        result.append(
            ModelConfigResponse(
                id=cfg.id,
                user_id=cfg.user_id,
                provider=cfg.provider,
                model=cfg.model,
                has_api_key=bool(cfg.api_key_encrypted),
                base_url=cfg.base_url,
                enabled=cfg.enabled,
                created_at=cfg.created_at,
                updated_at=cfg.updated_at
            )
        )
    return result


@router.post("", response_model=ModelConfigResponse)
async def create_model_config(
    cfg_in: ModelConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    encrypted_key = encrypt_api_key(cfg_in.api_key) if cfg_in.api_key else None
    config = ModelConfig(
        user_id=current_user.id,
        provider=cfg_in.provider,
        model=cfg_in.model,
        api_key_encrypted=encrypted_key,
        base_url=cfg_in.base_url,
        enabled=cfg_in.enabled
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return ModelConfigResponse(
        id=config.id,
        user_id=config.user_id,
        provider=config.provider,
        model=config.model,
        has_api_key=bool(config.api_key_encrypted),
        base_url=config.base_url,
        enabled=config.enabled,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.patch("/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: str,
    cfg_in: ModelConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ModelConfig).where(
        ModelConfig.id == config_id,
        ModelConfig.user_id == current_user.id
    )
    config = (await db.execute(stmt)).scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found")

    if cfg_in.provider is not None:
        config.provider = cfg_in.provider
    if cfg_in.model is not None:
        config.model = cfg_in.model
    if cfg_in.api_key is not None:
        config.api_key_encrypted = encrypt_api_key(cfg_in.api_key)
    if cfg_in.base_url is not None:
        config.base_url = cfg_in.base_url
    if cfg_in.enabled is not None:
        config.enabled = cfg_in.enabled

    await db.commit()
    await db.refresh(config)

    return ModelConfigResponse(
        id=config.id,
        user_id=config.user_id,
        provider=config.provider,
        model=config.model,
        has_api_key=bool(config.api_key_encrypted),
        base_url=config.base_url,
        enabled=config.enabled,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ModelConfig).where(
        ModelConfig.id == config_id,
        ModelConfig.user_id == current_user.id
    )
    config = (await db.execute(stmt)).scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found")

    await db.delete(config)
    await db.commit()
    return None
