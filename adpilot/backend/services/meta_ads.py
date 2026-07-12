import httpx
import os
from typing import Optional


class MetaAdsService:
    BASE_URL = "https://graph.facebook.com/v20.0"

    CTA_MAP = {
        "shop now": "SHOP_NOW", "buy now": "SHOP_NOW", "get yours": "SHOP_NOW", "order today": "SHOP_NOW",
        "claim offer": "SHOP_NOW", "book now": "BOOK_TRAVEL", "book a call": "CONTACT_US",
        "sign up free": "SIGN_UP", "sign up": "SIGN_UP", "request info": "CONTACT_US",
        "get started": "SIGN_UP", "get a free quote": "GET_QUOTE", "learn more": "LEARN_MORE",
        "discover more": "LEARN_MORE", "see how it works": "LEARN_MORE", "find out more": "LEARN_MORE",
        "explore": "LEARN_MORE", "visit now": "LEARN_MORE", "see more": "LEARN_MORE",
        "read more": "LEARN_MORE", "explore now": "LEARN_MORE", "click here": "LEARN_MORE",
    }

    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.access_token = _s.get("META_ACCESS_TOKEN") or os.getenv("META_ACCESS_TOKEN")
        self.ad_account_id = _s.get("META_AD_ACCOUNT_ID") or os.getenv("META_AD_ACCOUNT_ID")
        self.page_id = _s.get("META_PAGE_ID") or os.getenv("META_PAGE_ID")

    def _is_configured(self):
        return bool(self.access_token and self.ad_account_id)

    def _headers(self):
        return {"Authorization": f"Bearer {self.access_token}"}

    def _raise_detailed(self, r: httpx.Response):
        """Replaces bare r.raise_for_status(). httpx's default error message is just
        '400 Bad Request' — it discards Meta's actual error payload (error.message,
        error.error_user_msg), which is where the real reason lives."""
        if r.status_code < 400:
            return
        message = None
        try:
            err = r.json().get("error", {})
            message = err.get("error_user_msg") or err.get("message")
        except Exception:
            pass
        raise ValueError(message or f"Meta Ads API error (HTTP {r.status_code}): {r.text[:300]}")

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
            self._raise_detailed(r)
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
            self._raise_detailed(r)
            return r.json()

    def _cta_type(self, cta: str) -> str:
        return self.CTA_MAP.get((cta or "").strip().lower(), "LEARN_MORE")

    async def create_ad_set(self, campaign_id: str, name: str, audience: dict = None) -> str:
        """Creates an ad set with minimal, safe targeting. The campaign already carries
        the budget (Campaign Budget Optimization), so no budget is set here."""
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        audience = audience or {}
        targeting = {
            "geo_locations": {"countries": ["US"]},
            "age_min": int(audience.get("age_min") or 18),
            "age_max": int(audience.get("age_max") or 65),
        }
        genders = str(audience.get("genders") or "all").lower()
        if genders == "male":
            targeting["genders"] = [1]
        elif genders == "female":
            targeting["genders"] = [2]
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/act_{self.ad_account_id}/adsets",
                params={"access_token": self.access_token},
                json={
                    "name": name,
                    "campaign_id": campaign_id,
                    "status": "PAUSED",
                    "billing_event": "IMPRESSIONS",
                    "optimization_goal": "LINK_CLICKS",
                    "destination_type": "WEBSITE",
                    "targeting": targeting,
                },
            )
            self._raise_detailed(r)
            return r.json()["id"]

    async def create_ad_creative(self, name: str, link: str, message: str, headline: str, description: str, cta: str) -> str:
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        if not self.page_id:
            raise ValueError("No Facebook Page connected — add META_PAGE_ID in Settings before creating ads.")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/act_{self.ad_account_id}/adcreatives",
                params={"access_token": self.access_token},
                json={
                    "name": name,
                    "object_story_spec": {
                        "page_id": self.page_id,
                        "link_data": {
                            "message": message,
                            "link": link,
                            "name": headline,
                            "description": description,
                            "call_to_action": {"type": self._cta_type(cta), "value": {"link": link}},
                        },
                    },
                },
            )
            self._raise_detailed(r)
            return r.json()["id"]

    async def create_ad(self, name: str, adset_id: str, creative_id: str) -> str:
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/act_{self.ad_account_id}/ads",
                params={"access_token": self.access_token},
                json={
                    "name": name,
                    "adset_id": adset_id,
                    "creative": {"creative_id": creative_id},
                    "status": "PAUSED",
                },
            )
            self._raise_detailed(r)
            return r.json()["id"]

    async def launch_ads(self, campaign_id: str, campaign_name: str, landing_url: str, audience: dict, ad_copies: list[dict]) -> dict:
        """Creates one ad set and, for each ad_copy variant, one creative + ad under it.
        Everything is created PAUSED — nothing serves or spends until the user enables it.
        Each variant is created independently — if one is rejected (e.g. a policy
        violation on that specific creative), the others still get created instead of
        the whole batch failing together. Returns {"ad_ids": [...], "warnings": [...]}.
        Raises only if every single variant failed (nothing was created at all)."""
        if not ad_copies:
            raise ValueError("No ad copy available to create ads from")
        adset_id = await self.create_ad_set(campaign_id, f"{campaign_name} — Ad Set", audience)
        ad_ids = []
        warnings = []
        for i, copy in enumerate(ad_copies):
            try:
                creative_id = await self.create_ad_creative(
                    name=f"{campaign_name} — Creative {i + 1}",
                    link=landing_url,
                    message=copy.get("primary_text", ""),
                    headline=copy.get("headline", campaign_name)[:40],
                    description=copy.get("description", "")[:30],
                    cta=copy.get("cta", "Learn More"),
                )
                ad_id = await self.create_ad(f"{campaign_name} — Ad {i + 1}", adset_id, creative_id)
                ad_ids.append(ad_id)
            except Exception as e:
                warnings.append(f'Variant {i + 1} ("{copy.get("headline", "")}"): {str(e)}')
        if not ad_ids:
            raise ValueError("All ad variants were rejected — " + "; ".join(warnings))
        return {"ad_ids": ad_ids, "warnings": warnings}

    async def update_campaign_status(self, platform_id: str, status: str):
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/{platform_id}",
                params={"access_token": self.access_token},
                json={"status": status.upper()},
            )
            self._raise_detailed(r)
            return r.json()

    async def update_campaign_name(self, platform_id: str, name: str):
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/{platform_id}",
                params={"access_token": self.access_token},
                json={"name": name},
            )
            self._raise_detailed(r)
            return r.json()

    async def update_campaign_budget(self, platform_id: str, daily_budget: float):
        if not self._is_configured():
            raise ValueError("Meta Ads not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/{platform_id}",
                params={"access_token": self.access_token},
                json={"daily_budget": int(daily_budget * 100)},
            )
            self._raise_detailed(r)
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
