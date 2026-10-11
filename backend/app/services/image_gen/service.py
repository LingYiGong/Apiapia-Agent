"""
Image Generation Service.
Supports:
1. OpenRouter (Flux.2 / Flux.3 / SD3.5 unified image endpoint)
2. OpenAI (DALL-E 3)
3. SiliconFlow (FLUX.1-schnell)

The image model catalog is persisted to synced_image_models.json and refreshed
only by an explicit sync request, mirroring how the chat model catalog is
handled in app/api/v1/models.py. No models are hardcoded and no request path
performs a live catalog lookup.
"""
import logging
from pathlib import Path
import httpx
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.catalog import read_json_catalog, write_json_catalog

logger = logging.getLogger("image_gen_service")

# Persistent synced image models file, sibling of synced_models.json
SYNCED_IMAGE_MODELS_FILE = Path(__file__).resolve().parent.parent.parent / "synced_image_models.json"


class ImageGenerationService:
    def __init__(self):
        self.openai_key = settings.OPENAI_API_KEY
        self.openai_base = settings.OPENAI_BASE_URL or "https://api.openai.com/v1"
        self.openrouter_key = settings.OPENROUTER_API_KEY
        self.openrouter_base = getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        self.siliconflow_key = getattr(settings, "SILICONFLOW_API_KEY", None)
        self.siliconflow_base = getattr(settings, "SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
        self.default_provider = getattr(settings, "IMAGE_GEN_PROVIDER", "auto")
        self.default_model = getattr(settings, "IMAGE_GEN_MODEL", "dall-e-3")
        self.free_models = [
            m.strip() for m in getattr(settings, "FREE_IMAGE_MODELS", "").split(",") if m.strip()
        ]

    def is_free_image_model(self, model_id: str) -> bool:
        """Zero-cost models are declared through FREE_IMAGE_MODELS, not discovered."""
        return model_id in self.free_models

    def default_image_model(self) -> Optional[str]:
        """
        The zero-cost model to use when the user has no explicit selection.

        Mirrors how a new account's chat model defaults to openrouter/free, so an
        unset image_model never means "whatever the admin happens to run" — it
        always means the free tier.
        """
        if not self.free_models:
            return None
        stored_ids = {m.get("id") for m in self.load_stored_models()}
        if stored_ids:
            for mid in self.free_models:
                if mid in stored_ids:
                    return mid
        # Before the first sync the catalog is empty; the configured default is
        # still the intended target, so the feature works on a fresh deployment.
        return self.free_models[0]

    def active_providers(self) -> set:
        """Providers that currently hold usable credentials."""
        active = set()
        if self.openrouter_key:
            active.add("openrouter")
        if self.openai_key:
            active.add("openai")
        if self.siliconflow_key:
            active.add("siliconflow")
        return active

    def load_stored_models(self) -> List[Dict[str, Any]]:
        """
        Read the persisted image catalog from synced_image_models.json.
        Mirrors load_stored_models() for chat models: nothing is hardcoded, and an
        absent or corrupt file simply yields an empty catalog.
        """
        return read_json_catalog(SYNCED_IMAGE_MODELS_FILE)

    def save_stored_models(self, models: List[Dict[str, Any]]) -> None:
        """Write the image catalog to JSON."""
        write_json_catalog(SYNCED_IMAGE_MODELS_FILE, models)

    async def fetch_models_from_providers(self) -> List[Dict[str, Any]]:
        """
        Live query every configured image provider. Only invoked by an explicit
        sync request; the result is what gets persisted to disk.
        """
        fetched: List[Dict[str, Any]] = []

        if self.openrouter_key:
            try:
                url = f"{self.openrouter_base}/images/models"
                headers = {"Authorization": f"Bearer {self.openrouter_key}"}
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        raw = data.get("data", []) or data.get("models", [])
                        for item in raw:
                            if isinstance(item, dict):
                                mid = item.get("id")
                                name = item.get("name") or mid
                                desc = str(item.get("description") or "")[:120]
                            else:
                                mid = str(item)
                                name = mid
                                desc = ""
                            if not mid:
                                continue
                            fetched.append({
                                "id": mid,
                                "name": name,
                                "provider": "openrouter",
                                "description": desc,
                                "is_free": self.is_free_image_model(mid),
                            })
                    else:
                        logger.warning(
                            "OpenRouter image catalog returned %s: %s", res.status_code, res.text
                        )
            except Exception as e:
                logger.error(f"Failed to fetch OpenRouter image catalog: {e}")

        if self.openai_key:
            fetched.append({
                "id": "dall-e-3",
                "name": "DALL·E 3 (OpenAI)",
                "provider": "openai",
                "description": "OpenAI 官方高质量绘图模型",
                "is_free": False,
            })

        if self.siliconflow_key:
            fetched.append({
                "id": "black-forest-labs/FLUX.1-schnell",
                "name": "FLUX.1-schnell (SiliconFlow)",
                "provider": "siliconflow",
                "description": "SiliconFlow 开源生图模型，速度快",
                "is_free": False,
            })

        return fetched

    async def list_available_models(self) -> List[Dict[str, Any]]:
        """
        Persisted image catalog, narrowed to providers that still hold
        credentials so it doubles as a capability check for a user selection.

        Returns an empty list until a sync has been performed, which is the same
        contract as the chat model catalog.
        """
        stored = self.load_stored_models()
        active = self.active_providers()
        return [m for m in stored if m.get("provider") in active]

    async def sync_models(self) -> Dict[str, Any]:
        """
        Refresh the persisted catalog from the configured providers, merging into
        whatever is already on disk so a temporary outage cannot wipe the list.
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

        # Recompute the free flag so adding a model to FREE_IMAGE_MODELS takes
        # effect on the next sync without needing a file hand-edit.
        for mid, m in merged.items():
            m["is_free"] = self.is_free_image_model(mid)

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
                f"同步成功！从提供商新增发现了 {len(new_models)} 个绘图模型"
                if new_models
                else "同步完成，当前已是最新模型，未发现新模型"
            ),
        }

    def get_effective_provider(self, free_only: bool = False) -> str:
        """
        Determines which provider to use based on configuration.

        When free_only is set, only OpenRouter is considered, because the
        zero-cost models are routed through it. DALL-E 3 and SiliconFlow Flux
        are always billable and must never be reached by restricted accounts.
        """
        if free_only:
            return "openrouter" if self.openrouter_key else "none"

        if self.default_provider == "openrouter" and self.openrouter_key:
            return "openrouter"
        if self.default_provider == "siliconflow" and self.siliconflow_key:
            return "siliconflow"
        if self.default_provider == "openai" and self.openai_key:
            return "openai"

        # Auto detection priority:
        if self.openrouter_key:
            return "openrouter"
        if self.siliconflow_key:
            return "siliconflow"
        if self.openai_key:
            return "openai"
        return "none"

    async def generate(
        self,
        prompt: str,
        size: str = "1024x1024",
        model: Optional[str] = None,
        free_only: bool = False
    ) -> Dict[str, Any]:
        """
        Generate image from prompt.

        Args:
            model: explicit model id chosen by the user. When given, the provider
                is resolved from the catalog entry instead of the global
                IMAGE_GEN_PROVIDER setting. When omitted, the zero-cost default
                is used, so generation never depends on a paid model unless the
                user explicitly picked one.
            free_only: restrict generation to the configured zero-cost model
                whitelist. No paid model is called and no paid fallback retry
                happens on failure.

        Returns:
            {
                "url": str,
                "prompt": str,
                "revised_prompt": Optional[str],
                "model": str,
                "provider": str
            }
        """
        resolved_model = model or self.default_image_model()
        provider = None

        if resolved_model:
            catalog = await self.list_available_models()
            entry = next((m for m in catalog if m["id"] == resolved_model), None)
            if entry is not None:
                if free_only and not entry.get("is_free"):
                    raise ValueError(
                        f"当前账号处于体验模式，仅可使用免费绘图模型；「{entry.get('name') or resolved_model}」为计费模型。"
                    )
                provider = entry["provider"]
            elif model:
                # An explicit selection is missing from the synced catalog.
                # Distinguish "never synced" from "synced but unavailable", because
                # the fix is different: sync once versus pick another model.
                if not self.load_stored_models():
                    raise ValueError(
                        "绘图模型列表尚未同步。请管理员在设置页点击「同步列表」"
                        "完成一次同步后再使用绘图功能。"
                    )
                raise ValueError(
                    f"所选绘图模型当前不可用（对应服务未配置或模型已下架）：{model}"
                )
            else:
                # Zero-cost default that has not been synced yet. Free models are
                # declared as OpenRouter ids, so that is the only route to try.
                provider = (
                    "openrouter" if self.openrouter_key
                    else self.get_effective_provider(free_only=free_only)
                )

        if provider is None:
            provider = self.get_effective_provider(free_only=free_only)

        if provider == "none":
            if free_only:
                raise ValueError(
                    "免费生图暂不可用：当前账号处于体验模式，仅支持零成本绘图模型，"
                    "而服务端未配置 OPENROUTER_API_KEY。"
                    "你依然可以用「用 SVG 画一个 ...」让模型直接生成矢量画作。"
                )
            raise ValueError(
                "未配置生图 API Key。请在 .env 或设置中配置 OPENROUTER_API_KEY、"
                "OPENAI_API_KEY (使用 DALL·E 3) 或 SILICONFLOW_API_KEY (使用 Flux.1)。"
            )

        if provider == "openrouter":
            return await self._generate_openrouter(prompt, size, resolved_model, free_only=free_only)
        elif provider == "siliconflow":
            return await self._generate_siliconflow(prompt, size, resolved_model)
        else:
            return await self._generate_openai(prompt, size, resolved_model)

    async def _resolve_openrouter_model(
        self,
        requested_model: Optional[str] = None,
        free_only: bool = False
    ) -> str:
        if requested_model:
            return requested_model

        # No explicit selection was resolved upstream, so fall back to the free
        # default rather than whatever the admin happens to run.
        fallback = self.default_image_model()
        if fallback:
            return fallback
        if free_only:
            raise ValueError(
                "未配置免费生图模型列表 (FREE_IMAGE_MODELS)，无法为体验模式账号提供绘图能力。"
            )

        # Only reachable when FREE_IMAGE_MODELS is empty, which means the admin
        # has opted out of the free tier entirely.
        if self.default_model and self.default_provider == "openrouter":
            return self.default_model
        return "black-forest-labs/flux.2-pro"

    async def _generate_openrouter(
        self,
        prompt: str,
        size: str = "1024x1024",
        model: Optional[str] = None,
        free_only: bool = False
    ) -> Dict[str, Any]:
        model_name = await self._resolve_openrouter_model(model, free_only=free_only)
        url = f"{self.openrouter_base}/images"
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Apiapia Assistant",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "prompt": prompt
        }

        logger.info("Calling OpenRouter Image Gen: model=%s, free_only=%s, prompt='%s'", model_name, free_only, prompt)

        async with httpx.AsyncClient(timeout=90.0) as http_client:
            resp = await http_client.post(url, headers=headers, json=payload)
            if resp.status_code != 200 and not free_only:
                # If dynamic model or default model failed, try known fallback candidates
                fallback_candidates = [
                    "black-forest-labs/flux.2-pro",
                    "black-forest-labs/flux.2-flex",
                    "black-forest-labs/flux-1-dev",
                    "stabilityai/stable-diffusion-3.5-large",
                    "google/imagen-3"
                ]
                last_err = resp.text
                for fb_model in fallback_candidates:
                    if fb_model == model_name:
                        continue
                    payload["model"] = fb_model
                    logger.info("Retrying OpenRouter Image Gen with fallback model: %s", fb_model)
                    resp = await http_client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        model_name = fb_model
                        break
                    last_err = resp.text

            if resp.status_code != 200:
                if free_only:
                    # Deliberately no fallback retry: every remaining candidate is
                    # billable, which a restricted account must never trigger.
                    raise RuntimeError(
                        f"免费生图模型不可用 [{resp.status_code}]: {resp.text}"
                    )
                raise RuntimeError(f"OpenRouter 生图接口调用失败 [{resp.status_code}]: {last_err}")

            data = resp.json()

        items = data.get("data", []) or data.get("images", [])
        if not items:
            raise RuntimeError(f"OpenRouter 未返回有效图片数据: {data}")

        first = items[0]
        img_url = first.get("url")
        if not img_url and first.get("b64_json"):
            media_type = first.get("media_type") or "image/png"
            img_url = f"data:{media_type};base64,{first['b64_json']}"
        if not img_url:
            raise RuntimeError(f"OpenRouter 返回的图片数据缺少可用 url: {first}")

        return {
            "url": img_url,
            "prompt": prompt,
            "revised_prompt": None,
            "model": model_name,
            "provider": "OpenRouter · 免费档" if free_only else "OpenRouter"
        }

    async def _generate_openai(
        self,
        prompt: str,
        size: str = "1024x1024",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        model_name = model or self.default_model or "dall-e-3"
        # Validate size for DALL-E 3 (only 1024x1024, 1024x1792, 1792x1024)
        if model_name == "dall-e-3":
            if size not in ["1024x1024", "1024x1792", "1792x1024"]:
                size = "1024x1024"

        client = AsyncOpenAI(api_key=self.openai_key, base_url=self.openai_base)
        logger.info("Calling OpenAI DALL-E: model=%s, size=%s, prompt='%s'", model_name, size, prompt)

        response = await client.images.generate(
            model=model_name,
            prompt=prompt,
            size=size,
            quality="standard",
            n=1
        )

        img_data = response.data[0]
        return {
            "url": img_data.url,
            "prompt": prompt,
            "revised_prompt": getattr(img_data, "revised_prompt", None),
            "model": model_name,
            "provider": "OpenAI (DALL·E 3)"
        }

    async def _generate_siliconflow(
        self,
        prompt: str,
        size: str = "1024x1024",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        model_name = model or "black-forest-labs/FLUX.1-schnell"
        # Flux supports sizes like 1024x1024, 768x1024, 1024x768
        flux_size = size
        if size == "1792x1024":
            flux_size = "1024x768"
        elif size == "1024x1792":
            flux_size = "768x1024"

        url = f"{self.siliconflow_base}/images/generations"
        headers = {
            "Authorization": f"Bearer {self.siliconflow_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "prompt": prompt,
            "image_size": flux_size,
            "num_inference_steps": 20
        }

        logger.info("Calling SiliconFlow Flux: model=%s, size=%s, prompt='%s'", model_name, flux_size, prompt)

        async with httpx.AsyncClient(timeout=90.0) as http_client:
            resp = await http_client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"SiliconFlow 生图接口调用失败 [{resp.status_code}]: {resp.text}")
            data = resp.json()

        images = data.get("images", [])
        if not images:
            raise RuntimeError(f"SiliconFlow 未返回有效图片数据: {data}")

        img_url = images[0].get("url")
        return {
            "url": img_url,
            "prompt": prompt,
            "revised_prompt": None,
            "model": model_name,
            "provider": "SiliconFlow (FLUX.1)"
        }


image_gen_service = ImageGenerationService()
