import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.i18n import tr
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


# ── Trend aggregation ────────────────────────────────────────────────────────
# One implementation for both endpoints. They differ only in whether the query has
# to join conversations (per-user) or not (system-wide), so that is the only knob.

#: date_trunc unit per period. "month" and "all" share the daily bucket.
_TREND_UNIT = {"today": "hour", "year": "month"}


def _build_trend_stmt(
    period: str,
    start_time: Optional[datetime],
    where: List,
    *,
    join_conversation: bool,
):
    """Per-bucket call/token/cost rows, one row per (bucket, model).

    Grouping by model as well as bucket is what lets the per-day cost come from
    :func:`calculate_cost` instead of a flat guess. Summing real per-model prices
    in Python makes the trend total identical to the model breakdown total; before
    this, the chart hardcoded 0.20/0.80 per million while the breakdown used the
    table above, so a Claude-only user saw a chart ~15x below their own total.
    """
    unit = _TREND_UNIT.get(period, "day")

    stmt = select(
        func.date_trunc(unit, Message.created_at).label("time_bucket"),
        Message.model,
        func.count(Message.id).label("calls"),
        func.coalesce(func.sum(Message.token_usage), 0).label("tokens"),
        func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
        func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
    )
    if join_conversation:
        stmt = stmt.join(Conversation, Message.conversation_id == Conversation.id)

    conditions = list(where)
    if start_time:
        conditions.append(Message.created_at >= start_time)
    else:
        # "all" with no lower bound would chart the entire table; 30 days is what
        # the UI actually draws. "today" and "year" always have a start_time, so
        # this branch never applies to them.
        conditions.append(
            Message.created_at >= datetime.now(timezone.utc) - timedelta(days=30)
        )

    return (
        stmt.where(*conditions)
        .group_by("time_bucket", Message.model)
        .order_by("time_bucket")
    )


def _trend_label(time_bucket, period: str, tz_offset: int) -> str:
    if not time_bucket:
        return ""
    # Buckets come out in UTC; shift into the client's zone before formatting.
    local = time_bucket - timedelta(minutes=tz_offset)
    if period == "today":
        return local.strftime("%H:00")
    if period == "year":
        return local.strftime("%Y-%m")
    return local.strftime("%Y-%m-%d")


def _aggregate_trend(rows, period: str, tz_offset: int) -> List[Dict[str, Any]]:
    """Collapse (bucket, model) rows into one entry per bucket, chronologically."""
    buckets: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        label = _trend_label(row.time_bucket, period, tz_offset)
        entry = buckets.setdefault(
            label,
            {"date": label, "calls": 0, "tokens": 0, "cost_usd": 0.0},
        )
        entry["calls"] += int(row.calls)
        entry["tokens"] += int(row.tokens)
        entry["cost_usd"] += calculate_cost(
            row.model, int(row.prompt_tokens), int(row.completion_tokens)
        )

    # Labels are zero-padded, so lexicographic order is chronological order. The
    # empty label (a null bucket) sorts last rather than first.
    ordered = sorted(buckets.values(), key=lambda e: (e["date"] == "", e["date"]))
    for entry in ordered:
        entry["cost_usd"] = round(entry["cost_usd"], 4)
        entry["cost_cny"] = round(entry["cost_usd"] * USD_TO_CNY, 4)
    return ordered


async def _fetch_trend(
    db: AsyncSession,
    period: str,
    start_time: Optional[datetime],
    where: List,
    tz_offset: int,
    *,
    join_conversation: bool,
) -> List[Dict[str, Any]]:
    stmt = _build_trend_stmt(
        period, start_time, where, join_conversation=join_conversation
    )
    return _aggregate_trend((await db.execute(stmt)).all(), period, tz_offset)


# ── Per-model cost helper ────────────────────────────────────────────────────

def _to_model_breakdown(rows) -> List[Dict[str, Any]]:
    """Turn (model, agg) rows into the frontend's model_breakdown shape."""
    breakdown = []
    for r in rows:
        m_name = r.model or "unknown"
        p_tok = int(r.prompt_tokens)
        c_tok = int(r.completion_tokens)
        cost = calculate_cost(m_name, p_tok, c_tok)
        breakdown.append({
            "model": m_name,
            "calls": int(r.calls),
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "total_tokens": int(r.total_tokens),
            "cost_usd": round(cost, 4),
            "cost_cny": round(cost * USD_TO_CNY, 4),
            "is_free": _is_free_usage(m_name),
        })
    breakdown.sort(key=lambda x: x["total_tokens"], reverse=True)
    return breakdown


