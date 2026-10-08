import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("video_gen_service")

# Persistent synced video models file, sibling of synced_image_models.json
SYNCED_VIDEO_MODELS_FILE = Path(__file__).resolve().parent.parent.parent / "synced_video_models.json"


class VideoGenerationService:
    def __init__(self):
        self.openrouter_key = settings.OPENROUTER_API_KEY
        self.openrouter_base = getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        self.default_provider = getattr(settings, "VIDEO_GEN_PROVIDER", "auto")
        self.default_model = getattr(settings, "VIDEO_GEN_MODEL", "")
        self.free_models = [
            m.strip() for m in getattr(settings, "FREE_VIDEO_MODELS", "").split(",") if m.strip()
        ]

    def is_free_video_model(self, model_id: str) -> bool:
        """Zero-cost models are declared through FREE_VIDEO_MODELS, or contain free indicators."""
        if model_id in self.free_models:
            return True
        mid = (model_id or "").lower()
        return ":free" in mid or "/free" in mid

    def default_video_model(self) -> Optional[str]:
        """
        The default video model. If free models are declared, prefer the first available one;
        otherwise fallback to the configured default or the first synced model.
        """
        stored = self.load_stored_models()
        stored_ids = {m.get("id") for m in stored}

        # 1. Prefer matching free models
        if self.free_models:
            for mid in self.free_models:
                if mid in stored_ids:
                    return mid
            return self.free_models[0]

        # 2. Check explicitly configured VIDEO_GEN_MODEL
        if self.default_model:
            return self.default_model

        # 3. Fallback to first synced model if present
        if stored:
            return stored[0].get("id")

        return None

    def active_providers(self) -> set:
        """Providers that currently hold usable credentials for video generation."""
        active = set()
        if self.openrouter_key:
            active.add("openrouter")
        return active

    def load_stored_models(self) -> List[Dict[str, Any]]:
        """
        Read the persisted video catalog from synced_video_models.json.
        """
        if not SYNCED_VIDEO_MODELS_FILE.exists():
            return []
        try:
            with open(SYNCED_VIDEO_MODELS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.error(f"Error reading synced_video_models.json: {e}")
        return []

    def save_stored_models(self, models: List[Dict[str, Any]]) -> None:
        """Write the video catalog to JSON."""
        try:
            SYNCED_VIDEO_MODELS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(SYNCED_VIDEO_MODELS_FILE, "w", encoding="utf-8") as f:
                json.dump(models, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error writing synced_video_models.json: {e}")

    async def fetch_models_from_providers(self) -> List[Dict[str, Any]]:
        """
        Live query configured video providers.
        OpenRouter video endpoint: GET https://openrouter.ai/api/v1/videos/models
        """
        fetched: List[Dict[str, Any]] = []

        if self.openrouter_key:
            try:
                url = f"{self.openrouter_base}/videos/models"
                headers = {"Authorization": f"Bearer {self.openrouter_key}"}
                async with httpx.AsyncClient(timeout=20.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        raw = data.get("data", []) or data.get("models", [])
                        for item in raw:
                            if isinstance(item, dict):
                                mid = item.get("id")
                                name = item.get("name") or mid
                                desc = str(item.get("description") or "")[:120]
                                is_free = self.is_free_video_model(mid)
                                pricing = item.get("pricing")
                                if isinstance(pricing, dict):
                                    if pricing.get("prompt") in (0, "0", 0.0) and pricing.get("completion") in (0, "0", 0.0):
                                        is_free = True
                                supported_durations = item.get("supported_durations")
                                supported_aspect_ratios = item.get("supported_aspect_ratios")
                                supported_resolutions = item.get("supported_resolutions")
                            else:
                                mid = str(item)
                                name = mid
                                desc = ""
                                is_free = self.is_free_video_model(mid)
                                supported_durations = None
                                supported_aspect_ratios = None
                                supported_resolutions = None

                            if not mid:
                                continue

                            fetched.append({
                                "id": mid,
                                "name": name,
                                "provider": "openrouter",
                                "description": desc,
                                "is_free": is_free,
                                "supported_durations": supported_durations,
                                "supported_aspect_ratios": supported_aspect_ratios,
                                "supported_resolutions": supported_resolutions,
                            })
                    else:
                        logger.warning(
                            "OpenRouter video catalog returned %s: %s", res.status_code, res.text
                        )
            except Exception as e:
                logger.error(f"Failed to fetch OpenRouter video catalog: {e}")

        return fetched

    async def list_available_models(self) -> List[Dict[str, Any]]:
        """
        Persisted video catalog, narrowed to providers that still hold credentials.
        """
        stored = self.load_stored_models()
        active = self.active_providers()
        return [m for m in stored if m.get("provider") in active]

    async def sync_models(self) -> Dict[str, Any]:
        """
        Refresh the persisted video catalog from configured providers.
        """
        current = self.load_stored_models()
        known_ids = {m["id"] for m in current}
        fetched = await self.fetch_models_from_providers()

        new_models: List[Dict[str, Any]] = []
        merged: Dict[str, Dict[str, Any]] = {m["id"]: m for m in current}
        for m in fetched:
            mid = m["id"]
            if mid not in known_ids:
                new_models.append(m)
                known_ids.add(mid)
            merged[mid] = m

        for mid, m in merged.items():
            if self.is_free_video_model(mid):
                m["is_free"] = True

        merged_list = list(merged.values())
        merged_list.sort(key=lambda m: (0 if m.get("is_free") else 1, m["id"]))
        self.save_stored_models(merged_list)

        providers = sorted(self.active_providers())
        return {
            "success": True,
            "new_count": len(new_models),
            "new_models": new_models,
            "total": len(merged_list),
            "synced_providers": providers,
            "message": (
                f"同步成功！从提供商新增发现了 {len(new_models)} 个视频生成模型"
                if new_models
                else "同步完成，当前已是最新模型，未发现新模型"
            ),
        }

    async def generate_video(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: str = "16:9",
        duration: int = 5,
        free_only: bool = False,
        poll_interval: float = 3.0,
        max_wait_seconds: float = 300.0,
    ) -> Dict[str, Any]:
        """
        Full workflow: Submit job -> Poll until completed -> Download video bytes -> Return result dict.
        """
        if not self.openrouter_key:
            raise RuntimeError("未配置 OPENROUTER_API_KEY，无法调用视频生成服务")

        target_model = model or self.default_video_model()
        if not target_model:
            raise RuntimeError("未配置或未选择视频生成模型，请在「设置」中选择视频模型并确保已完成列表同步")

        if free_only and not self.is_free_video_model(target_model):
            raise RuntimeError(f"体验模式账号仅可使用免费视频模型，模型「{target_model}」为计费模型")

        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "Content-Type": "application/json",
        }

        # 1. Resolve model-supported parameters from synced metadata if available
        matched_meta = None
        stored_models = self.load_stored_models()
        for sm in stored_models:
            if sm.get("id") == target_model:
                matched_meta = sm
                break

        final_duration = duration
        final_aspect_ratio = aspect_ratio

        if matched_meta:
            sup_durations = matched_meta.get("supported_durations")
            if sup_durations and isinstance(sup_durations, list) and len(sup_durations) > 0:
                if final_duration not in sup_durations:
                    final_duration = sup_durations[0]

            sup_ratios = matched_meta.get("supported_aspect_ratios")
            if sup_ratios and isinstance(sup_ratios, list) and len(sup_ratios) > 0:
                if final_aspect_ratio not in sup_ratios:
                    final_aspect_ratio = sup_ratios[0]

        submit_url = f"{self.openrouter_base}/videos"
        payload = {
            "model": target_model,
            "prompt": prompt,
            "aspect_ratio": final_aspect_ratio,
            "duration": final_duration,
        }

        logger.info(
            "Submitting video generation to OpenRouter: model=%s, prompt='%s', aspect_ratio=%s, duration=%s",
            target_model, prompt, final_aspect_ratio, final_duration
        )
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(submit_url, headers=headers, json=payload)
            if res.status_code not in (200, 201, 202):
                raise RuntimeError(f"OpenRouter 视频任务提交失败 ({res.status_code}): {res.text}")
            res_data = res.json()

        job_id = res_data.get("id") or res_data.get("job_id")
        if not job_id:
            raise RuntimeError(f"未获取到视频任务 ID: {res_data}")

        # 2. Poll until completed
        import asyncio
        import time

        poll_url = f"{self.openrouter_base}/videos/{job_id}"
        start_time = time.time()
        final_status = "pending"

        while time.time() - start_time < max_wait_seconds:
            await asyncio.sleep(poll_interval)
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    poll_res = await client.get(poll_url, headers=headers)
                    if poll_res.status_code == 200:
                        job_info = poll_res.json()
                        final_status = job_info.get("status", "").lower()
                        if final_status == "completed":
                            break
                        elif final_status in ("failed", "cancelled", "expired"):
                            logger.warning("Video job %s failed with payload: %s", job_id, job_info)
                            raw_err = job_info.get("error") or job_info.get("message")
                            if isinstance(raw_err, dict):
                                err_msg = raw_err.get("message") or raw_err.get("detail") or str(raw_err)
                            else:
                                err_msg = raw_err or f"任务状态为 {final_status}"
                            raise RuntimeError(f"视频生成失败: {err_msg}")
                    else:
                        logger.warning("Polling video job %s returned %s: %s", job_id, poll_res.status_code, poll_res.text)
                except httpx.RequestError as net_err:
                    logger.warning("Network issue while polling video job %s: %s", job_id, net_err)

        if final_status != "completed":
            raise RuntimeError(f"视频生成超时（已等待 {int(max_wait_seconds)} 秒）")

        # 3. Download generated content
        content_url = f"{self.openrouter_base}/videos/{job_id}/content"
        logger.info("Downloading completed video content for job %s...", job_id)
        async with httpx.AsyncClient(timeout=120.0) as client:
            content_res = await client.get(content_url, headers=headers)
            if content_res.status_code != 200:
                raise RuntimeError(f"下载视频文件失败 ({content_res.status_code}): {content_res.text}")
            video_bytes = content_res.content

        return {
            "job_id": job_id,
            "bytes": video_bytes,
            "provider": "openrouter",
            "model": target_model,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "ext": "mp4",
        }


video_gen_service = VideoGenerationService()
