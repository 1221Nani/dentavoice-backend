from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from typing import Optional

from database import get_db
from models import Campaign, PerformanceMetric, OptimizerRecommendation, User
from services import AnthropicService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/optimizer", tags=["optimizer"])


@router.get("/data-freshness")
async def get_data_freshness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns how stale the synced performance data is."""
    result = await db.execute(
        select(func.max(PerformanceMetric.date)).where(PerformanceMetric.user_id == current_user.id)
    )
    latest_date = result.scalar_one_or_none()
    if not latest_date:
        return {"has_data": False, "latest_date": None, "hours_old": None, "stale": True}

    # Convert date string to datetime for age calculation
    try:
        if isinstance(latest_date, str):
            latest_dt = datetime.strptime(latest_date, "%Y-%m-%d")
        else:
            latest_dt = datetime.combine(latest_date, datetime.min.time())
        now = datetime.utcnow()
        hours_old = round((now - latest_dt).total_seconds() / 3600, 1)
        stale = hours_old > 26  # Data older than ~1 day is stale
    except Exception:
        hours_old = None
        stale = True

    return {
        "has_data": True,
        "latest_date": str(latest_date),
        "hours_old": hours_old,
        "stale": stale,
    }


@router.get("/campaign-counts")
async def get_campaign_counts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return active/paused campaign counts so the frontend can show filter labels."""
    result = await db.execute(
        select(Campaign.status, func.count(Campaign.id))
        .where(Campaign.user_id == current_user.id)
        .group_by(Campaign.status)
    )
    counts = {"active": 0, "paused": 0, "draft": 0}
    for status, count in result.all():
        if status in counts:
            counts[status] = count
    return counts


@router.get("/recommendations")
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OptimizerRecommendation)
        .where(
            OptimizerRecommendation.user_id == current_user.id,
            OptimizerRecommendation.status == "pending",
        )
        .order_by(OptimizerRecommendation.created_at.desc())
    )
    return [_rec_to_dict(r) for r in result.scalars().all()]


