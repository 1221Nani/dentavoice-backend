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

router = APIRouter(prefix="/api/oauth/meta", tags=["oauth-meta"])

META_OAUTH_URL = "https://www.facebook.com/v20.0/dialog/oauth"
META_TOKEN_URL = "https://graph.facebook.com/v20.0/oauth/access_token"
META_GRAPH_URL = "https://graph.facebook.com/v20.0"
SCOPES = "ads_management,ads_read,business_management"


def _redirect_uri() -> str:
    return os.getenv("BACKEND_URL", "http://localhost:8000") + "/api/oauth/meta/callback"


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
    app_id = settings.get("META_APP_ID") or os.getenv("META_APP_ID", "")
    app_secret = settings.get("META_APP_SECRET") or os.getenv("META_APP_SECRET", "")
    return app_id, app_secret


@router.get("/connect")
async def meta_connect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db, current_user.id)
    app_id, _ = _app_creds(settings)
    if not app_id:
        raise HTTPException(status_code=400, detail="Meta integration is not configured on this server. Contact support.")

    state = f"{secrets.token_urlsafe(24)}:{current_user.id}"
    await _upsert(db, current_user.id, "META_OAUTH_STATE", state)

    url = META_OAUTH_URL + "?" + urlencode({
        "client_id": app_id,
        "redirect_uri": _redirect_uri(),
        "scope": SCOPES,
        "state": state,
        "response_type": "code",
    })
    return {"url": url}


@router.get("/callback")
async def meta_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    front = _frontend_url()

    if error:
        return RedirectResponse(f"{front}/oauth-callback?meta_error={error}")
    if not code or not state:
        return RedirectResponse(f"{front}/oauth-callback?meta_error=missing_params")

    try:
        _, user_id_str = state.rsplit(":", 1)
        user_id = int(user_id_str)
    except (ValueError, IndexError):
        return RedirectResponse(f"{front}/oauth-callback?meta_error=invalid_state")

    settings = await _get_settings(db, user_id)
    if settings.get("META_OAUTH_STATE") != state:
        return RedirectResponse(f"{front}/oauth-callback?meta_error=state_mismatch")

    app_id, app_secret = _app_creds(settings)

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(META_TOKEN_URL, params={
            "client_id": app_id,
            "client_secret": app_secret,
            "redirect_uri": _redirect_uri(),
            "code": code,
        })
        if r.status_code != 200:
            return RedirectResponse(f"{front}/oauth-callback?meta_error=token_exchange_failed")
        short_token = r.json().get("access_token", "")

        # Exchange for 60-day long-lived token
        r2 = await client.get(META_TOKEN_URL, params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": short_token,
        })
        long_token = r2.json().get("access_token", short_token) if r2.status_code == 200 else short_token

    await _upsert(db, user_id, "META_ACCESS_TOKEN", long_token)

    return RedirectResponse(f"{front}/oauth-callback?meta=connected")


@router.get("/accounts")
async def meta_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db, current_user.id)
    token = settings.get("META_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=400, detail="Meta not connected. Please connect Meta first.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{META_GRAPH_URL}/me/adaccounts", params={
            "fields": "id,name,account_status,currency,business",
            "access_token": token,
            "limit": 100,
        })
        if r.status_code != 200:
            err = r.json().get("error", {}).get("message", r.text)
            raise HTTPException(status_code=400, detail=f"Meta API error: {err}")

    return {
        "accounts": r.json().get("data", []),
        "selected_account_id": settings.get("META_AD_ACCOUNT_ID", ""),
        "selected_account_name": settings.get("META_SELECTED_ACCOUNT_NAME", ""),
    }


class SelectAccountPayload(BaseModel):
    account_id: str
    account_name: str = ""


@router.post("/select")
async def meta_select_account(
    payload: SelectAccountPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_id = payload.account_id.replace("act_", "")
    await _upsert(db, current_user.id, "META_AD_ACCOUNT_ID", clean_id)
    if payload.account_name:
        await _upsert(db, current_user.id, "META_SELECTED_ACCOUNT_NAME", payload.account_name)
    return {"ok": True, "selected": payload.account_name or clean_id}


@router.post("/disconnect")
async def meta_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for key in ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_SELECTED_ACCOUNT_NAME", "META_OAUTH_STATE"]:
        result = await db.execute(
            select(AppSetting).where(AppSetting.user_id == current_user.id, AppSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            await db.delete(setting)
    await db.commit()
    return {"ok": True}
