from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import os

from database import get_db
from models import AppSetting, User
from services import MetaAdsService, GoogleAdsService, AnthropicService, ImageGenService, VideoGenService
from auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

SECRET_KEYS = [
    "META_APP_ID",
    "META_APP_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_CUSTOMER_ID",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "RUNWAY_API_KEY",
]


class SettingsPayload(BaseModel):
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    GOOGLE_ADS_DEVELOPER_TOKEN: Optional[str] = None
    GOOGLE_ADS_CLIENT_ID: Optional[str] = None
    GOOGLE_ADS_CLIENT_SECRET: Optional[str] = None
    GOOGLE_ADS_REFRESH_TOKEN: Optional[str] = None
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: Optional[str] = None
    GOOGLE_ADS_CUSTOMER_ID: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    RUNWAY_API_KEY: Optional[str] = None


@router.get("")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AppSetting).where(AppSetting.user_id == current_user.id)
    )
    db_settings = {s.key: s.value for s in result.scalars().all()}

    response = {}
    for key in SECRET_KEYS:
        val = db_settings.get(key)
        response[key] = _mask(val) if val else None

    return {"settings": response, "configured": _check_configured(db_settings)}


@router.post("")
async def save_settings(
    payload: SettingsPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)

    for key, value in data.items():
        if not value or value.startswith("***") or "***" in value:
            continue
        result = await db.execute(
            select(AppSetting).where(
                AppSetting.user_id == current_user.id,
                AppSetting.key == key,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = value
        else:
            db.add(AppSetting(user_id=current_user.id, key=key, value=value, is_secret=True))

    await db.commit()
    return {"ok": True, "message": "Settings saved successfully"}


@router.get("/status")
async def get_connection_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AppSetting).where(AppSetting.user_id == current_user.id)
    )
    settings = {s.key: s.value for s in result.scalars().all() if s.value}

    # Fall back to .env for any missing keys so status reflects reality
    for key in [
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
        "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "RUNWAY_API_KEY",
    ]:
        if not settings.get(key):
            env_val = os.getenv(key)
            if env_val:
                settings[key] = env_val

    statuses = {}

    meta_svc = MetaAdsService(settings=settings)
    selected_name = settings.get("META_SELECTED_ACCOUNT_NAME")
    if meta_svc._is_configured():
        try:
            info = await meta_svc.get_ad_account_info()
            account_label = selected_name or (info.get("name") if info else "Connected")
            statuses["meta"] = {"connected": True, "account": account_label}
        except Exception as e:
            statuses["meta"] = {"connected": False, "error": str(e)}
    elif settings.get("META_ACCESS_TOKEN"):
        statuses["meta"] = {"connected": True, "account": selected_name or "Connected — select an account"}
    else:
        statuses["meta"] = {"connected": False, "error": "Not connected"}

    google_svc = GoogleAdsService(settings=settings)
    if google_svc._is_configured():
        statuses["google"] = {"connected": True, "account": f"Customer ID: {google_svc.customer_id}"}
    else:
        statuses["google"] = {"connected": False, "error": "API keys not configured"}

    statuses["anthropic"] = {"connected": AnthropicService(settings=settings)._is_configured()}
    statuses["openai"] = {"connected": ImageGenService(settings=settings)._is_configured()}
    statuses["runway"] = {"connected": VideoGenService(settings=settings)._is_configured()}

    return {"services": statuses}


@router.get("/google/accounts")
async def list_google_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AppSetting).where(AppSetting.user_id == current_user.id)
    )
    settings = {s.key: s.value for s in result.scalars().all() if s.value}
    for key in [
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    ]:
        if not settings.get(key):
            env_val = os.getenv(key)
            if env_val:
                settings[key] = env_val
    svc = GoogleAdsService(settings=settings)
    return await svc.list_accessible_customers()


@router.post("/google/select-account")
async def select_google_account(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    customer_id = payload.get("customer_id", "").strip()
    if not customer_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="customer_id required")
    result = await db.execute(
        select(AppSetting).where(
            AppSetting.user_id == current_user.id,
            AppSetting.key == "GOOGLE_ADS_CUSTOMER_ID",
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = customer_id
    else:
        db.add(AppSetting(user_id=current_user.id, key="GOOGLE_ADS_CUSTOMER_ID", value=customer_id, is_secret=True))
    await db.commit()
    return {"ok": True, "selected": customer_id}


def _mask(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return value[:4] + "***" + value[-4:]


def _check_configured(settings: dict) -> dict:
    return {
        "meta": bool(settings.get("META_APP_ID")),
        "google": bool(settings.get("GOOGLE_ADS_DEVELOPER_TOKEN")),
        "anthropic": bool(settings.get("ANTHROPIC_API_KEY")),
        "openai": bool(settings.get("OPENAI_API_KEY")),
        "runway": bool(settings.get("RUNWAY_API_KEY")),
    }
