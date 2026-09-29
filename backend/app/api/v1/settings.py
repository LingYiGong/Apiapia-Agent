from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.config import settings as app_settings
from app.models.user import User
from app.models.setting import UserSetting
from app.schemas.setting import UserSettingUpdate, UserSettingResponse
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=UserSettingResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        # Create default if not found
        setting = UserSetting(
            user_id=current_user.id,
            default_model=app_settings.DEFAULT_MODEL,
            memory_model="openai/gpt-4o-mini",
            system_prompt="你是一个智能、真诚、有洞察力的私人 AI 助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
            temperature=0.7,
            memory_enabled=True
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    elif not setting.memory_model:
        setting.memory_model = "openai/gpt-4o-mini"
        await db.commit()
        await db.refresh(setting)

    return setting


@router.patch("", response_model=UserSettingResponse)
async def update_user_settings(
    update_data: UserSettingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)

    if update_data.default_model is not None:
        setting.default_model = update_data.default_model
    if update_data.memory_model is not None:
        # Memory LLM is admin-only: silently ignore when set by ordinary users
        # (rejecting outright would break older clients that always submit it)
        if getattr(current_user, "is_superuser", False):
            setting.memory_model = update_data.memory_model
    if update_data.system_prompt is not None:
        setting.system_prompt = update_data.system_prompt
    if update_data.temperature is not None:
        setting.temperature = update_data.temperature
    if update_data.memory_enabled is not None:
        setting.memory_enabled = update_data.memory_enabled

    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(setting)

    return setting
