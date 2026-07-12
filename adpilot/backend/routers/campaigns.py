from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import Campaign, User
from services import MetaAdsService, GoogleAdsService, AnthropicService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


def _google_status(status: str) -> str:
    mapping = {"active": "ENABLED", "paused": "PAUSED", "deleted": "REMOVED"}
    return mapping.get(status.lower(), status.upper())


def _meta_delete_status(status: str) -> str:
    return "DELETED" if status.lower() == "deleted" else status.upper()


async def _push_status_to_platform(campaign: Campaign, status: str, settings: dict):
    if not campaign.platform_id:
        return
    if campaign.platform == "meta":
        await MetaAdsService(settings=settings).update_campaign_status(campaign.platform_id, _meta_delete_status(status))
    elif campaign.platform == "google":
        await GoogleAdsService(settings=settings).update_campaign_status(campaign.platform_id, _google_status(status))


async def _push_name_to_platform(campaign: Campaign, name: str, settings: dict):
    if not campaign.platform_id:
        return
    if campaign.platform == "meta":
        await MetaAdsService(settings=settings).update_campaign_name(campaign.platform_id, name)
    elif campaign.platform == "google":
        await GoogleAdsService(settings=settings).update_campaign_name(campaign.platform_id, name)


async def _push_budget_to_platform(campaign: Campaign, daily_budget: float, settings: dict):
    if not campaign.platform_id:
        return
    if campaign.platform == "meta":
        await MetaAdsService(settings=settings).update_campaign_budget(campaign.platform_id, daily_budget)
    elif campaign.platform == "google":
        await GoogleAdsService(settings=settings).update_campaign_budget(campaign.platform_id, daily_budget)


async def _launch_ads_for_campaign(campaign: Campaign, targeting: dict, settings: dict) -> Optional[str]:
    """Attaches an ad set/ad group + ad(s) with real creative to a freshly-created
    campaign, using AI Campaign Builder data if present. Returns a warning string on
    failure (never raises) — a campaign that exists but has no ads attached yet is
    recoverable; the caller decides whether that's acceptable to surface to the user."""
    targeting = targeting or {}
    landing_url = targeting.get("landing_url")
    if not landing_url:
        return "No landing page URL was provided — campaign created but no ads were attached. Add a landing URL and push again."
    try:
        if campaign.platform == "meta":
            ad_copies = targeting.get("ad_copies") or []
            if not ad_copies:
                return "No ad copy available — campaign created but no ads were attached. Generate ad copy first."
            result = await MetaAdsService(settings=settings).launch_ads(
                campaign_id=campaign.platform_id,
                campaign_name=campaign.name,
                landing_url=landing_url,
                audience=targeting.get("audience") or {},
                ad_copies=ad_copies,
            )
            if result.get("warnings"):
                created = len(result["ad_ids"])
                total = len(ad_copies)
                return f"{created}/{total} ad variant(s) created — the rest were rejected: " + "; ".join(result["warnings"])
        elif campaign.platform == "google":
            ad_groups = targeting.get("ad_groups") or []
            if not ad_groups:
                return "No ad group data available — campaign created but no ads were attached. Use AI Campaign Builder to generate ad groups first."
            result = await GoogleAdsService(settings=settings).launch_ads(
                campaign_resource=campaign.platform_id,
                daily_budget=campaign.daily_budget,
                landing_url=landing_url,
                ad_groups=ad_groups,
            )
            if result.get("keyword_warnings"):
                return f"Ads created, but some keywords were rejected: " + "; ".join(result["keyword_warnings"])
    except Exception as e:
        return f"Campaign created but attaching ads failed: {str(e)}. The campaign exists on {campaign.platform.capitalize()} Ads but is empty — fix the issue and contact support to attach ads, or delete and recreate."
    return None


class CampaignCreate(BaseModel):
    name: str
    platform: str
    objective: str
    daily_budget: float
    total_budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    landing_url: Optional[str] = None
    targeting: Optional[dict] = None
    push_to_platform: bool = False


class AIBuildRequest(BaseModel):
    prompt: str
    platform: str  # "meta" | "google"


class AICreateRequest(BaseModel):
    brief: dict
    platform: str
    landing_url: Optional[str] = None
    push_to_platform: bool = False


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    daily_budget: Optional[float] = None
    end_date: Optional[str] = None


