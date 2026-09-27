import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from app.core.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.api.v1.deps import get_current_user, get_current_admin

logger = logging.getLogger("stats")
router = APIRouter(prefix="/stats", tags=["stats"])

# USD to CNY Exchange Rate
USD_TO_CNY = 7.25

# Pricing table per 1,000,000 (1M) tokens: (prompt_usd_per_1m, completion_usd_per_1m)
MODEL_PRICING: Dict[str, tuple] = {
    # Free models
    ":free": (0.0, 0.0),
    "ollama": (0.0, 0.0),

    # OpenAI
    "gpt-4o-mini": (0.15, 0.60),
    "openai/gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "openai/gpt-4o": (2.50, 10.00),
    "o1-preview": (15.00, 60.00),
    "o3-mini": (1.10, 4.40),

    # Anthropic
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-5-sonnet-20240620": (3.00, 15.00),
    "anthropic/claude-3.5-sonnet": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "claude-3-5-haiku-20241022": (0.80, 4.00),
    "anthropic/claude-3.5-haiku": (0.80, 4.00),

    # DeepSeek
    "deepseek/deepseek-chat": (0.14, 0.28),
    "deepseek-chat": (0.14, 0.28),
    "deepseek/deepseek-r1": (0.55, 2.19),
    "deepseek-reasoner": (0.55, 2.19),

    # Google Gemini
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    "google/gemini-2.0-flash-exp": (0.0, 0.0),
    "google/gemini-pro-1.5": (1.25, 5.00),

    # Meta / Qwen
    "meta-llama/llama-3.1-70b-instruct": (0.40, 0.40),
    "meta-llama/llama-3.3-70b-instruct": (0.40, 0.40),
    "qwen/qwen-2.5-72b-instruct": (0.35, 0.40),
    "qwen/qwen-2.5-coder-32b-instruct": (0.20, 0.20),
}


