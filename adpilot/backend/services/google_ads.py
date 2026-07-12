import os
import httpx
from datetime import datetime
from typing import Optional


class GoogleAdsService:
    """Google Ads API v17 via REST."""

    API_VERSION = "v21"
    BASE_URL = f"https://googleads.googleapis.com/{API_VERSION}"

    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.developer_token = _s.get("GOOGLE_ADS_DEVELOPER_TOKEN") or os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN")
        self.client_id = _s.get("GOOGLE_ADS_CLIENT_ID") or os.getenv("GOOGLE_ADS_CLIENT_ID")
        self.client_secret = _s.get("GOOGLE_ADS_CLIENT_SECRET") or os.getenv("GOOGLE_ADS_CLIENT_SECRET")
        self.refresh_token = _s.get("GOOGLE_ADS_REFRESH_TOKEN") or os.getenv("GOOGLE_ADS_REFRESH_TOKEN")
        self.customer_id = _s.get("GOOGLE_ADS_CUSTOMER_ID") or os.getenv("GOOGLE_ADS_CUSTOMER_ID")
        # MCC login account (parent manager account ID) — optional, only needed for MCC setups
        self.login_customer_id = _s.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
        self._access_token: Optional[str] = None

    def _is_configured(self):
        return all([
            self.developer_token,
            self.client_id,
            self.client_secret,
            self.refresh_token,
            self.customer_id,
        ])

    def _has_mcc_credentials(self):
        return all([self.developer_token, self.client_id, self.client_secret, self.refresh_token])

    async def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": self.refresh_token,
                },
            )
            r.raise_for_status()
            self._access_token = r.json()["access_token"]
            return self._access_token

    async def _headers(self):
        token = await self._get_access_token()
        h = {
            "Authorization": f"Bearer {token}",
            "developer-token": self.developer_token,
        }
        # login-customer-id must be the MCC when querying sub-accounts
        login_id = self.login_customer_id or self.customer_id
        if login_id:
            h["login-customer-id"] = login_id
        return h

    def _raise_detailed(self, r: httpx.Response):
        """Replaces bare r.raise_for_status() for mutate calls. httpx's default error
        message is just '400 Bad Request' — it discards Google's actual error payload,
        which is where the real reason (e.g. a specific required-field violation) lives."""
        if r.status_code < 400:
            return
        message = None
        try:
            body = r.json()
            err = body.get("error", {})
            parts = [err.get("message", "")]
            for d in err.get("details", []):
                for e in d.get("errors", []):
                    m = e.get("message")
                    field_path = ".".join(
                        el.get("fieldName", "")
                        for el in e.get("location", {}).get("fieldPathElements", [])
                    )
                    code = e.get("errorCode", {})
                    code_str = ", ".join(f"{k}={v}" for k, v in code.items()) if code else ""
                    if m:
                        tag = " [" + " ".join(x for x in (field_path, code_str) if x) + "]" if (field_path or code_str) else ""
                        parts.append(m + tag)
            message = " — ".join(p for p in parts if p)
        except Exception:
            pass
        raise ValueError(message or f"Google Ads API error (HTTP {r.status_code}): {r.text[:300]}")

    async def list_accessible_customers(self) -> dict:
        """List all Google Ads accounts accessible to these credentials (MCC sub-accounts)."""
        if not self._has_mcc_credentials():
            return {"accounts": [], "error": "Google Ads credentials not configured"}
        mcc_id = self.login_customer_id or self.customer_id
        if not mcc_id:
            return {"accounts": [], "error": "No MCC or customer ID provided"}

        try:
            headers = await self._headers()
        except Exception as e:
            return {"accounts": [], "error": f"Token error: {str(e)}. Regenerate your refresh token."}
        query = """
            SELECT customer_client.id, customer_client.descriptive_name,
                   customer_client.status, customer_client.currency_code,
                   customer_client.time_zone
            FROM customer_client
            WHERE customer_client.level = 1
              AND customer_client.status != 'CANCELED'
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{mcc_id}/googleAds:searchStream",
                headers=headers,
                json={"query": query},
            )
            if r.status_code != 200:
                try:
                    err_body = r.json()
                    err = err_body.get("error", {}).get("message") or str(err_body)
                except Exception:
                    err = f"Google Ads API error (HTTP {r.status_code}). Check credentials in Settings."
                return {"accounts": [], "error": err}
            accounts = []
            for batch in r.json():
                for row in batch.get("results", []):
                    cc = row.get("customerClient", {})
                    accounts.append({
                        "id": str(cc.get("id", "")),
                        "name": cc.get("descriptiveName", ""),
                        "status": cc.get("status", ""),
                        "currency": cc.get("currencyCode", ""),
                        "timezone": cc.get("timeZone", ""),
                    })
            return {"accounts": accounts}

    async def get_campaigns(self):
        if not self._is_configured():
            return {"configured": False, "data": []}
        try:
            headers = await self._headers()
        except Exception as e:
            return {"configured": True, "data": [], "error": f"Token error: {str(e)}"}
        query = """
            SELECT campaign.id, campaign.name, campaign.status,
                   campaign.advertising_channel_type, campaign_budget.amount_micros
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            ORDER BY campaign.name
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/googleAds:searchStream",
                headers=headers,
                json={"query": query},
            )
            if r.status_code != 200:
                try:
                    err_body = r.json()
                    err_msg = err_body.get("error", {}).get("message") or str(err_body)
                except Exception:
                    err_msg = f"Google Ads API error (HTTP {r.status_code}). Check your credentials and customer ID in Settings."
                return {"configured": True, "data": [], "error": err_msg}
            results = []
            for batch in r.json():
                for row in batch.get("results", []):
                    results.append(row)
            return {"configured": True, "data": results}

    async def create_campaign(self, name: str, budget_micros: int, channel_type: str = "SEARCH"):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        headers = await self._headers()
        # Google rejects a campaignBudget create with a name that already exists on the
        # account. A plain "{name} Budget" collides on retry (e.g. after a prior partial
        # failure left an orphaned budget) or if two campaigns share a name — append a
        # timestamp so it's always unique.
        unique_budget_name = f"{name} Budget {datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        async with httpx.AsyncClient() as client:
            budget_r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaignBudgets:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "create": {
                            "name": unique_budget_name,
                            "amountMicros": budget_micros,
                            "deliveryMethod": "STANDARD",
                        }
                    }]
                },
            )
            self._raise_detailed(budget_r)
            budget_resource = budget_r.json()["results"][0]["resourceName"]

            create_op = {
                "name": name,
                "advertisingChannelType": channel_type,
                "status": "PAUSED",
                "campaignBudget": budget_resource,
                "manualCpc": {},
            }
            if channel_type == "SEARCH":
                # Required in practice for SEARCH campaigns created via the raw REST
                # API — without it, creation can fail validation for not targeting
                # any network.
                create_op["networkSettings"] = {
                    "targetGoogleSearch": True,
                    "targetSearchNetwork": True,
                    "targetContentNetwork": False,
                    "targetPartnerSearchNetwork": False,
                }

            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaigns:mutate",
                headers=headers,
                json={"operations": [{"create": create_op}]},
            )
            self._raise_detailed(r)
            return r.json()

    async def create_ad_group(self, campaign_resource: str, name: str, cpc_bid_micros: int) -> str:
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/adGroups:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "create": {
                            "name": name,
                            "campaign": campaign_resource,
                            "status": "PAUSED",
                            "type": "SEARCH_STANDARD",
                            "cpcBidMicros": cpc_bid_micros,
                        }
                    }]
                },
            )
            self._raise_detailed(r)
            return r.json()["results"][0]["resourceName"]

    async def create_ad_group_keywords(self, ad_group_resource: str, keywords: list[dict]):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        if not keywords:
            return
        headers = await self._headers()
        match_type_map = {"exact": "EXACT", "phrase": "PHRASE", "broad": "BROAD"}
        operations = [
            {
                "create": {
                    "adGroup": ad_group_resource,
                    "status": "ENABLED",
                    "keyword": {
                        "text": kw.get("keyword", ""),
                        "matchType": match_type_map.get(str(kw.get("match_type", "broad")).lower(), "BROAD"),
                    },
                }
            }
            for kw in keywords if kw.get("keyword")
        ]
        if not operations:
            return
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/adGroupCriteria:mutate",
                headers=headers,
                json={"operations": operations},
            )
            self._raise_detailed(r)
            return r.json()

    async def create_responsive_search_ad(self, ad_group_resource: str, headlines: list[str], descriptions: list[str], final_url: str) -> str:
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/adGroupAds:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "create": {
                            "adGroup": ad_group_resource,
                            "status": "PAUSED",
                            "ad": {
                                "finalUrls": [final_url],
                                "responsiveSearchAd": {
                                    "headlines": [{"text": h[:30]} for h in headlines[:15]],
                                    "descriptions": [{"text": d[:90]} for d in descriptions[:4]],
                                },
                            },
                        }
                    }]
                },
            )
            self._raise_detailed(r)
            return r.json()["results"][0]["resourceName"]

    async def launch_ads(self, campaign_resource: str, daily_budget: float, landing_url: str, ad_groups: list[dict]) -> list[str]:
        """For each ad group in the brief: creates the ad group, its keywords, and one
        responsive search ad. Ad groups and ads are created PAUSED — nothing serves or
        spends until the user enables the campaign."""
        if not ad_groups:
            raise ValueError("No ad group data available to create ads from")
        campaign_resource = self._campaign_resource_name(campaign_resource)
        # Rough default CPC bid: 1/20th of daily budget, floored at $0.50 — avoids a
        # zero/missing bid under the campaign's manual CPC bidding strategy.
        cpc_bid_micros = max(int(daily_budget * 1_000_000 / 20), 500_000)
        ad_group_resources = []
        for ag in ad_groups:
            ad_group_resource = await self.create_ad_group(campaign_resource, ag.get("name", "Ad Group"), cpc_bid_micros)
            await self.create_ad_group_keywords(ad_group_resource, ag.get("keywords", []))
            rsa = ag.get("rsa", {})
            headlines = rsa.get("headlines") or [ag.get("name", "Learn More")]
            descriptions = rsa.get("descriptions") or ["Learn more today."]
            await self.create_responsive_search_ad(ad_group_resource, headlines, descriptions, landing_url)
            ad_group_resources.append(ad_group_resource)
        return ad_group_resources

    async def get_campaign_metrics(self, date_range: str = "LAST_30_DAYS"):
        if not self._is_configured():
            return {"configured": False, "data": []}
        try:
            headers = await self._headers()
        except Exception as e:
            return {"configured": True, "data": [], "error": f"Token error: {str(e)}"}
        query = f"""
            SELECT campaign.id, campaign.name, campaign.status,
                   metrics.impressions, metrics.clicks, metrics.cost_micros,
                   metrics.conversions, metrics.all_conversions,
                   metrics.all_conversions_value, metrics.phone_calls,
                   segments.date
            FROM campaign
            WHERE segments.date DURING {date_range}
              AND campaign.status != 'REMOVED'
            ORDER BY segments.date DESC
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/googleAds:searchStream",
                headers=headers,
                json={"query": query},
            )
            if r.status_code != 200:
                try:
                    err_body = r.json()
                    err_msg = err_body.get("error", {}).get("message") or str(err_body)
                except Exception:
                    err_msg = f"Google Ads API error (HTTP {r.status_code}). Check your credentials and customer ID in Settings."
                return {"configured": True, "data": [], "error": err_msg}
            results = []
            for batch in r.json():
                for row in batch.get("results", []):
                    results.append(row)
            return {"configured": True, "data": results}

    def _campaign_resource_name(self, campaign_id_or_resource: str) -> str:
        """Accepts either a full resource name (customers/123/campaigns/456) or a
        bare campaign ID (456, as stored for campaigns pulled in via /sync) and
        always returns the full resource name Google's mutate endpoints require."""
        value = str(campaign_id_or_resource)
        if value.startswith("customers/"):
            return value
        return f"customers/{self.customer_id}/campaigns/{value}"

    async def update_campaign_status(self, campaign_resource: str, status: str):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        resource_name = self._campaign_resource_name(campaign_resource)
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaigns:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "update": {"resourceName": resource_name, "status": status},
                        "updateMask": "status",
                    }]
                },
            )
            self._raise_detailed(r)
            return r.json()

    async def update_campaign_name(self, campaign_resource: str, name: str):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        resource_name = self._campaign_resource_name(campaign_resource)
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaigns:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "update": {"resourceName": resource_name, "name": name},
                        "updateMask": "name",
                    }]
                },
            )
            self._raise_detailed(r)
            return r.json()

    async def _get_campaign_budget_resource(self, campaign_resource: str) -> str:
        resource_name = self._campaign_resource_name(campaign_resource)
        headers = await self._headers()
        query = f"""
            SELECT campaign_budget.resource_name
            FROM campaign
            WHERE campaign.resource_name = '{resource_name}'
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/googleAds:searchStream",
                headers=headers,
                json={"query": query},
            )
            self._raise_detailed(r)
            for batch in r.json():
                for row in batch.get("results", []):
                    return row["campaignBudget"]["resourceName"]
            raise ValueError("Campaign not found on Google Ads — cannot resolve its budget resource")

    async def update_campaign_budget(self, campaign_resource: str, daily_budget: float):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        budget_resource = await self._get_campaign_budget_resource(campaign_resource)
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaignBudgets:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "update": {"resourceName": budget_resource, "amountMicros": int(daily_budget * 1_000_000)},
                        "updateMask": "amountMicros",
                    }]
                },
            )
            self._raise_detailed(r)
            return r.json()
