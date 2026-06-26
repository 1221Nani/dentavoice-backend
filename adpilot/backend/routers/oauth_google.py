import os
import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import httpx

from database import get_db
from models import AppSetting, User
from auth import get_current_user

router = APIRouter(prefix="/api/oauth/google", tags=["oauth-google"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPES = "https://www.googleapis.com/auth/adwords"


def _redirect_uri() -> str:
    return os.getenv("BACKEND_URL", "http://localhost:8000") + "/api/oauth/google/callback"


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173")


async def _get_settings(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(select(AppSetting).where(AppSetting.user_id == user_id))
    return {s.key: s.value for s in result.scalars().all() if s.value}


async def _upsert(db: AsyncSession, user_id: int, key: str, value: str):
    result = await db.execute(
        select(AppSetting).where(AppSetting.user_id == user_id, AppSetting.key == key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(AppSetting(user_id=user_id, key=key, value=value, is_secret=True))
    await db.commit()


def _app_creds(settings: dict) -> tuple[str, str]:
    client_id = settings.get("GOOGLE_ADS_CLIENT_ID") or os.getenv("GOOGLE_ADS_CLIENT_ID", "")
    client_secret = settings.get("GOOGLE_ADS_CLIENT_SECRET") or os.getenv("GOOGLE_ADS_CLIENT_SECRET", "")
    return client_id, client_secret


@router.get("/connect")
async def google_connect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db, current_user.id)
    client_id, _ = _app_creds(settings)
    if not client_id:
        raise HTTPException(status_code=400, detail="Google integration is not configured on this server. Contact support.")

    state = f"{secrets.token_urlsafe(24)}:{current_user.id}"
    await _upsert(db, current_user.id, "GOOGLE_OAUTH_STATE", state)

    url = GOOGLE_AUTH_URL + "?" + urlencode({
        "client_id": client_id,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",   # required to get a refresh token
        "prompt": "consent",        # forces Google to always return a fresh refresh token
        "state": state,
    })
    return {"url": url}


@router.get("/callback")
async def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    front = _frontend_url()

    if error:
        return RedirectResponse(f"{front}/oauth-callback?google_error={error}")
    if not code or not state:
        return RedirectResponse(f"{front}/oauth-callback?google_error=missing_params")

    try:
        _, user_id_str = state.rsplit(":", 1)
        user_id = int(user_id_str)
    except (ValueError, IndexError):
        return RedirectResponse(f"{front}/oauth-callback?google_error=invalid_state")

    settings = await _get_settings(db, user_id)
    if settings.get("GOOGLE_OAUTH_STATE") != state:
        return RedirectResponse(f"{front}/oauth-callback?google_error=state_mismatch")

    client_id, client_secret = _app_creds(settings)

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": _redirect_uri(),
            "grant_type": "authorization_code",
        })
        if r.status_code != 200:
            return RedirectResponse(f"{front}/oauth-callback?google_error=token_exchange_failed")

        data = r.json()
        refresh_token = data.get("refresh_token")
        if not refresh_token:
            return RedirectResponse(f"{front}/oauth-callback?google_error=no_refresh_token")

    await _upsert(db, user_id, "GOOGLE_ADS_REFRESH_TOKEN", refresh_token)

    return RedirectResponse(f"{front}/oauth-callback?google=connected")


@router.get("/accounts")
async def google_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List accessible Google Ads customer accounts under the MCC."""
    from services import GoogleAdsService
    settings = await _get_settings(db, current_user.id)
    if not settings.get("GOOGLE_ADS_REFRESH_TOKEN") and not os.getenv("GOOGLE_ADS_REFRESH_TOKEN"):
        raise HTTPException(status_code=400, detail="Google Ads not connected. Click 'Connect Google Ads' first.")

    svc = GoogleAdsService(settings=settings)
    try:
        token = await svc._get_access_token()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not get Google access token: {e}")

    login_id = settings.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{svc.BASE_URL}/customers:listAccessibleCustomers",
            headers={
                "Authorization": f"Bearer {token}",
                "developer-token": svc.developer_token,
                **({"login-customer-id": login_id} if login_id else {}),
            }
        )
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Google Ads API error: {r.text}")

    resource_names = r.json().get("resourceNames", [])
    accounts = [{"id": rn.split("/")[-1], "name": rn} for rn in resource_names]
    return {
        "accounts": accounts,
        "selected_customer_id": settings.get("GOOGLE_ADS_CUSTOMER_ID") or os.getenv("GOOGLE_ADS_CUSTOMER_ID", ""),
    }


class SelectAccountPayload(BaseModel):
    customer_id: str
    login_customer_id: str = ""


@router.post("/select")
async def google_select_account(
    payload: SelectAccountPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _upsert(db, current_user.id, "GOOGLE_ADS_CUSTOMER_ID", payload.customer_id)
    if payload.login_customer_id:
        await _upsert(db, current_user.id, "GOOGLE_ADS_LOGIN_CUSTOMER_ID", payload.login_customer_id)
    return {"ok": True, "selected": payload.customer_id}


@router.post("/disconnect")
async def google_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for key in ["GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_OAUTH_STATE"]:
        result = await db.execute(
            select(AppSetting).where(AppSetting.user_id == current_user.id, AppSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            await db.delete(setting)
    await db.commit()
    return {"ok": True}
