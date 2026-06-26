from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from database import get_db
from models import Campaign, PerformanceMetric, User
from auth import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


class MetricsBulkCreate(BaseModel):
    campaign_id: int
    metrics: list[dict]


@router.get("/overview")
async def get_overview(
    days: int = Query(30, ge=1, le=365),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = start_date if start_date else (date.today() - timedelta(days=days)).isoformat()
    q = select(PerformanceMetric).where(
        PerformanceMetric.user_id == current_user.id,
        PerformanceMetric.date >= cutoff,
    )
    if end_date:
        q = q.where(PerformanceMetric.date <= end_date)
    if platform:
        q = q.where(PerformanceMetric.platform == platform)
    if account_id:
        sub = select(Campaign.id).where(
            Campaign.user_id == current_user.id,
            Campaign.ad_account_id == account_id,
        )
        ids = (await db.execute(sub)).scalars().all()
        if ids:
            q = q.where(PerformanceMetric.campaign_id.in_(ids))

    result = await db.execute(q)
    all_metrics = result.scalars().all()

    totals = {
        "impressions": sum(m.impressions for m in all_metrics),
        "clicks": sum(m.clicks for m in all_metrics),
        "conversions": sum(m.conversions for m in all_metrics),
        "spend": round(sum(m.spend for m in all_metrics), 2),
        "revenue": round(sum(m.revenue for m in all_metrics), 2),
    }
    totals["ctr"] = round(totals["clicks"] / totals["impressions"] * 100, 2) if totals["impressions"] else 0
    totals["cpc"] = round(totals["spend"] / totals["clicks"], 2) if totals["clicks"] else 0
    totals["roas"] = round(totals["revenue"] / totals["spend"], 2) if totals["spend"] else 0
    totals["cpa"] = round(totals["spend"] / totals["conversions"], 2) if totals["conversions"] else 0

    return {"totals": totals, "period_days": days, "platform": platform or "all"}


@router.get("/trends")
async def get_trends(
    days: int = Query(30, ge=7, le=365),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = start_date if start_date else (date.today() - timedelta(days=days)).isoformat()
    q = (
        select(PerformanceMetric)
        .where(
            PerformanceMetric.user_id == current_user.id,
            PerformanceMetric.date >= cutoff,
        )
        .order_by(PerformanceMetric.date.asc())
    )
    if end_date:
        q = q.where(PerformanceMetric.date <= end_date)
    if platform:
        q = q.where(PerformanceMetric.platform == platform)
    if account_id:
        sub = select(Campaign.id).where(
            Campaign.user_id == current_user.id,
            Campaign.ad_account_id == account_id,
        )
        ids = (await db.execute(sub)).scalars().all()
        if ids:
            q = q.where(PerformanceMetric.campaign_id.in_(ids))

    result = await db.execute(q)
    metrics = result.scalars().all()

    daily = {}
    for m in metrics:
        key = m.date
        if key not in daily:
            daily[key] = {"date": key, "impressions": 0, "clicks": 0, "spend": 0, "conversions": 0, "revenue": 0}
        daily[key]["impressions"] += m.impressions
        daily[key]["clicks"] += m.clicks
        daily[key]["spend"] += m.spend
        daily[key]["conversions"] += m.conversions
        daily[key]["revenue"] += m.revenue

    trend_data = sorted(daily.values(), key=lambda x: x["date"])
    for d in trend_data:
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["roas"] = round(d["revenue"] / d["spend"], 2) if d["spend"] else 0
        d["ctr"] = round(d["clicks"] / d["impressions"] * 100, 2) if d["impressions"] else 0

    return {"trends": trend_data}


@router.get("/campaigns")
async def get_campaign_performance(
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cq = select(Campaign).where(Campaign.user_id == current_user.id)
    if platform:
        cq = cq.where(Campaign.platform == platform)
    if account_id:
        cq = cq.where(Campaign.ad_account_id == account_id)
    campaigns_result = await db.execute(cq)
    campaigns = campaigns_result.scalars().all()

    rows = []
    for c in campaigns:
        metrics_result = await db.execute(
            select(PerformanceMetric).where(
                PerformanceMetric.campaign_id == c.id,
                PerformanceMetric.user_id == current_user.id,
            )
        )
        metrics = metrics_result.scalars().all()

        spend = sum(m.spend for m in metrics)
        revenue = sum(m.revenue for m in metrics)
        clicks = sum(m.clicks for m in metrics)
        impressions = sum(m.impressions for m in metrics)
        conversions = sum(m.conversions for m in metrics)

        rows.append({
            "campaign_id": c.id,
            "campaign_name": c.name,
            "platform": c.platform,
            "status": c.status,
            "objective": c.objective,
            "daily_budget": c.daily_budget,
            "spend": round(spend, 2),
            "revenue": round(revenue, 2),
            "impressions": impressions,
            "clicks": clicks,
            "conversions": conversions,
            "ctr": round(clicks / impressions * 100, 2) if impressions else 0,
            "cpc": round(spend / clicks, 2) if clicks else 0,
            "roas": round(revenue / spend, 2) if spend else 0,
            "cpa": round(spend / conversions, 2) if conversions else 0,
        })

    return {"campaigns": rows}


@router.get("/platform-split")
async def get_platform_split(
    account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PerformanceMetric).where(PerformanceMetric.user_id == current_user.id)
    if account_id:
        sub = select(Campaign.id).where(
            Campaign.user_id == current_user.id,
            Campaign.ad_account_id == account_id,
        )
        ids = (await db.execute(sub)).scalars().all()
        if ids:
            q = q.where(PerformanceMetric.campaign_id.in_(ids))
    result = await db.execute(q)
    metrics = result.scalars().all()

    split = {}
    for m in metrics:
        p = m.platform or "unknown"
        if p not in split:
            split[p] = {"platform": p, "spend": 0, "clicks": 0, "impressions": 0, "conversions": 0, "revenue": 0}
        split[p]["spend"] += m.spend
        split[p]["clicks"] += m.clicks
        split[p]["impressions"] += m.impressions
        split[p]["conversions"] += m.conversions
        split[p]["revenue"] += m.revenue

    result_list = []
    for p, d in split.items():
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["roas"] = round(d["revenue"] / d["spend"], 2) if d["spend"] else 0
        result_list.append(d)

    return {"split": result_list}


@router.post("/seed-demo")
async def seed_demo_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import random

    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == current_user.id)
    )
    campaigns = campaigns_result.scalars().all()

    if not campaigns:
        demo_campaigns = [
            Campaign(user_id=current_user.id, name="Summer Sale 2024", platform="meta", objective="sales", status="active", daily_budget=100),
            Campaign(user_id=current_user.id, name="Brand Awareness Q3", platform="meta", objective="awareness", status="active", daily_budget=50),
            Campaign(user_id=current_user.id, name="Google Search - Shoes", platform="google", objective="traffic", status="active", daily_budget=80),
            Campaign(user_id=current_user.id, name="Retargeting - Cart", platform="meta", objective="sales", status="paused", daily_budget=60),
            Campaign(user_id=current_user.id, name="Google Display - Brand", platform="google", objective="awareness", status="active", daily_budget=40),
        ]
        for c in demo_campaigns:
            db.add(c)
        await db.flush()
        campaigns = demo_campaigns

    today = date.today()
    for campaign in campaigns:
        for i in range(30):
            day = today - timedelta(days=29 - i)
            impressions = random.randint(800, 5000)
            ctr = random.uniform(0.01, 0.05)
            clicks = int(impressions * ctr)
            conv_rate = random.uniform(0.02, 0.08)
            conversions = int(clicks * conv_rate)
            cpc = random.uniform(0.5, 3.0)
            spend = round(clicks * cpc, 2)
            roas = random.uniform(1.5, 5.0)
            revenue = round(spend * roas, 2)

            m = PerformanceMetric(
                user_id=current_user.id,
                campaign_id=campaign.id,
                date=day.isoformat(),
                impressions=impressions,
                clicks=clicks,
                conversions=conversions,
                spend=spend,
                revenue=revenue,
                ctr=round(ctr * 100, 2),
                cpc=round(cpc, 2),
                roas=round(roas, 2),
                platform=campaign.platform,
            )
            db.add(m)

    await db.commit()
    return {"ok": True, "message": "Demo data seeded successfully"}


@router.post("/bulk-metrics")
async def create_bulk_metrics(
    payload: MetricsBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for m in payload.metrics:
        metric = PerformanceMetric(
            user_id=current_user.id,
            campaign_id=payload.campaign_id,
            date=m.get("date"),
            impressions=m.get("impressions", 0),
            clicks=m.get("clicks", 0),
            conversions=m.get("conversions", 0),
            spend=m.get("spend", 0.0),
            revenue=m.get("revenue", 0.0),
            ctr=m.get("ctr", 0.0),
            cpc=m.get("cpc", 0.0),
            roas=m.get("roas", 0.0),
            platform=m.get("platform"),
        )
        db.add(metric)
    await db.commit()
    return {"ok": True, "count": len(payload.metrics)}
