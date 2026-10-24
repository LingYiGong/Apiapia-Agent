import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.i18n import get_locale, language_directive
from app.services.memory.service import memory_service
from app.services.memory.extraction import _get_llm_client, safe_json_chat_completion

logger = logging.getLogger("memory_consolidation")

SNAPSHOTS_DIR = os.path.join(settings.MEM0_DATA_DIR, "snapshots")


def _get_snapshot_path(user_id: str) -> str:
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
    return os.path.join(SNAPSHOTS_DIR, f"{user_id}_latest.json")


def _safe_int(val: Any, default: int = 3) -> int:
    """Safely parse importance integer (1-5), protecting against floats and strings."""
    try:
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return max(1, min(5, int(val)))
        s = str(val).strip()
        f = float(s)
        return max(1, min(5, int(round(f))))
    except Exception:
        return default


def _normalize_category(cat: Any, importance: int = 3, text: str = "") -> str:
    """Normalize arbitrary category labels to the standard 5 buckets."""
    s = str(cat or "").lower().strip()
    if s in ("identity", "profile", "bio", "user", "personal", "whoami"):
        return "identity"
    if s in ("skills", "skill", "tech", "tool", "tools", "technology", "stack"):
        return "skills"
    if s in ("preferences", "preference", "habit", "habits", "taste", "tastes", "like", "likes"):
        return "preferences"
    if s in ("projects", "project", "work", "plan", "plans", "tasks", "task", "roadmap"):
        return "projects"
    # High-importance stable traits naturally map to identity if not specified
    if importance >= 4:
        return "identity"
    return "facts"


def get_snapshot_status(user_id: str) -> Dict[str, Any]:
    """Check if a rollback snapshot exists for this user."""
    path = _get_snapshot_path(user_id)
    if not os.path.isfile(path):
        return {"has_snapshot": False, "snapshot_time": None, "count": 0}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "has_snapshot": True,
                "snapshot_time": data.get("created_at"),
                "count": len(data.get("memories", [])),
            }
    except Exception as e:
        logger.warning("Failed to read snapshot for user %s: %s", user_id, e)
        return {"has_snapshot": False, "snapshot_time": None, "count": 0}


def create_snapshot(user_id: str) -> bool:
    """Save full snapshot of current memories before consolidation."""
    try:
        all_memories = memory_service.list_all_memories(user_id)
        path = _get_snapshot_path(user_id)
        snapshot = {
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "memories": all_memories,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)
        logger.info("Saved snapshot with %d memories for user %s", len(all_memories), user_id)
        return True
    except Exception as e:
        logger.error("Failed to save snapshot for user %s: %s", user_id, e)
        return False


