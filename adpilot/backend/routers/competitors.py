from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import CompetitorAd, User
from services import MetaAdsService, AnthropicService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/competitors", tags=["competitors"])


class MetaSearchRequest(BaseModel):
    query: str
    country: str = "US"
    limit: int = 20


class SaveAdRequest(BaseModel):
    platform: str
    advertiser_name: str
    ad_id: Optional[str] = None
    headline: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    cta: Optional[str] = None
    landing_page: Optional[str] = None
    raw_data: Optional[dict] = None


@router.post("/meta/search")
async def search_meta_library(
    payload: MetaSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = MetaAdsService(settings=settings)

    if not svc.access_token:
        return {
            "results": [],
            "count": 0,
            "error": "Meta access token not configured. Connect your Meta account in Settings to search the Ad Library.",
        }

    ads = await svc.search_ad_library(
        query=payload.query,
        country=payload.country,
        limit=payload.limit,
    )

    if not ads:
        return {
            "results": [],
            "count": 0,
            "error": (
                "No ads found. This may be because: (1) the search term returned no results, "
                "(2) your Meta access token has expired — reconnect in Settings, or "
                "(3) the Meta Ad Library API is temporarily unavailable."
            ),
        }

    normalized = []
    for ad in ads:
        bodies = ad.get("ad_creative_bodies", [])
        titles = ad.get("ad_creative_link_titles", [])
        normalized.append({
            "platform": "meta",
            "ad_id": ad.get("id"),
            "advertiser_name": ad.get("page_name", "Unknown"),
            "headline": titles[0] if titles else None,
            "body": bodies[0] if bodies else None,
            "snapshot_url": ad.get("ad_snapshot_url"),
            "start_date": ad.get("ad_delivery_start_time"),
            "end_date": ad.get("ad_delivery_stop_time"),
            "spend": ad.get("spend"),
            "raw": ad,
        })

    return {"results": normalized, "count": len(normalized)}


@router.post("/meta/insights")
async def get_meta_insights(
    payload: MetaSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = MetaAdsService(settings=settings)

    if not svc.access_token:
        return {
            "insights": "Meta access token not configured. Connect your Meta account in Settings to enable competitor analysis.",
            "ad_count": 0,
        }

    ads = await svc.search_ad_library(query=payload.query, country=payload.country, limit=payload.limit)

    if not ads:
        return {
            "insights": "No competitor ads found for this search. Try a different brand name or keyword.",
            "ad_count": 0,
        }

    normalized = []
    for ad in ads:
        bodies = ad.get("ad_creative_bodies", [])
        titles = ad.get("ad_creative_link_titles", [])
        normalized.append({
            "advertiser": ad.get("page_name", "Unknown"),
            "headline": titles[0] if titles else "",
            "body": bodies[0] if bodies else "",
        })

    ai_svc = AnthropicService(settings=settings)
    try:
        insights = await ai_svc.generate_competitor_insights(normalized)
    except Exception as e:
        insights = f"AI analysis temporarily unavailable: {str(e)}"

    return {"insights": insights, "ad_count": len(normalized)}


@router.get("/saved")
async def get_saved_ads(
    platform: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(CompetitorAd)
        .where(CompetitorAd.user_id == current_user.id)
        .order_by(CompetitorAd.saved_at.desc())
    )
    if platform:
        q = q.where(CompetitorAd.platform == platform)
    result = await db.execute(q)
    return [_ad_to_dict(a) for a in result.scalars().all()]


@router.post("/save")
async def save_ad(
    payload: SaveAdRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ad = CompetitorAd(
        user_id=current_user.id,
        platform=payload.platform,
        advertiser_name=payload.advertiser_name,
        ad_id=payload.ad_id,
        headline=payload.headline,
        body=payload.body,
        image_url=payload.image_url,
        cta=payload.cta,
        landing_page=payload.landing_page,
        raw_data=payload.raw_data,
    )
    db.add(ad)
    await db.commit()
    await db.refresh(ad)
    return _ad_to_dict(ad)


@router.delete("/saved/{ad_id}")
async def delete_saved_ad(
    ad_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompetitorAd).where(CompetitorAd.id == ad_id, CompetitorAd.user_id == current_user.id)
    )
    ad = result.scalar_one_or_none()
    if not ad:
        raise HTTPException(status_code=404, detail="Saved ad not found")
    await db.delete(ad)
    await db.commit()
    return {"ok": True}


def _ad_to_dict(a: CompetitorAd) -> dict:
    return {
        "id": a.id,
        "platform": a.platform,
        "advertiser_name": a.advertiser_name,
        "ad_id": a.ad_id,
        "headline": a.headline,
        "body": a.body,
        "image_url": a.image_url,
        "cta": a.cta,
        "landing_page": a.landing_page,
        "countries": a.countries,
        "saved_at": a.saved_at.isoformat() if a.saved_at else None,
    }