@router.post("/ai-build")
async def ai_build_campaign(
    payload: AIBuildRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Research and generate a complete campaign brief using AI — does NOT save yet."""
    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)
    try:
        brief = await svc.generate_campaign_brief(prompt=payload.prompt, platform=payload.platform)
        return brief
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai-create")
async def ai_create_campaign(
    payload: AICreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save the AI-reviewed campaign brief as a draft campaign."""
    brief = payload.brief
    camp = brief.get("campaign", {})
    targeting_payload = {}
    if payload.platform == "meta":
        targeting_payload = {
            "audience": brief.get("audience"),
            "ad_copies": brief.get("ad_copies"),
            "placements": brief.get("placements"),
            "bidding": brief.get("bidding"),
        }
    else:
        targeting_payload = {
            "ad_groups": brief.get("ad_groups"),
            "negative_keywords": brief.get("negative_keywords"),
            "extensions": brief.get("extensions"),
            "bidding_strategy": camp.get("bidding_strategy"),
            "target_cpa": camp.get("target_cpa"),
        }
    if payload.landing_url:
        targeting_payload["landing_url"] = payload.landing_url

    campaign = Campaign(
        user_id=current_user.id,
        name=camp.get("name", "AI Campaign"),
        platform=payload.platform,
        objective=camp.get("objective", "leads"),
        status="draft",
        daily_budget=float(camp.get("daily_budget", 50)),
        targeting=targeting_payload,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_to_dict(campaign)


@router.get("")
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
    )
    return [_campaign_to_dict(c) for c in result.scalars().all()]


@router.post("")
async def create_campaign(
    payload: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    platform_id = None
    push_warning = None
    ads_warning = None
    campaign_status = "draft"
    targeting = {**(payload.targeting or {})}
    if payload.landing_url:
        targeting["landing_url"] = payload.landing_url

    if payload.push_to_platform:
        try:
            if payload.platform == "meta":
                svc = MetaAdsService(settings=settings)
                result = await svc.create_campaign(
                    name=payload.name,
                    objective=_meta_objective(payload.objective),
                    status="PAUSED",
                    daily_budget=payload.daily_budget,
                )
                platform_id = result.get("id")
            elif payload.platform == "google":
                svc = GoogleAdsService(settings=settings)
                result = await svc.create_campaign(
                    name=payload.name,
                    budget_micros=int(payload.daily_budget * 1_000_000),
                )
                platform_id = result.get("results", [{}])[0].get("resourceName")
            # Both platforms create campaigns in a PAUSED state — reflect that locally
            # so AdPilot's status never claims something the real account doesn't show.
            if platform_id:
                campaign_status = "paused"
        except Exception as e:
            push_warning = f"Campaign saved as draft — platform push failed: {str(e)}"

    campaign = Campaign(
        user_id=current_user.id,
        name=payload.name,
        platform=payload.platform,
        platform_id=platform_id,
        objective=payload.objective,
        status=campaign_status,
        daily_budget=payload.daily_budget,
        total_budget=payload.total_budget,
        start_date=payload.start_date,
        end_date=payload.end_date,
        targeting=targeting,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    if platform_id:
        ads_warning = await _launch_ads_for_campaign(campaign, targeting, settings)

    response = _campaign_to_dict(campaign)
    if push_warning:
        response["warning"] = push_warning
    if ads_warning:
        response["ads_warning"] = ads_warning
    return response


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(db, campaign_id, current_user.id)
    return _campaign_to_dict(campaign)


@router.put("/{campaign_id}")
async def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(db, campaign_id, current_user.id)
    settings = await get_user_settings_dict(db, current_user.id)

    if payload.name is not None:
        try:
            await _push_name_to_platform(campaign, payload.name, settings)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to rename campaign on {campaign.platform.capitalize()} Ads: {str(e)}. No changes were saved."
            )
        campaign.name = payload.name
    if payload.status is not None:
        try:
            await _push_status_to_platform(campaign, payload.status, settings)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to update status on {campaign.platform.capitalize()} Ads: {str(e)}. No changes were saved."
            )
        campaign.status = payload.status
    if payload.daily_budget is not None:
        try:
            await _push_budget_to_platform(campaign, payload.daily_budget, settings)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to update budget on {campaign.platform.capitalize()} Ads: {str(e)}. No changes were saved."
            )
        campaign.daily_budget = payload.daily_budget
    if payload.end_date is not None:
        # Note: end_date is stored locally only — Meta/Google campaign-level end date
        # scheduling differs enough per platform (Meta: ad set level; Google: campaign
        # level via a separate field) that it is not pushed automatically here.
        campaign.end_date = payload.end_date

    campaign.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(campaign)
    return _campaign_to_dict(campaign)


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(db, campaign_id, current_user.id)
    if campaign.platform_id:
        settings = await get_user_settings_dict(db, current_user.id)
        try:
            await _push_status_to_platform(campaign, "deleted", settings)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Could not remove this campaign from {campaign.platform.capitalize()} Ads: {str(e)}. "
                    "It was NOT deleted from AdPilot either, so it doesn't keep running on the real "
                    "account unmanaged and invisible here. Check your API credentials in Settings and try again."
                )
            )
    await db.delete(campaign)
    await db.commit()
    return {"ok": True}


