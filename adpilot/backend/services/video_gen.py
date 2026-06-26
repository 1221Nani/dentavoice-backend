import os
import httpx
import asyncio


class VideoGenService:
    """Runway Gen-3 Alpha video generation."""

    BASE_URL = "https://api.dev.runwayml.com/v1"

    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.api_key = _s.get("RUNWAY_API_KEY") or os.getenv("RUNWAY_API_KEY")

    def _is_configured(self):
        return bool(self.api_key)

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Runway-Version": "2024-11-06",
        }

    async def generate_from_text(
        self,
        prompt: str,
        duration: int = 5,
        ratio: str = "1280:720",
    ) -> dict:
        if not self._is_configured():
            raise ValueError("Runway API key not configured")

        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{self.BASE_URL}/text_to_video",
                headers=self._headers(),
                json={
                    "model": "gen3a_turbo",
                    "promptText": self._enhance_prompt(prompt),
                    "duration": duration,
                    "ratio": ratio,
                    "watermark": False,
                },
            )
            r.raise_for_status()
            task_id = r.json()["id"]
            return await self._poll_task(task_id)

    async def generate_from_image(
        self,
        image_url: str,
        prompt: str,
        duration: int = 5,
    ) -> dict:
        if not self._is_configured():
            raise ValueError("Runway API key not configured")

        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{self.BASE_URL}/image_to_video",
                headers=self._headers(),
                json={
                    "model": "gen3a_turbo",
                    "promptImage": image_url,
                    "promptText": prompt,
                    "duration": duration,
                    "ratio": "1280:720",
                    "watermark": False,
                },
            )
            r.raise_for_status()
            task_id = r.json()["id"]
            return await self._poll_task(task_id)

    async def _poll_task(self, task_id: str, max_wait: int = 120) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for _ in range(max_wait // 5):
                await asyncio.sleep(5)
                r = await client.get(
                    f"{self.BASE_URL}/tasks/{task_id}",
                    headers=self._headers(),
                )
                r.raise_for_status()
                data = r.json()
                if data["status"] == "SUCCEEDED":
                    return {"status": "succeeded", "url": data["output"][0], "task_id": task_id}
                elif data["status"] == "FAILED":
                    return {"status": "failed", "error": data.get("failure", "Unknown error"), "task_id": task_id}
        return {"status": "timeout", "task_id": task_id}

    def _enhance_prompt(self, prompt: str) -> str:
        return f"{prompt}. Cinematic quality, professional advertising video, smooth motion, high production value."

    def get_ratios(self) -> list[dict]:
        return [
            {"value": "1280:720", "label": "Landscape 16:9 — YouTube/Facebook"},
            {"value": "720:1280", "label": "Portrait 9:16 — Stories/Reels/TikTok"},
            {"value": "1:1", "label": "Square 1:1 — Instagram Feed"},
        ]
