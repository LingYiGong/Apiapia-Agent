from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional
from app.core.database import get_db
from app.core.config import settings as app_settings
from app.models.user import User
from app.models.setting import UserSetting
from app.schemas.setting import UserSettingUpdate, UserSettingResponse
from app.api.v1.deps import get_current_user
from app.services.image_gen import image_gen_service

router = APIRouter(prefix="/settings", tags=["settings"])


async def _validate_image_model(current_user: User, model_id: Optional[str]) -> None:
    """
    Reject image models that are unavailable or outside the account entitlement.
    Mirrors the entitlement rule used for chat models. An empty value clears the
    selection and is always allowed.
    """
    from app.api.v1.models import has_full_model_access

    model_id = (model_id or "").strip()
    if not model_id:
        return

    catalog = await image_gen_service.list_available_models()
    entry = next((m for m in catalog if m["id"] == model_id), None)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"所选绘图模型当前不可用（对应服务未配置或模型已下架）：{model_id}"
        )
    if not has_full_model_access(current_user) and not entry.get("is_free"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"当前账号处于体验模式，仅可使用免费绘图模型；「{entry.get('name') or model_id}」为计费模型。"
        )


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
            system_prompt="你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
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

    # For users restricted to free models, ensure default_model falls back to openrouter/free if needed
    from app.api.v1.models import check_user_can_use_model, has_full_model_access
    can_all = has_full_model_access(current_user)
    if not can_all:
        try:
            if not check_user_can_use_model(current_user, setting.default_model):
                setting.default_model = "openrouter/free"
                await db.commit()
                await db.refresh(setting)
        except Exception:
            pass

        # A previously stored paid image model must not survive a downgrade to
        # trial mode, otherwise the chat endpoint would have to reject it.
        if setting.image_model and not image_gen_service.is_free_image_model(setting.image_model):
            setting.image_model = None
            await db.commit()
            await db.refresh(setting)

    # Same contract as default_model: an unset image model always resolves to the
    # zero-cost default, so it is never null and never silently becomes a paid
    # model. Applies to every account, not just trial ones.
    if not setting.image_model:
        fallback_image = image_gen_service.default_image_model()
        if fallback_image:
            setting.image_model = fallback_image
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
        from app.api.v1.models import check_user_can_use_model
        if not check_user_can_use_model(current_user, update_data.default_model):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="当前账号处于体验模式，仅支持使用免费模型，无法将默认模型设置为计费模型。"
            )
        setting.default_model = update_data.default_model
    if update_data.memory_model is not None:
        # Memory LLM is admin-only: silently ignore when set by ordinary users
        # (rejecting outright would break older clients that always submit it)
        if getattr(current_user, "is_superuser", False):
            setting.memory_model = update_data.memory_model
    # model_fields_set distinguishes an omitted field from an explicit null. A null
    # is normalized to the zero-cost default rather than stored, so image_model
    # is always concrete.
    if "image_model" in update_data.model_fields_set:
        await _validate_image_model(current_user, update_data.image_model)
        chosen = (update_data.image_model or "").strip()
        setting.image_model = chosen or image_gen_service.default_image_model()
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