@router.post("/generate")
async def generate_recommendations(
    status_filter: Optional[str] = Query(default="all", description="all | active | paused"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(Campaign.user_id == current_user.id)
    if status_filter == "active":
        query = query.where(Campaign.status == "active")
    elif status_filter == "paused":
        query = query.where(Campaign.status == "paused")
    else:
        # "all" — include active and paused, exclude drafts
        query = query.where(Campaign.status.in_(["active", "paused"]))

    campaigns_result = await db.execute(query)
    campaigns = campaigns_result.scalars().all()

    label = {"all": "active and paused", "active": "active", "paused": "paused"}.get(status_filter, "active and paused")
    if not campaigns:
        return {"recommendations": [], "message": f"No {label} campaigns found. Sync your ad accounts to pull campaign data."}

    campaigns_data = []
    for c in campaigns:
        metrics_result = await db.execute(
            select(PerformanceMetric).where(
                PerformanceMetric.campaign_id == c.id,
                PerformanceMetric.user_id == current_user.id,
            )
        )
        metrics = metrics_result.scalars().all()

        if metrics:
            spend = sum(m.spend for m in metrics)
            revenue = sum(m.revenue for m in metrics)
            clicks = sum(m.clicks for m in metrics)
            impressions = sum(m.impressions for m in metrics)
            conversions = sum(m.conversions for m in metrics)

            campaigns_data.append({
                "id": c.id,
                "name": c.name,
                "platform": c.platform,
                "status": c.status,
                "daily_budget": c.daily_budget or 0,
                "objective": c.objective,
                "total_spend": round(spend, 2),
                "total_revenue": round(revenue, 2),
                "impressions": impressions,
                "clicks": clicks,
                "conversions": conversions,
                "ctr": round(clicks / impressions * 100, 2) if impressions else 0,
                "cpc": round(spend / clicks, 2) if clicks else 0,
                "roas": round(revenue / spend, 2) if spend else 0,
                "cpa": round(spend / conversions, 2) if conversions else 0,
            })

    if not campaigns_data:
        return {
            "recommendations": [],
            "message": f"No performance data found for {label} campaigns. Sync your ad accounts first (Performance → Sync).",
        }

    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)

    try:
        recs_data = await svc.generate_optimization_recommendations(campaigns_data)
    except Exception:
        # Deterministic fallback — always produces useful output
        recs_data = _rule_based_recommendations(campaigns_data)

    saved = []
    campaign_map = {c.name: c.id for c in campaigns}
    for rec in recs_data:
        campaign_name = rec.get("campaign_name", "all")
        campaign_id = campaign_map.get(campaign_name) if campaign_name != "all" else None

        r = OptimizerRecommendation(
            user_id=current_user.id,
            campaign_id=campaign_id,
            type=rec.get("type", "general"),
            title=rec.get("title", "Optimization Suggestion"),
            description=rec.get("description", ""),
            impact=rec.get("impact", "medium"),
            action={"estimated_improvement": rec.get("estimated_improvement", "")},
        )
        db.add(r)
        await db.flush()
        saved.append(_rec_to_dict(r))

    await db.commit()
    active_count = sum(1 for c in campaigns_data if c.get("status") == "active")
    paused_count = sum(1 for c in campaigns_data if c.get("status") == "paused")
    summary = f"Analyzed {len(campaigns_data)} campaigns ({active_count} active, {paused_count} paused) — {len(saved)} recommendation(s) generated."
    return {"recommendations": saved, "message": summary}


@router.post("/{rec_id}/apply")
async def apply_recommendation(
    rec_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = await _get_owned(db, rec_id, current_user.id)
    rec.status = "applied"
    await db.commit()
    return {"ok": True, "status": "applied"}


@router.post("/{rec_id}/dismiss")
async def dismiss_recommendation(
    rec_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = await _get_owned(db, rec_id, current_user.id)
    rec.status = "dismissed"
    await db.commit()
    return {"ok": True, "status": "dismissed"}


@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OptimizerRecommendation)
        .where(
            OptimizerRecommendation.user_id == current_user.id,
            OptimizerRecommendation.status.in_(["applied", "dismissed"]),
        )
        .order_by(OptimizerRecommendation.created_at.desc())
        .limit(50)
    )
    return [_rec_to_dict(r) for r in result.scalars().all()]


async def _get_owned(db: AsyncSession, rec_id: int, user_id: int) -> OptimizerRecommendation:
    result = await db.execute(
        select(OptimizerRecommendation).where(
            OptimizerRecommendation.id == rec_id,
            OptimizerRecommendation.user_id == user_id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


def _rule_based_recommendations(campaigns_data: list[dict]) -> list[dict]:
    """Deterministic rule engine — runs when AI is unavailable. Handles active and paused campaigns."""
    recs = []

    for c in campaigns_data:
        spend = c.get("total_spend", 0)
        revenue = c.get("total_revenue", 0)
        clicks = c.get("clicks", 0)
        impressions = c.get("impressions", 0)
        conversions = c.get("conversions", 0)
        ctr = c.get("ctr", 0)
        roas = c.get("roas", 0)
        cpa = c.get("cpa", 0)
        daily_budget = c.get("daily_budget", 0) or 0
        name = c.get("name", "Unknown")
        status = c.get("status", "active")

        # Rule 0: Paused campaign — check if it should be reactivated
        if status == "paused":
            if roas >= 3.0 and spend > 0:
                recs.append({
                    "title": f"Reactivate {name} — Was Profitable ({roas:.1f}x ROAS)",
                    "description": (
                        f"This campaign is paused but had strong historical ROAS of {roas:.2f}x "
                        f"(${revenue:.2f} revenue on ${spend:.2f} spend). "
                        f"Consider reactivating with the same budget (${daily_budget:.0f}/day) and monitoring performance closely. "
                        f"A paused profitable campaign is lost revenue."
                    ),
                    "impact": "high",
                    "type": "budget",
                    "campaign_name": name,
                    "estimated_improvement": f"${daily_budget * roas:.0f}/day projected revenue if reactivated",
                })
            elif roas < 1.5 and spend > 50:
                recs.append({
                    "title": f"Keep {name} Paused — Below Break-Even",
                    "description": (
                        f"This campaign is correctly paused. Historical ROAS was {roas:.2f}x "
                        f"(${revenue:.2f} revenue on ${spend:.2f} spend). "
                        f"Do not reactivate until you've revised the creative, audience, and offer. "
                        f"Fix the fundamentals before spending more."
                    ),
                    "impact": "medium",
                    "type": "pause",
                    "campaign_name": name,
                    "estimated_improvement": f"Avoid resuming ${daily_budget:.0f}/day on a losing campaign",
                })
            continue  # Skip active-campaign rules for paused campaigns

        # Rule 1: High spend + zero conversions → pause
        if conversions == 0 and spend > 50:
            recs.append({
                "title": f"Pause {name} — Zero Conversions",
                "description": (
                    f"${spend:.2f} spent across {impressions:,} impressions with zero conversions recorded. "
                    f"This campaign is draining budget without results. "
                    f"Pause it immediately and review targeting, creative, and landing page before reactivating."
                ),
                "impact": "high",
                "type": "pause",
                "campaign_name": name,
                "estimated_improvement": f"Save ${spend:.0f} in wasted spend",
            })
            continue

        # Rule 2: High CTR + low conversion rate → landing page review
        if ctr >= 2.0 and clicks > 0:
            cvr = conversions / clicks * 100
            if cvr < 1.0:
                recs.append({
                    "title": f"Landing Page Issue on {name}",
                    "description": (
                        f"CTR of {ctr:.2f}% is strong — ads are compelling. "
                        f"But conversion rate is only {cvr:.2f}% ({conversions} conversions from {clicks:,} clicks). "
                        f"Traffic is arriving but not converting. Audit the landing page UX, load speed, and offer clarity."
                    ),
                    "impact": "high",
                    "type": "creative",
                    "campaign_name": name,
                    "estimated_improvement": "+2-4x conversions from existing traffic with LP improvements",
                })

        # Rule 3: Low CTR → creative refresh
        if ctr < 0.5 and impressions > 5000:
            recs.append({
                "title": f"Creative Refresh Needed on {name}",
                "description": (
                    f"CTR of {ctr:.2f}% across {impressions:,} impressions is well below the industry average of 1-2%. "
                    f"Ad creative is not capturing attention. Test new headlines, hooks, and visual formats. "
                    f"Pause the lowest-performing ad sets and replace with fresh variations."
                ),
                "impact": "medium",
                "type": "creative",
                "campaign_name": name,
                "estimated_improvement": "+30-60% CTR improvement with new creative",
            })

        # Rule 4: High ROAS → scale budget
        if roas >= 4.0 and daily_budget < 200 and spend > 0:
            recs.append({
                "title": f"Scale Budget on {name} — ROAS {roas:.1f}x",
                "description": (
                    f"ROAS of {roas:.2f}x with only ${daily_budget:.0f}/day budget. "
                    f"This campaign is highly profitable and has room to scale. "
                    f"Increase daily budget by 20-30% every 3-4 days while ROAS stays above 3x."
                ),
                "impact": "high",
                "type": "budget",
                "campaign_name": name,
                "estimated_improvement": f"+${daily_budget * 0.25 * roas:.0f}/day projected revenue",
            })

        # Rule 5: High CPA relative to revenue per conversion → audience review
        if conversions > 0 and cpa > 0 and revenue > 0:
            rev_per_conv = revenue / conversions
            if cpa > rev_per_conv * 0.7:
                recs.append({
                    "title": f"High CPA on {name} — Audience Review",
                    "description": (
                        f"CPA of ${cpa:.2f} vs ${rev_per_conv:.2f} revenue per conversion leaves thin margins ({(1 - cpa/rev_per_conv)*100:.0f}% profit margin). "
                        f"Narrow audience targeting to higher-intent segments: retargeting, lookalikes from converters, or tighter interest groups. "
                        f"Exclude broad audiences that are clicking but not converting."
                    ),
                    "impact": "medium",
                    "type": "targeting",
                    "campaign_name": name,
                    "estimated_improvement": "Reduce CPA by 20-40% with tighter audience targeting",
                })

        # Bonus: Low ROAS + meaningful spend → flag for review
        if 0 < roas < 1.5 and spend > 100 and conversions > 0:
            recs.append({
                "title": f"Below Break-Even ROAS on {name}",
                "description": (
                    f"ROAS of {roas:.2f}x means spending ${spend:.2f} to earn only ${revenue:.2f}. "
                    f"Every dollar spent returns only {roas:.2f}x. "
                    f"Pause or significantly reduce budget while revising bidding strategy, audience, and creative."
                ),
                "impact": "high",
                "type": "pause",
                "campaign_name": name,
                "estimated_improvement": f"Stop ${spend - revenue:.2f} net loss",
            })

    if not recs:
        recs.append({
            "title": "Account Performing Within Normal Range",
            "description": (
                "No critical issues detected across your campaigns. "
                "Continue monitoring CTR, ROAS, and CPA daily. "
                "Consider A/B testing ad creative every 2-3 weeks to prevent performance decay."
            ),
            "impact": "low",
            "type": "general",
            "campaign_name": "all",
            "estimated_improvement": "Ongoing performance maintenance",
        })

    return recs


def _rec_to_dict(r: OptimizerRecommendation) -> dict:
    return {
        "id": r.id,
        "campaign_id": r.campaign_id,
        "type": r.type,
        "title": r.title,
        "description": r.description,
        "impact": r.impact,
        "action": r.action,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
