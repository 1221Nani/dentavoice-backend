import os
import httpx
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
        async with httpx.AsyncClient() as client:
            budget_r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaignBudgets:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "create": {
                            "name": f"{name} Budget",
                            "amountMicros": budget_micros,
                            "deliveryMethod": "STANDARD",
                        }
                    }]
                },
            )
            budget_r.raise_for_status()
            budget_resource = budget_r.json()["results"][0]["resourceName"]

            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaigns:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "create": {
                            "name": name,
                            "advertisingChannelType": channel_type,
                            "status": "PAUSED",
                            "campaignBudget": budget_resource,
                            "manualCpc": {},
                        }
                    }]
                },
            )
            r.raise_for_status()
            return r.json()

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

    async def update_campaign_status(self, campaign_resource: str, status: str):
        if not self._is_configured():
            raise ValueError("Google Ads not configured")
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.BASE_URL}/customers/{self.customer_id}/campaigns:mutate",
                headers=headers,
                json={
                    "operations": [{
                        "update": {"resourceName": campaign_resource, "status": status},
                        "updateMask": "status",
                    }]
                },
            )
            r.raise_for_status()
            return r.json()