def _is_free_usage(model_name: str) -> bool:
    lowered = (model_name or "").lower()
    return ":free" in lowered or "ollama" in lowered or "免费" in (model_name or "")


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
    model_breakdown = _to_model_breakdown((await db.execute(stmt)).all())

    total_calls = sum(item["calls"] for item in model_breakdown)
    total_prompt_tokens = sum(item["prompt_tokens"] for item in model_breakdown)
    total_completion_tokens = sum(item["completion_tokens"] for item in model_breakdown)
    total_tokens = sum(item["total_tokens"] for item in model_breakdown)
    total_cost_usd = sum(item["cost_usd"] for item in model_breakdown)

    daily_trend = await _fetch_trend(
        db,
        period,
        start_time,
        [Conversation.user_id == current_user.id, Message.role == "assistant"],
        tz_offset,
        join_conversation=True,
    )

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


async def _admin_token_rollup(db: AsyncSession, start_time: Optional[datetime]) -> Dict[str, Any]:
    """Per-user assistant-message totals for the period, keyed by user_id."""
    where = [Message.role == "assistant"]
    if start_time:
        where.append(Message.created_at >= start_time)
    stmt = (
        select(
            Conversation.user_id,
            func.count(Message.id).label("msg_count"),
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(*where)
        .group_by(Conversation.user_id)
    )
    rows = {r.user_id: r for r in (await db.execute(stmt)).all()}

    # Conversation counts come from their own query because users with zero
    # assistant messages still need to appear in the ranking.
    conv_stmt = select(Conversation.user_id, func.count(Conversation.id))
    if start_time:
        conv_stmt = conv_stmt.where(Conversation.created_at >= start_time)
    conv_counts = dict(
        (await db.execute(conv_stmt.group_by(Conversation.user_id))).all()
    )
    return {"tokens": rows, "conversations": conv_counts}


async def _admin_per_user_costs(
    db: AsyncSession, start_time: Optional[datetime]
) -> Dict[str, Dict[str, Any]]:
    """Per-user, per-model token sums — the input to real cost calculation.

    A user's total cost cannot be derived from their token totals alone: 1M
    prompt tokens on a free model and on Claude cost very different amounts.
    """
    where = [Message.role == "assistant"]
    if start_time:
        where.append(Message.created_at >= start_time)
    stmt = (
        select(
            Conversation.user_id,
            Message.model,
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(*where)
        .group_by(Conversation.user_id, Message.model)
    )

    result: Dict[str, Dict[str, Any]] = {}
    for r in (await db.execute(stmt)).all():
        uid = r.user_id
        m_name = r.model or "unknown"
        entry = result.setdefault(uid, {"cost_usd": 0.0, "model_tokens": {}})
        entry["cost_usd"] += calculate_cost(
            m_name, int(r.prompt_tokens), int(r.completion_tokens)
        )
        tokens = entry["model_tokens"]
        tokens[m_name] = tokens.get(m_name, 0) + int(r.total_tokens)
    return result


async def _global_model_breakdown(
    db: AsyncSession, start_time: Optional[datetime]
) -> List[Dict[str, Any]]:
    """System-wide model usage. No conversation join — every message counts."""
    where = [Message.role == "assistant"]
    if start_time:
        where.append(Message.created_at >= start_time)
    stmt = (
        select(
            Message.model,
            func.count(Message.id).label("calls"),
            func.coalesce(func.sum(Message.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(Message.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(Message.token_usage), 0).label("total_tokens")
        )
        .where(*where)
        .group_by(Message.model)
    )
    return _to_model_breakdown((await db.execute(stmt)).all())


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

    all_users = (await db.execute(select(User).order_by(User.created_at.asc()))).scalars().all()
    rollup = await _admin_token_rollup(db, start_time)
    token_rows = rollup["tokens"]
    conv_counts = rollup["conversations"]
    per_user_costs = await _admin_per_user_costs(db, start_time)

    users_list = []
    totals = {
        "tokens": 0, "prompt_tokens": 0, "completion_tokens": 0,
        "messages": 0, "cost_usd": 0.0,
    }

    for u in all_users:
        stat = token_rows.get(u.id)
        p_tok = int(stat.prompt_tokens) if stat else 0
        c_tok = int(stat.completion_tokens) if stat else 0
        t_tok = int(stat.total_tokens) if stat else 0
        msgs = int(stat.msg_count) if stat else 0
        cost_usd = per_user_costs.get(u.id, {}).get("cost_usd", 0.0)
        model_tokens = per_user_costs.get(u.id, {}).get("model_tokens", {})
        top_model = max(model_tokens.items(), key=lambda kv: kv[1])[0] if model_tokens else "-"

        totals["tokens"] += t_tok
        totals["prompt_tokens"] += p_tok
        totals["completion_tokens"] += c_tok
        totals["messages"] += msgs
        totals["cost_usd"] += cost_usd

        users_list.append({
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "is_superuser": getattr(u, "is_superuser", False),
            "is_active": getattr(u, "is_active", True),
            "can_access_all_models": getattr(u, "can_access_all_models", False) or getattr(u, "is_superuser", False),
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "",
            "conversations_count": conv_counts.get(u.id, 0),
            "messages_count": msgs,
            "total_tokens": t_tok,
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "estimated_cost_usd": round(cost_usd, 4),
            "estimated_cost_cny": round(cost_usd * USD_TO_CNY, 2),
            "top_model": top_model
        })

    # Rank by tokens, matching the ordering the admin table renders.
    users_list.sort(key=lambda x: x["total_tokens"], reverse=True)

    global_models = await _global_model_breakdown(db, start_time)

    daily_trend = await _fetch_trend(
        db,
        period,
        start_time,
        [Message.role == "assistant"],
        tz_offset,
        join_conversation=False,
    )

    return {
        "period": period,
        "total_users": len(all_users),
        "active_users": sum(1 for u in all_users if getattr(u, "is_active", True)),
        "total_conversations": sum(conv_counts.values()),
        "total_messages": totals["messages"],
        "total_tokens": totals["tokens"],
        "total_prompt_tokens": totals["prompt_tokens"],
        "total_completion_tokens": totals["completion_tokens"],
        "total_cost_usd": round(totals["cost_usd"], 4),
        "total_cost_cny": round(totals["cost_usd"] * USD_TO_CNY, 2),
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
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="CANNOT_DISABLE_SELF",
        )

    stmt = select(User).where(User.id == user_id)
    target = (await db.execute(stmt)).scalar_one_or_none()
    if not target:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="USER_NOT_FOUND")

    target.is_active = not target.is_active
    await db.commit()
    await db.refresh(target)
    return {
        "user_id": target.id,
        "username": target.username,
        "is_active": target.is_active,
        "message": tr(
            "ADMIN_USER_ENABLED" if target.is_active else "ADMIN_USER_DISABLED",
            username=target.username,
        )
    }


@router.post("/admin/users/{user_id}/toggle-admin")
async def toggle_user_admin(
    user_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Grant or revoke super admin privilege."""
    if user_id == admin_user.id:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="CANNOT_MODIFY_SELF_ADMIN",
        )

    stmt = select(User).where(User.id == user_id)
    target = (await db.execute(stmt)).scalar_one_or_none()
    if not target:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="USER_NOT_FOUND")

    target.is_superuser = not target.is_superuser
    if target.is_superuser:
        target.can_access_all_models = True
    else:
        # Demotion revokes model entitlement
        target.can_access_all_models = False
    await db.commit()
    await db.refresh(target)
    return {
        "user_id": target.id,
        "username": target.username,
        "is_superuser": target.is_superuser,
        "can_access_all_models": target.can_access_all_models,
        "message": tr(
            "ADMIN_FLAG_GRANTED" if target.is_superuser else "ADMIN_FLAG_REVOKED",
            username=target.username,
        )
    }


class ToggleAllModelsRequest(BaseModel):
    can_access_all_models: Optional[bool] = None


@router.post("/admin/users/{user_id}/toggle-all-models")
async def toggle_user_all_models(
    user_id: str,
    payload: Optional[ToggleAllModelsRequest] = None,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Switch or set whether a user can access all models (including paid ones)."""
    stmt = select(User).where(User.id == user_id)
    target = (await db.execute(stmt)).scalar_one_or_none()
    if not target:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="USER_NOT_FOUND")

    if target.is_superuser:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="ADMIN_MODELS_NOOP",
        )

    if payload and payload.can_access_all_models is not None:
        target.can_access_all_models = payload.can_access_all_models
    else:
        target.can_access_all_models = not bool(target.can_access_all_models)

    await db.commit()
    await db.refresh(target)
    return {
        "user_id": target.id,
        "username": target.username,
        "can_access_all_models": target.can_access_all_models,
        "message": tr(
            "ADMIN_FULL_ACCESS_ON" if target.can_access_all_models else "ADMIN_FULL_ACCESS_OFF",
            username=target.username,
        )
    }


@router.get("/admin/users/{user_id}/conversations")
async def get_admin_user_conversations(
    user_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin can view all conversations of a user, including soft-deleted ones."""
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
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="CONVERSATION_NOT_FOUND")

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
