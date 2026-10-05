"""
Image Generation Service.
Supports:
1. OpenRouter (Flux.2 / Flux.3 / SD3.5 unified image endpoint with dynamic discovery)
2. OpenAI (DALL-E 3 / DALL-E 2)
3. SiliconFlow (FLUX.1-schnell / FLUX.1-dev / SD3.5)
"""
import logging
import httpx
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("image_gen_service")


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

    def get_effective_provider(self) -> str:
        """Determines which provider to use based on configuration."""
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
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate image from prompt.
        Returns:
            {
                "url": str,
                "prompt": str,
                "revised_prompt": Optional[str],
                "model": str,
                "provider": str
            }
        """
        provider = self.get_effective_provider()

        if provider == "none":
            raise ValueError(
                "未配置生图 API Key。请在 .env 或设置中配置 OPENROUTER_API_KEY、"
                "OPENAI_API_KEY (使用 DALL·E 3) 或 SILICONFLOW_API_KEY (使用 Flux.1)。"
            )

        if provider == "openrouter":
            return await self._generate_openrouter(prompt, size, model)
        elif provider == "siliconflow":
            return await self._generate_siliconflow(prompt, size, model)
        else:
            return await self._generate_openai(prompt, size, model)

    async def _resolve_openrouter_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model:
            return requested_model

        # Try querying OpenRouter image models endpoint dynamically
        try:
            url = f"{self.openrouter_base}/images/models"
            headers = {"Authorization": f"Bearer {self.openrouter_key}"}
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    models = data.get("data", []) or data.get("models", [])
                    if isinstance(models, list) and models:
                        # Prefer any flux models
                        for m in models:
                            mid = m.get("id") if isinstance(m, dict) else str(m)
                            if "flux" in mid.lower():
                                logger.info("Auto-discovered OpenRouter image model: %s", mid)
                                return mid
                        first_id = models[0].get("id") if isinstance(models[0], dict) else str(models[0])
                        if first_id:
                            logger.info("Using first available OpenRouter image model: %s", first_id)
                            return first_id
        except Exception as e:
            logger.warning("Failed to discover OpenRouter image models dynamically: %s", e)

        # Fallback to standard OpenRouter model ID
        return "black-forest-labs/flux.2-pro"

    async def _generate_openrouter(
        self,
        prompt: str,
        size: str = "1024x1024",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        model_name = await self._resolve_openrouter_model(model)
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

        logger.info("Calling OpenRouter Image Gen: model=%s, prompt='%s'", model_name, prompt)

        async with httpx.AsyncClient(timeout=90.0) as http_client:
            resp = await http_client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
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

        return {
            "url": img_url,
            "prompt": prompt,
            "revised_prompt": None,
            "model": model_name,
            "provider": "OpenRouter"
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