def calculate_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate estimated cost in USD based on model pricing."""
    if not model_name:
        return 0.0
    
    m_lower = model_name.lower().strip()
    if ":free" in m_lower or "ollama" in m_lower or "(free)" in m_lower or "免费" in m_lower:
        return 0.0

    # Look up exact match
    rates = MODEL_PRICING.get(m_lower)
    if not rates:
        # Look up by partial prefix match
        for key, p_rates in MODEL_PRICING.items():
            if key in m_lower or m_lower.endswith(key):
                rates = p_rates
                break

    # Fallback to standard lightweight rate if unknown
    if not rates:
        rates = (0.20, 0.80)

    prompt_cost = (prompt_tokens / 1_000_000.0) * rates[0]
    completion_cost = (completion_tokens / 1_000_000.0) * rates[1]
    return round(prompt_cost + completion_cost, 6)


def get_period_filter_datetime(period: str, tz_offset_minutes: int = 0) -> Optional[datetime]:
    """
    Calculate the start datetime in UTC for the given period (today, month, year, all),
    taking the client's local timezone offset into account.
    """
    if not period or period == "all":
        return None

    now_utc = datetime.now(timezone.utc)
    # Convert UTC to user's local time (tz_offset_minutes is client's getTimezoneOffset())
    local_now = now_utc - timedelta(minutes=tz_offset_minutes)

    p = period.lower().strip()
    if p == "today":
        local_start = datetime(local_now.year, local_now.month, local_now.day, 0, 0, 0)
    elif p == "month":
        local_start = datetime(local_now.year, local_now.month, 1, 0, 0, 0)
    elif p == "year":
        local_start = datetime(local_now.year, 1, 1, 0, 0, 0)
    else:
        return None

    # Convert local start back to UTC
    start_utc = local_start + timedelta(minutes=tz_offset_minutes)
    return start_utc.replace(tzinfo=timezone.utc)


@router.get("/my")
async def get_my_usage_stats(
    period: str = Query("all", pattern="^(all|today|month|year)$"),
    tz_offset: int = Query(0, description="Client timezone offset in minutes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch usage and token statistics for the current user filtered by period."""
    start_time = get_period_filter_datetime(period, tz_offset)

    # 1. Total conversations (filtered by period if applicable)
    conv_where = [Conversation.user_id == current_user.id]
    if start_time:
        conv_where.append(Conversation.created_at >= start_time)
    conv_stmt = select(func.count(Conversation.id)).where(*conv_where)
    total_convs = (await db.execute(conv_stmt)).scalar() or 0

    # 2. Messages by this user in this period
    msg_where = [Conversation.user_id == current_user.id, Message.role == "assistant"]
    if start_time:
        msg_where.append(Message.created_at >= start_time)

    stmt = (
        select(
            Message.model,
            func.count(Message.id).label("calls"),
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(*msg_where)
        .group_by(Message.model)
    )
    rows = (await db.execute(stmt)).all()

    total_calls = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    total_cost_usd = 0.0
    model_breakdown = []

    for r in rows:
        m_name = r.model or "unknown"
        p_tok = int(r.prompt_tokens)
        c_tok = int(r.completion_tokens)
        t_tok = int(r.total_tokens)
        calls = int(r.calls)
        cost = calculate_cost(m_name, p_tok, c_tok)

        total_calls += calls
        total_prompt_tokens += p_tok
        total_completion_tokens += c_tok
        total_tokens += t_tok
        total_cost_usd += cost

        model_breakdown.append({
            "model": m_name,
            "calls": calls,
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "total_tokens": t_tok,
            "cost_usd": round(cost, 4),
            "cost_cny": round(cost * USD_TO_CNY, 4),
            "is_free": ":free" in m_name.lower() or "ollama" in m_name.lower() or "免费" in m_name
        })

    model_breakdown.sort(key=lambda x: x["total_tokens"], reverse=True)

    # 3. Dynamic trend depending on period
    trend_where = [Conversation.user_id == current_user.id, Message.role == "assistant"]
    if period == "today":
        # Hourly trend for today
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        trend_stmt = (
            select(
                func.date_trunc("hour", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )
    elif period == "year":
        # Monthly trend for this year
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        trend_stmt = (
            select(
                func.date_trunc("month", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )
    else:
        # Daily trend (for "month" or "all")
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        else:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            trend_where.append(Message.created_at >= thirty_days_ago)

        trend_stmt = (
            select(
                func.date_trunc("day", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )

    daily_rows = (await db.execute(trend_stmt)).all()
    daily_trend = []
    for d in daily_rows:
        if d.time_bucket:
            # Adjust bucket timestamp to user local time
            b_local = d.time_bucket - timedelta(minutes=tz_offset)
            if period == "today":
                label_str = b_local.strftime("%H:00")
            elif period == "year":
                label_str = b_local.strftime("%Y-%m")
            else:
                label_str = b_local.strftime("%Y-%m-%d")
        else:
            label_str = ""

        d_p = int(d.prompt_tokens)
        d_c = int(d.completion_tokens)
        d_cost = round((d_p * 0.2 + d_c * 0.8) / 1_000_000.0, 4)
        daily_trend.append({
            "date": label_str,
            "calls": int(d.calls),
            "tokens": int(d.tokens),
            "cost_usd": d_cost,
            "cost_cny": round(d_cost * USD_TO_CNY, 4)
        })

    return {
        "period": period,
        "user_id": current_user.id,
        "username": current_user.username,
        "is_superuser": current_user.is_superuser,
        "total_conversations": total_convs,
        "total_messages": total_calls,
        "total_tokens": total_tokens,
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "estimated_cost_usd": round(total_cost_usd, 4),
        "estimated_cost_cny": round(total_cost_usd * USD_TO_CNY, 2),
        "model_breakdown": model_breakdown,
        "daily_trend": daily_trend
    }


@router.get("/admin/overview")
async def get_admin_overview_stats(
    period: str = Query("all", pattern="^(all|today|month|year)$"),
    tz_offset: int = Query(0, description="Client timezone offset in minutes"),
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL ADMIN FEATURE:
    Returns system-wide usage statistics, ranking of each individual user's tokens & costs filtered by period.
    """
    start_time = get_period_filter_datetime(period, tz_offset)

    # 1. Fetch all users
    users_stmt = select(User).order_by(User.created_at.asc())
    all_users = (await db.execute(users_stmt)).scalars().all()

    # 2. Aggregated stats per user for this period
    user_stats_where = [Message.role == "assistant"]
    if start_time:
        user_stats_where.append(Message.created_at >= start_time)

    user_stats_stmt = (
        select(
            Conversation.user_id,
            func.count(func.distinct(Conversation.id)).label("conv_count"),
            func.count(Message.id).label("msg_count"),
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(*user_stats_where)
        .group_by(Conversation.user_id)
    )
    user_stats_rows = {r.user_id: r for r in (await db.execute(user_stats_stmt)).all()}

    # Also count conversations per user
    conv_where = []
    if start_time:
        conv_where.append(Conversation.created_at >= start_time)
    conv_counts_stmt = select(Conversation.user_id, func.count(Conversation.id))
    if conv_where:
        conv_counts_stmt = conv_counts_stmt.where(*conv_where)
    conv_counts_stmt = conv_counts_stmt.group_by(Conversation.user_id)
    all_conv_counts = dict((await db.execute(conv_counts_stmt)).all())

    # Calculate model costs per user for this period
    user_model_where = [Message.role == "assistant"]
    if start_time:
        user_model_where.append(Message.created_at >= start_time)

    user_model_stmt = (
        select(
            Conversation.user_id,
            Message.model,
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(*user_model_where)
        .group_by(Conversation.user_id, Message.model)
    )
    user_model_rows = (await db.execute(user_model_stmt)).all()

    user_costs: Dict[str, float] = {}
    user_top_models: Dict[str, str] = {}
    user_model_tokens: Dict[str, Dict[str, int]] = {}

    for r in user_model_rows:
        uid = r.user_id
        m_name = r.model or "unknown"
        p_tok = int(r.prompt_tokens)
        c_tok = int(r.completion_tokens)
        cost = calculate_cost(m_name, p_tok, c_tok)
        user_costs[uid] = user_costs.get(uid, 0.0) + cost

        if uid not in user_model_tokens:
            user_model_tokens[uid] = {}
        user_model_tokens[uid][m_name] = user_model_tokens[uid].get(m_name, 0) + int(r.total_tokens)

    # Determine top model for each user
    for uid, models_map in user_model_tokens.items():
        if models_map:
            top_m = max(models_map.items(), key=lambda x: x[1])[0]
            user_top_models[uid] = top_m

    users_list = []
    total_system_tokens = 0
    total_system_prompt_tokens = 0
    total_system_completion_tokens = 0
    total_system_cost_usd = 0.0
    total_system_conversations = sum(all_conv_counts.values())
    total_system_messages = 0

    for u in all_users:
        stat = user_stats_rows.get(u.id)
        p_tok = int(stat.prompt_tokens) if stat else 0
        c_tok = int(stat.completion_tokens) if stat else 0
        t_tok = int(stat.total_tokens) if stat else 0
        msgs = int(stat.msg_count) if stat else 0
        convs = all_conv_counts.get(u.id, 0)
        cost_usd = user_costs.get(u.id, 0.0)

        total_system_tokens += t_tok
        total_system_prompt_tokens += p_tok
        total_system_completion_tokens += c_tok
        total_system_messages += msgs
        total_system_cost_usd += cost_usd

        users_list.append({
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "is_superuser": getattr(u, "is_superuser", False),
            "is_active": getattr(u, "is_active", True),
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "",
            "conversations_count": convs,
            "messages_count": msgs,
            "total_tokens": t_tok,
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "estimated_cost_usd": round(cost_usd, 4),
            "estimated_cost_cny": round(cost_usd * USD_TO_CNY, 2),
            "top_model": user_top_models.get(u.id, "-")
        })

    # Sort users by total tokens in this period descending
    users_list.sort(key=lambda x: x["total_tokens"], reverse=True)

    # 3. System-wide model breakdown in this period
    global_model_where = [Message.role == "assistant"]
    if start_time:
        global_model_where.append(Message.created_at >= start_time)

    global_model_stmt = (
        select(
            Message.model,
            func.count(Message.id).label("calls"),
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .where(*global_model_where)
        .group_by(Message.model)
    )
    global_model_rows = (await db.execute(global_model_stmt)).all()
    global_models = []
    for r in global_model_rows:
        m_name = r.model or "unknown"
        p_tok = int(r.prompt_tokens)
        c_tok = int(r.completion_tokens)
        t_tok = int(r.total_tokens)
        calls = int(r.calls)
        cost = calculate_cost(m_name, p_tok, c_tok)
        global_models.append({
            "model": m_name,
            "calls": calls,
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "total_tokens": t_tok,
            "cost_usd": round(cost, 4),
            "cost_cny": round(cost * USD_TO_CNY, 2),
            "is_free": ":free" in m_name.lower() or "ollama" in m_name.lower() or "免费" in m_name
        })
    global_models.sort(key=lambda x: x["total_tokens"], reverse=True)

    # 4. System-wide dynamic trend depending on period
    trend_where = [Message.role == "assistant"]
    if period == "today":
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        trend_stmt = (
            select(
                func.date_trunc("hour", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )
    elif period == "year":
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        trend_stmt = (
            select(
                func.date_trunc("month", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )
    else:
        if start_time:
            trend_where.append(Message.created_at >= start_time)
        else:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            trend_where.append(Message.created_at >= thirty_days_ago)

        trend_stmt = (
            select(
                func.date_trunc("day", Message.created_at).label("time_bucket"),
                func.count(Message.id).label("calls"),
                func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
                func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens")
            )
            .where(*trend_where)
            .group_by("time_bucket")
            .order_by("time_bucket")
        )

    daily_rows = (await db.execute(trend_stmt)).all()
    daily_trend = []
    for d in daily_rows:
        if d.time_bucket:
            b_local = d.time_bucket - timedelta(minutes=tz_offset)
            if period == "today":
                label_str = b_local.strftime("%H:00")
            elif period == "year":
                label_str = b_local.strftime("%Y-%m")
            else:
                label_str = b_local.strftime("%Y-%m-%d")
        else:
            label_str = ""

        d_p = int(d.prompt_tokens)
        d_c = int(d.completion_tokens)
        d_cost = round((d_p * 0.2 + d_c * 0.8) / 1_000_000.0, 4)
        daily_trend.append({
            "date": label_str,
            "calls": int(d.calls),
            "tokens": int(d.tokens),
            "cost_usd": d_cost,
            "cost_cny": round(d_cost * USD_TO_CNY, 2)
        })

    return {
        "period": period,
        "total_users": len(all_users),
        "active_users": sum(1 for u in all_users if getattr(u, "is_active", True)),
        "total_conversations": total_system_conversations,
        "total_messages": total_system_messages,
        "total_tokens": total_system_tokens,
        "total_prompt_tokens": total_system_prompt_tokens,
        "total_completion_tokens": total_system_completion_tokens,
        "total_cost_usd": round(total_system_cost_usd, 4),
        "total_cost_cny": round(total_system_cost_usd * USD_TO_CNY, 2),
        "users": users_list,
        "model_breakdown": global_models,
        "daily_trend": daily_trend
    }


@router.post("/admin/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable a user account."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能停用当前登录的管理员账号"
        )

    stmt = select(User).where(User.id == user_id)
    target = (await db.execute(stmt)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    target.is_active = not target.is_active
    await db.commit()
    await db.refresh(target)
    return {
        "user_id": target.id,
        "username": target.username,
        "is_active": target.is_active,
        "message": f"用户 {target.username} 已{'启用' if target.is_active else '停用'}"
    }


@router.post("/admin/users/{user_id}/toggle-admin")
async def toggle_user_admin(
    user_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Grant or revoke super admin privilege."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能修改自己账号的管理员权限"
        )

    stmt = select(User).where(User.id == user_id)
    target = (await db.execute(stmt)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    target.is_superuser = not target.is_superuser
    await db.commit()
    await db.refresh(target)
    return {
        "user_id": target.id,
        "username": target.username,
        "is_superuser": target.is_superuser,
        "message": f"用户 {target.username} 管理员权限已{'开启' if target.is_superuser else '取消'}"
    }


@router.get("/admin/users/{user_id}/conversations")
async def get_admin_user_conversations(
    user_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL AUDIT FEATURE:
    Admin can view all conversations of a user, including those marked as deleted by the user.
    """
    stmt = (
        select(
            Conversation.id,
            Conversation.title,
            Conversation.model,
            Conversation.is_deleted,
            Conversation.deleted_at,
            Conversation.created_at,
            Conversation.updated_at,
            func.count(Message.id).label("message_count"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.user_id == user_id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    results = []
    for r in rows:
        results.append({
            "id": r.id,
            "title": r.title,
            "model": r.model,
            "is_deleted": bool(r.is_deleted),
            "deleted_at": r.deleted_at.strftime("%Y-%m-%d %H:%M") if r.deleted_at else None,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
            "updated_at": r.updated_at.strftime("%Y-%m-%d %H:%M") if r.updated_at else None,
            "message_count": int(r.message_count),
            "total_tokens": int(r.total_tokens)
        })
    return results


@router.get("/admin/conversations/{conversation_id}/messages")
async def get_admin_conversation_messages(
    conversation_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin can inspect all messages of any conversation for safety and audit."""
    c_stmt = select(Conversation).where(Conversation.id == conversation_id)
    conv = (await db.execute(c_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    m_stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = (await db.execute(m_stmt)).scalars().all()
    return {
        "conversation": {
            "id": conv.id,
            "title": conv.title,
            "model": conv.model,
            "is_deleted": conv.is_deleted,
            "deleted_at": conv.deleted_at.strftime("%Y-%m-%d %H:%M") if conv.deleted_at else None,
            "created_at": conv.created_at.strftime("%Y-%m-%d %H:%M") if conv.created_at else None,
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "model": m.model,
                "token_usage": m.token_usage or 0,
                "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else None
            }
            for m in messages
        ]
    }


@router.post("/admin/conversations/{conversation_id}/restore")
async def admin_restore_conversation(
    conversation_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin can restore any soft-deleted conversation."""
    c_stmt = select(Conversation).where(Conversation.id == conversation_id)
    conv = (await db.execute(c_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    conv.is_deleted = False
    conv.deleted_at = None
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)
    return {
        "id": conv.id,
        "title": conv.title,
        "is_deleted": False,
        "message": f"对话 [{conv.title}] 已成功恢复"
    }