def preview_consolidation(
    user_id: str,
    memory_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyze all user memories and generate a consolidation plan (Diff).
    Does NOT modify the database; returns proposals for frontend user review:
      - to_delete: expired/contradicted memories
      - to_update: memories that need refinement/updating
      - to_add: newly synthesized/consolidated facts
      - to_keep: valid unchanged memories
    """
    if not memory_service.is_configured():
        return {
            "status": "error",
            "message": "未配置 LLM API Key，无法使用记忆智能整理功能",
            "plan": None,
        }

    raw_memories = memory_service.list_all_memories(user_id)
    if not raw_memories:
        return {
            "status": "empty",
            "message": "当前暂无长期记忆记录，无需整理",
            "total_count": 0,
            "plan": None,
        }

    if len(raw_memories) < 2:
        return {
            "status": "too_few",
            "message": "当前记忆数量过少（不足2条），无需执行整理",
            "total_count": len(raw_memories),
            "plan": None,
        }

    # Determine model execution candidates with automatic resilience fallback
    candidates: List[str] = []
    if memory_model and memory_model.strip():
        req = memory_model.strip()
        if req != "openrouter/free":
            candidates.append(req)
        else:
            candidates.extend([
                "google/gemma-4-31b-it:free",
                "nvidia/nemotron-3-ultra-550b-a55b:free",
                "openrouter/free",
            ])
    else:
        candidates.extend([
            "google/gemma-4-31b-it:free",
            "nvidia/nemotron-3-ultra-550b-a55b:free",
            "openrouter/free",
        ])

    primary_client, _ = _get_llm_client(candidates[0])
    if not primary_client:
        return {
            "status": "error",
            "message": "LLM 客户端不可用，请检查模型与 API Key 配置",
            "plan": None,
        }

    # Format memories with compact short IDs and group them by category
    # This prevents LLM attention drift and enables precise cross-referencing within domains.
    short_to_real: Dict[str, str] = {}
    real_to_short: Dict[str, str] = {}
    real_to_text: Dict[str, str] = {}
    real_to_meta: Dict[str, dict] = {}

    category_buckets: Dict[str, List[str]] = {
        "identity": [],
        "skills": [],
        "preferences": [],
        "projects": [],
        "facts": [],
    }

    category_titles = {
        "identity": "个人身份与基本情况 (Identity)",
        "skills": "技能经验与技术工具栈 (Skills)",
        "preferences": "习惯偏好与生活工作习惯 (Preferences)",
        "projects": "核心项目与长远规划 (Projects)",
        "facts": "背景事实与日常记录 (Facts)",
    }

    for idx, item in enumerate(raw_memories, start=1):
        mid = str(item.get("id") or item.get("hash") or f"mem_{idx}").strip()
        if not mid:
            continue
        short_tag = f"M{idx}"
        for variant in (
            short_tag,
            short_tag.lower(),
            f"[{short_tag}]",
            f"[{short_tag.lower()}]",
            str(idx),
            f"#{idx}",
            f"M {idx}",
            f"m {idx}",
            f"第{idx}条",
            f"第{idx}",
        ):
            short_to_real[variant] = mid
        real_to_short[mid] = short_tag

        text = str(item.get("memory") or item.get("text") or "").strip()
        real_to_text[mid] = text
        meta = item.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        real_to_meta[mid] = meta

        created = item.get("created_at") or meta.get("created_at") or "未知时间"
        updated = item.get("updated_at") or meta.get("updated_at")
        time_info = f"记录时间: {created}" + (f", 更新时间: {updated}" if updated else "")
        importance = _safe_int(meta.get("importance"), default=3)
        category = _normalize_category(
            meta.get("category") or meta.get("type"),
            importance=importance,
            text=text,
        )

        item_str = f"标号: [{short_tag}] | {time_info} | 重要度: {importance}\n内容: {text}"
        category_buckets[category].append(item_str)

    # Build grouped text representation
    grouped_sections = []
    for cat_key, cat_title in category_titles.items():
        items_in_cat = category_buckets.get(cat_key, [])
        if items_in_cat:
            grouped_sections.append(
                f"### 【分类：{cat_title}】 (共 {len(items_in_cat)} 条)\n" + "\n---\n".join(items_in_cat)
            )

    memories_text = "\n\n".join(grouped_sections)

    prompt = (
        language_directive(get_locale())
        + "\n\n"
        + "你是一个专业的个人长期记忆库分析与整理系统。\n"
        "请对以下已按分类整理的用户记忆进行全局审计、时序冲突消除和脱水重构。\n\n"
        "每条记忆已分配唯一的短标号（如 [M1], [M2]）。在返回的 JSON 中，引用条目时必须严格使用该标号（如 \"M1\"），严禁编造或输出其他标号！\n\n"
        "【四项操作的分工准则（边界清晰，严格对应）】：\n"
        "1. 冲突更新【to_update】（单条就地修正与信息补全）：\n"
        "   - 适用场景：某条已有记忆包含的内容，在后续对话中被更正、升级、补充或时序变更（如：版本号从 13 升到 14、居住城市搬迁、偏好发生了改变、或原有事实补充了更具体的细节名称）。\n"
        "   - 处理方式：必须将其标号放入 to_update，在 text 中输出更新修正后的完整陈述（保留原条目 ID 原地更新，不要删了再加）。\n\n"
        "2. 提炼新增【to_add】（跨多条碎片综合归纳）：\n"
        "   - 适用场景：跨越 2 条及以上彼此关联的零碎事实，提炼归纳为一条内容丰富的高维度新事实。\n"
        "   - 绝对保留硬性细节：具体工具名、版本号、专有名词、明确禁忌，严禁概括为空洞套话！\n"
        "   - 推荐使用专业画像句式：建议采用“领域/维度：详细客观陈述”。\n\n"
        "【高质量提炼范式（学习优秀范例，避免劣质空话）】：\n"
        "  - 示例一（技术栈碎片合成）：\n"
        "    原碎片：[M1] 用户在排查 Docker 部署；[M2] 用户使用 Python 3.12；[M3] 用户在 Windows 上用 PowerShell 开发 FastAPI；[M4] 数据库使用 PostgreSQL。\n"
        "    ❌ 劣质空话：“用户使用 Python 和 Docker 做开发。”\n"
        "    ✔ 优质提炼：“技术栈与工程背景：主力开发语言为 Python 3.12，精通基于 FastAPI 框架构建后端 API，开发环境为 Windows (PowerShell) + Docker 容器化交付，数据库采用 PostgreSQL。”\n"
        "  - 示例二（习惯偏好碎片合成）：\n"
        "    原碎片：[M5] 用户喝美式；[M6] 用户从不喝含糖饮料；[M7] 用户不喜欢奶咖。\n"
        "    ❌ 劣质空话：“用户喜欢喝咖啡。”\n"
        "    ✔ 优质提炼：“饮食饮品偏好：坚持纯黑咖啡习惯（常饮热无糖美式），明确抗拒含糖饮料与奶咖制品。”\n"
        "  - 示例三（核心项目碎片合成）：\n"
        "    原碎片：[M8] 用户在开发 Apiapia 助理；[M9] 用户调试了长期记忆系统。\n"
        "    ❌ 劣质空话：“用户在做一个 AI 项目。”\n"
        "    ✔ 优质提炼：“核心研发项目：当前专注全栈开发个人智能助手‘Apiapia-Agent’，主导长期记忆引擎（Mem0 + pgvector）的架构优化与脱水重构。”\n\n"
        "3. 合并清理【to_delete】（只删有替代者的旧碎片）：\n"
        "   - 适用场景：凡是已经被提炼合成进 to_add 中的原碎片条目标号，全部 100% 放入 to_delete（说明原因：“已提炼合并至新条目”）。\n"
        "   - 绝对禁令：严禁以“琐事”、“历史事件”、“看似无用”为由凭空删除任何没有新事实替代的记忆！凡是没有被新条目吸收、也没有被更新修正的记忆，绝对禁止放入 to_delete！\n\n"
        "4. 保持不变【自动保留】：\n"
        "   - 系统会自动完整保留所有未在 to_delete 和 to_update 中提及的记忆。无需在 JSON 中输出不变列表。\n\n"
        "返回纯 JSON 格式（不要包含 markdown 代码块包裹）：\n"
        "{\n"
        '  "summary": "本次整理总结说明（如：更新了2处时序变更，提炼合并了3条零散习惯碎片）",\n'
        '  "to_delete": [\n'
        '    {"id": "M1", "reason": "已提炼合并至新条目"}\n'
        '  ],\n'
        '  "to_update": [\n'
        '    {"id": "M2", "text": "更新修正后的完整精确内容", "category": "identity|skills|preferences|projects|facts", "importance": 4, "reason": "状态时序更新或细节补充"}\n'
        '  ],\n'
        '  "to_add": [\n'
        '    {"text": "新合成的提炼事实", "category": "identity|skills|preferences|projects|facts", "importance": 4, "reason": "多条碎片综合归纳"}\n'
        '  ]\n'
        "}\n\n"
        "【待整理的记忆列表（已按分类分块）】：\n"
        + memories_text
    )

    plan = None
    used_model = None
    try:
        for cand in candidates:
            cand_client, cand_model = _get_llm_client(cand)
            if not cand_client:
                continue
            logger.info("Running consolidation preview for user %s with model %s", user_id, cand_model)
            try:
                plan = safe_json_chat_completion(
                    client=cand_client,
                    model=cand_model,
                    prompt=prompt,
                    temperature=0.0,
                    seed=42,
                    max_tokens=4096,
                )
                if plan and isinstance(plan, dict) and any(k in plan for k in ("to_delete", "to_update", "to_add", "summary")):
                    used_model = cand_model
                    logger.info("Model %s successfully generated consolidation plan for user %s", cand_model, user_id)
                    break
                logger.warning("Model %s did not return valid consolidation schema, trying next candidate...", cand_model)
            except Exception as cand_e:
                logger.warning("Model %s failed with exception: %s, trying next candidate...", cand_model, cand_e)

        if not plan or not isinstance(plan, dict):
            return {
                "status": "error",
                "message": "模型未能返回有效的整理方案 JSON，请重试或在设置中更换模型",
                "plan": None,
            }

        # Helper to resolve M1 or [M1] back to real UUID
        def resolve_id(id_val: Any) -> Optional[str]:
            if id_val is None:
                return None
            s = str(id_val).strip()
            if not s:
                return None
            # Direct match against dictionary (M1, [M1], m1, 1, etc.)
            if s in short_to_real:
                return short_to_real[s]
            s_clean = s.strip("[]# ")
            if s_clean in short_to_real:
                return short_to_real[s_clean]
            if s_clean.lower() in short_to_real:
                return short_to_real[s_clean.lower()]
            # Extract numeric index if formatted like M1, m-1, 第1条, etc.
            import re
            m = re.search(r"(?:M|第)?\s*(\d+)", s, re.IGNORECASE)
            if m:
                num = str(int(m.group(1)))
                if f"M{num}" in short_to_real:
                    return short_to_real[f"M{num}"]
                if num in short_to_real:
                    return short_to_real[num]
            if s in real_to_short:
                return s
            return None

        # 1. Resolve to_add first so we know how many additions exist
        processed_to_add = []
        for item in plan.get("to_add", []):
            add_text = str(item.get("text") or "").strip()
            if add_text:
                imp = _safe_int(item.get("importance"), default=4)
                cat = _normalize_category(item.get("category"), importance=imp, text=add_text)
                processed_to_add.append({
                    "text": add_text,
                    "category": cat,
                    "importance": imp,
                    "reason": str(item.get("reason") or "新提炼事实").strip(),
                })

        # 2. Resolve to_update
        processed_to_update = []
        updated_uuids = set()
        for item in plan.get("to_update", []):
            real_id = resolve_id(item.get("id"))
            if real_id and real_id not in updated_uuids:
                new_text = str(item.get("text") or "").strip()
                if new_text and new_text != real_to_text.get(real_id):
                    updated_uuids.add(real_id)
                    old_meta = real_to_meta.get(real_id, {})
                    imp = _safe_int(item.get("importance") or old_meta.get("importance"), default=3)
                    cat = _normalize_category(
                        item.get("category") or old_meta.get("category") or old_meta.get("type"),
                        importance=imp,
                        text=new_text,
                    )
                    processed_to_update.append({
                        "id": real_id,
                        "text": new_text,
                        "old_text": real_to_text.get(real_id, ""),
                        "category": cat,
                        "importance": imp,
                        "reason": str(item.get("reason") or "状态更新或细节补充").strip(),
                    })

        # 3. Resolve and deduplicate to_delete with CODE-LEVEL SAFETY CLAMP
        processed_to_delete = []
        deleted_uuids = set()
        for item in plan.get("to_delete", []):
            real_id = resolve_id(item.get("id"))
            # Must not delete an item that is already being updated
            if real_id and real_id not in updated_uuids and real_id not in deleted_uuids:
                deleted_uuids.add(real_id)
                processed_to_delete.append({
                    "id": real_id,
                    "text": real_to_text.get(real_id, item.get("text", "")),
                    "reason": str(item.get("reason") or "已提炼合并至新条目").strip(),
                })

        # ── Code-Level Safety Net: Prevent Rogue LLM Mass Deletions ──
        # An automated consolidation should never indiscriminately purge memories.
        # Permitted deletions are strictly bounded by synthesized items and updates.
        max_safe_deletions = max(10, len(processed_to_add) * 4 + len(processed_to_update))
        if len(processed_to_delete) > max_safe_deletions:
            logger.warning(
                "LLM proposed excessive deletions (%d > %d allowed). Clamping deletions to protect user data.",
                len(processed_to_delete), max_safe_deletions
            )
            excess = processed_to_delete[max_safe_deletions:]
            processed_to_delete = processed_to_delete[:max_safe_deletions]
            for ex in excess:
                deleted_uuids.discard(ex["id"])

        # 4. Construct to_keep: All memories not in to_delete and not in to_update
        processed_to_keep = []
        for mid, short_tag in real_to_short.items():
            if mid not in deleted_uuids and mid not in updated_uuids:
                processed_to_keep.append({
                    "id": mid,
                    "text": real_to_text.get(mid, ""),
                    "reason": "保持不变",
                })

        has_changes = (
            len(processed_to_delete) > 0
            or len(processed_to_update) > 0
            or len(processed_to_add) > 0
        )

        status = "success" if has_changes else "already_optimal"
        summary = plan.get("summary", "")
        if not has_changes:
            summary = summary or "当前记忆库已高度精炼，无任何冲突、冗余或待合并项，状态最佳！"

        logger.info(
            "Consolidation preview for user %s: status=%s, del=%d, upd=%d, add=%d, keep=%d",
            user_id, status, len(processed_to_delete), len(processed_to_update), len(processed_to_add), len(processed_to_keep)
        )

        return {
            "status": status,
            "total_count": len(raw_memories),
            "summary": summary,
            "plan": {
                "to_delete": processed_to_delete,
                "to_update": processed_to_update,
                "to_add": processed_to_add,
                "to_keep": processed_to_keep,
            },
        }
    except Exception as e:
        logger.error("Failed to generate consolidation preview for user %s: %s", user_id, e, exc_info=True)
        return {
            "status": "error",
            "message": f"分析记忆库失败: {str(e)}",
            "plan": None,
        }


def apply_consolidation(
    user_id: str,
    approved_plan: Dict[str, Any],
    memory_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Apply the user-approved consolidation plan:
      1. Automatically creates a backup snapshot before touching any records.
      2. Deletes approved to_delete items (deduplicated).
      3. Updates approved to_update items.
      4. Adds approved to_add items.
    """
    if not approved_plan:
        raise ValueError("No plan provided to apply")

    # 1. First safety measure: save snapshot
    snapshot_ok = create_snapshot(user_id)
    if not snapshot_ok:
        logger.warning("Proceeding with consolidation without snapshot for user %s", user_id)

    to_delete = approved_plan.get("to_delete") or []
    to_update = approved_plan.get("to_update") or []
    to_add = approved_plan.get("to_add") or []

    deleted_count = 0
    updated_count = 0
    added_count = 0

    # 2. Delete outdated / conflicting records (with deduplication)
    seen_deleted = set()
    for item in to_delete:
        mid = str(item.get("id") or "").strip()
        if not mid or mid in seen_deleted:
            continue
        seen_deleted.add(mid)
        try:
            memory_service.delete_memory(user_id=user_id, memory_id=mid)
            deleted_count += 1
        except Exception as e:
            logger.warning("Failed to delete memory %s during consolidation: %s", mid, e)

    # 3. Update existing records
    now_iso = datetime.now(timezone.utc).isoformat()
    for item in to_update:
        mid = str(item.get("id") or "").strip()
        new_text = str(item.get("text") or "").strip()
        if not mid or not new_text:
            continue
        importance = _safe_int(item.get("importance"), default=3)
        category = _normalize_category(item.get("category"), importance=importance, text=new_text)
        meta = {
            "category": category,
            "type": "profile" if (importance >= 4 or category == "identity") else category,
            "importance": importance,
            "consolidated_at": now_iso,
        }
        try:
            memory_service.update_memory(
                user_id=user_id,
                memory_id=mid,
                data=new_text,
                metadata=meta,
            )
            updated_count += 1
        except Exception as e:
            logger.warning("Failed to update memory %s during consolidation: %s", mid, e)

    # 4. Add newly synthesized / merged facts
    for item in to_add:
        fact_text = str(item.get("text") or "").strip()
        if not fact_text:
            continue
        importance = _safe_int(item.get("importance"), default=4)
        category = _normalize_category(item.get("category"), importance=importance, text=fact_text)
        meta = {
            "source": "consolidation",
            "category": category,
            "type": "profile" if (importance >= 4 or category == "identity") else category,
            "importance": importance,
            "created_at": now_iso,
            "consolidated_at": now_iso,
        }
        try:
            memory_service.add_memory(
                user_id=user_id,
                data=fact_text,
                metadata=meta,
                memory_model=memory_model,
                infer=False,
            )
            added_count += 1
        except Exception as e:
            logger.warning("Failed to add consolidated memory for user %s: %s", user_id, e)

    logger.info(
        "Consolidation applied for user %s: deleted=%d, updated=%d, added=%d",
        user_id, deleted_count, updated_count, added_count,
    )

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "updated_count": updated_count,
        "added_count": added_count,
        "snapshot_created": snapshot_ok,
    }