@router.post("/{campaign_id}/push")
async def push_campaign_to_platform(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(db, campaign_id, current_user.id)
    settings = await get_user_settings_dict(db, current_user.id)

    try:
        if campaign.platform_id:
            # Already exists on platform — just enable it
            if campaign.platform == "meta":
                await MetaAdsService(settings=settings).update_campaign_status(campaign.platform_id, "active")
            elif campaign.platform == "google":
                await GoogleAdsService(settings=settings).update_campaign_status(campaign.platform_id, "ENABLED")
            campaign.status = "active"
            campaign.updated_at = datetime.utcnow()
            await db.commit()
            return {"success": True, "message": f"Campaign enabled on {campaign.platform.capitalize()} Ads.", "platform_id": campaign.platform_id}
        else:
            # Draft with no platform presence — create it now
            if campaign.platform == "meta":
                svc = MetaAdsService(settings=settings)
                result = await svc.create_campaign(
                    name=campaign.name,
                    objective=_meta_objective(campaign.objective),
                    status="PAUSED",
                    daily_budget=campaign.daily_budget,
                )
                campaign.platform_id = result.get("id")
            elif campaign.platform == "google":
                svc = GoogleAdsService(settings=settings)
                result = await svc.create_campaign(
                    name=campaign.name,
                    budget_micros=int(campaign.daily_budget * 1_000_000),
                )
                campaign.platform_id = result.get("results", [{}])[0].get("resourceName")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported platform: {campaign.platform}")
            # Both platforms create campaigns in a PAUSED state — match that locally
            # instead of claiming "active" when the real account shows paused.
            campaign.status = "paused"
            campaign.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(campaign)
            ads_warning = await _launch_ads_for_campaign(campaign, campaign.targeting or {}, settings)
            response = {
                "success": True,
                "message": f"Campaign created on {campaign.platform.capitalize()} Ads (starts paused — enable it from AdPilot or the platform when ready).",
                "platform_id": campaign.platform_id,
            }
            if ads_warning:
                response["ads_warning"] = ads_warning
            return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Platform push failed: {str(e)}. Check your API credentials in Settings."
        )


@router.post("/{campaign_id}/status")
async def change_status(
    campaign_id: int,
    status: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(db, campaign_id, current_user.id)
    settings = await get_user_settings_dict(db, current_user.id)
    try:
        await _push_status_to_platform(campaign, status, settings)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to update status on {campaign.platform.capitalize()} Ads: {str(e)}. Local status not changed."
        )
    campaign.status = status
    campaign.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "status": status}


@router.get("/platform/meta")
async def sync_meta_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    return await MetaAdsService(settings=settings).get_campaigns()


@router.get("/platform/google")
async def sync_google_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    return await GoogleAdsService(settings=settings).get_campaigns()


async def _get_owned(db: AsyncSession, campaign_id: int, user_id: int) -> Campaign:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def _campaign_to_dict(c: Campaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "platform": c.platform,
        "platform_id": c.platform_id,
        "ad_account_id": c.ad_account_id,
        "objective": c.objective,
        "status": c.status,
        "daily_budget": c.daily_budget,
        "total_budget": c.total_budget,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "targeting": c.targeting,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _meta_objective(obj: str) -> str:
    mapping = {
        "awareness": "BRAND_AWARENESS",
        "traffic": "LINK_CLICKS",
        "engagement": "POST_ENGAGEMENT",
        "leads": "LEAD_GENERATION",
        "sales": "CONVERSIONS",
        "app_installs": "APP_INSTALLS",
    }
    return mapping.get(obj.lower(), "LINK_CLICKS")
