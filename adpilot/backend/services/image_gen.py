import os
import httpx
from openai import AsyncOpenAI


class ImageGenService:
    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.api_key = _s.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")

    def _is_configured(self):
        return bool(self.api_key)

    async def generate(
        self,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "hd",
        style: str = "vivid",
        n: int = 1,
    ) -> list[dict]:
        if not self._is_configured():
            raise ValueError("OpenAI API key not configured")

        client = AsyncOpenAI(api_key=self.api_key)
        response = await client.images.generate(
            model="dall-e-3",
            prompt=self._enhance_prompt(prompt),
            size=size,
            quality=quality,
            style=style,
            n=n,
        )
        return [{"url": img.url, "revised_prompt": img.revised_prompt} for img in response.data]

    def _enhance_prompt(self, prompt: str) -> str:
        return (
            f"{prompt}. "
            "Professional advertising photography style. "
            "High quality, commercially appropriate, clean composition. "
            "No text overlays in the image."
        )

    def get_sizes(self) -> list[dict]:
        return [
            {"value": "1024x1024", "label": "Square (1:1) — Instagram Feed"},
            {"value": "1792x1024", "label": "Landscape (16:9) — Facebook/YouTube"},
            {"value": "1024x1792", "label": "Portrait (9:16) — Stories/Reels"},
        ]
