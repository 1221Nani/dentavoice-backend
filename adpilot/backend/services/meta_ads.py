import httpx
import os
from typing import Optional


class MetaAdsService:
    BASE_URL = "https://graph.facebook.com/v20.0"

    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.access_token = _s.get("META_ACCESS_TOKEN") or os.getenv("META_ACCESS_TOKEN")
        self.ad_account_id = _s.get("META_AD_ACCOUNT_ID") or os.getenv("META_AD_ACCOUNT_ID")

    def _is_configured(self):
        return bool(self.access_token and self.ad_account_id)

    def _headers(self):
        return {"Authorization": f"Bearer {self.access_token}"}

    async def get_campaigns(self):
        if not self._is_configured():
            return {"configured": False, "data": []}
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/act_{self.ad_account_id}/campaigns",
                params={
                    "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
                    "access_token": self.access_token,
                },
            )
            r.raise_for_status()
            return {"configured": True, "data": r.json().get("data", [])}

    async def create_campaign(self, name: str, objective: str, status: str, daily_budget: float):
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/act_{self.ad_account_id}/campaigns",
                params={"access_token": self.access_token},
                json={
                    "name": name,
                    "objective": objective,
                    "status": status.upper(),
                    "special_ad_categories": [],
                    "daily_budget": int(daily_budget * 100),  # cents
                },
            )
            r.raise_for_status()
            return r.json()

    async def update_campaign_status(self, platform_id: str, status: str):
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/{platform_id}",
                params={"access_token": self.access_token},
                json={"status": status.upper()},
            )
            r.raise_for_status()
            return r.json()

    async def get_insights(self, campaign_ids: list[str] = None, date_preset: str = "last_30d"):
        if not self._is_configured():
            return {"configured": False, "data": []}
        params = {
            "fields": "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values,date_start,date_stop",
            "date_preset": date_preset,
            "level": "campaign",
            "time_increment": 1,
            "access_token": self.access_token,
            "limit": 500,
        }
        if campaign_ids:
            params["filtering"] = f'[{{"field":"campaign.id","operator":"IN","value":{list(campaign_ids)}}}]'
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(
                f"{self.BASE_URL}/act_{self.ad_account_id}/insights",
                params=params,
            )
            if r.status_code != 200:
                try:
                    err = r.json().get("error", {}).get("message", r.text)
                except Exception:
                    err = r.text
                return {"configured": True, "data": [], "error": err}
            return {"configured": True, "data": r.json().get("data", [])}

    async def search_ad_library(self, query: str, country: str = "US", limit: int = 20):
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{self.BASE_URL}/ads_archive",
                params={
                    "search_terms": query,
                    "ad_reached_countries": country,
                    "fields": "id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,"
                              "ad_creative_link_titles,page_name,ad_snapshot_url,ad_delivery_start_time,"
                              "ad_delivery_stop_time,currency,spend",
                    "limit": limit,
                    "access_token": self.access_token or "PLACEHOLDER",
                },
            )
            if r.status_code == 200:
                return r.json().get("data", [])
            return []

    async def get_ad_account_info(self):
        if not self._is_configured():
            return None
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/act_{self.ad_account_id}",
                params={
                    "fields": "name,currency,timezone_name,account_status,balance,spend_cap",
                    "access_token": self.access_token,
                },
            )
            if r.status_code == 200:
                return r.json()
            return None