def rollback_consolidation(user_id: str) -> Dict[str, Any]:
    """
    Restore the memory database from the latest saved snapshot.
    """
    path = _get_snapshot_path(user_id)
    if not os.path.isfile(path):
        raise ValueError("未找到可恢复的历史备份快照")

    with open(path, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    target_memories = snapshot.get("memories", [])
    if not target_memories:
        raise ValueError("快照中的记忆数据为空，放弃恢复")

    # 1. Delete all current memories
    current_memories = memory_service.list_all_memories(user_id)
    for m in current_memories:
        mid = str(m.get("id") or "")
        if mid:
            try:
                memory_service.delete_memory(user_id=user_id, memory_id=mid)
            except Exception:
                pass

    # 2. Re-insert snapshot memories
    restored_count = 0
    for m in target_memories:
        text = m.get("memory") or m.get("text") or m.get("data")
        if not text:
            continue
        meta = m.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        if "created_at" not in meta and m.get("created_at"):
            meta["created_at"] = m["created_at"]
        if "updated_at" not in meta and m.get("updated_at"):
            meta["updated_at"] = m["updated_at"]
        try:
            memory_service.add_memory(
                user_id=user_id,
                data=text,
                metadata=meta,
                infer=False,
            )
            restored_count += 1
        except Exception as e:
            logger.warning("Failed to restore memory during rollback: %s", e)

    # 3. Archive snapshot file instead of raw deletion to preserve history
    try:
        archive_path = path.replace(
            "_latest.json",
            f"_rolled_back_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
        )
        os.replace(path, archive_path)
    except Exception:
        try:
            os.remove(path)
        except Exception:
            pass

    logger.info("Rollback complete for user %s: restored %d memories", user_id, restored_count)
    return {
        "status": "success",
        "restored_count": restored_count,
    }
