from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from typing import Optional

from database import get_db
from models import Campaign, PerformanceMetric, User
from services import AnthropicService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/insights", tags=["insights"])


async def _build_campaign_data(
    db: AsyncSession,
    user_id: int,
    days: int,
    platform: Optional[str],
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[list[dict], dict]:
    since = start_date if start_date else (date.today() - timedelta(days=days)).isoformat()

    camps_q = select(Campaign).where(Campaign.user_id == user_id)
    if account_id:
        camps_q = camps_q.where(Campaign.ad_account_id == account_id)
    campaigns_result = await db.execute(camps_q)
    campaigns_map = {c.id: c for c in campaigns_result.scalars().all()}

    q = select(PerformanceMetric).where(
        PerformanceMetric.user_id == user_id,
        PerformanceMetric.date >= since,
    )
    if end_date:
        q = q.where(PerformanceMetric.date <= end_date)
    if platform and platform != "all":
        q = q.where(PerformanceMetric.platform == platform)
    if account_id and campaigns_map:
        q = q.where(PerformanceMetric.campaign_id.in_(list(campaigns_map.keys())))
    elif account_id and not campaigns_map:
        return [], {"spend": 0, "revenue": 0, "clicks": 0, "impressions": 0,
                    "conversions": 0, "roas": 0, "ctr": 0, "cpc": 0, "cpa": 0,
                    "days": days, "platform": platform or "all"}

    metrics_result = await db.execute(q)
    metrics = metrics_result.scalars().all()

    by_campaign: dict[int, dict] = {}
    for m in metrics:
        cid = m.campaign_id
        if cid not in by_campaign:
            camp = campaigns_map.get(cid)
            by_campaign[cid] = {
                "campaign_id": cid,
                "campaign_name": camp.name if camp else f"Campaign {cid}",
                "platform": camp.platform if camp else m.platform,
                "status": camp.status if camp else "unknown",
                "daily_budget": camp.daily_budget if camp else 0,
                "spend": 0.0, "revenue": 0.0,
                "impressions": 0, "clicks": 0, "conversions": 0,
            }
        by_campaign[cid]["spend"] += m.spend
        by_campaign[cid]["revenue"] += m.revenue
        by_campaign[cid]["impressions"] += m.impressions
        by_campaign[cid]["clicks"] += m.clicks
        by_campaign[cid]["conversions"] += m.conversions

    campaigns = []
    for d in by_campaign.values():
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["roas"] = round(d["revenue"] / d["spend"], 2) if d["spend"] else 0
        d["ctr"] = round(d["clicks"] / d["impressions"] * 100, 2) if d["impressions"] else 0
        d["cpc"] = round(d["spend"] / d["clicks"], 2) if d["clicks"] else 0
        d["cpa"] = round(d["spend"] / d["conversions"], 2) if d["conversions"] else 0
        campaigns.append(d)

    campaigns.sort(key=lambda x: x["spend"], reverse=True)

    totals_spend = sum(c["spend"] for c in campaigns)
    totals_revenue = sum(c["revenue"] for c in campaigns)
    totals_clicks = sum(c["clicks"] for c in campaigns)
    totals_impressions = sum(c["impressions"] for c in campaigns)
    totals_conversions = sum(c["conversions"] for c in campaigns)
    totals = {
        "spend": round(totals_spend, 2),
        "revenue": round(totals_revenue, 2),
        "clicks": totals_clicks,
        "impressions": totals_impressions,
        "conversions": totals_conversions,
        "roas": round(totals_revenue / totals_spend, 2) if totals_spend else 0,
        "ctr": round(totals_clicks / totals_impressions * 100, 2) if totals_impressions else 0,
        "cpc": round(totals_spend / totals_clicks, 2) if totals_clicks else 0,
        "cpa": round(totals_spend / totals_conversions, 2) if totals_conversions else 0,
        "days": days,
        "platform": platform or "all",
    }

    return campaigns, totals


def _rule_based_insights(campaigns: list[dict], totals: dict) -> list[dict]:
    """Deterministic insight cards — runs when AI is unavailable."""
    insights = []
    roas = totals.get("roas", 0)
    ctr = totals.get("ctr", 0)
    spend = totals.get("spend", 0)
    revenue = totals.get("revenue", 0)
    conversions = totals.get("conversions", 0)
    clicks = totals.get("clicks", 0)
    impressions = totals.get("impressions", 0)

    if roas >= 4:
        insights.append({
            "type": "success", "metric": "ROAS",
            "title": f"{roas:.1f}x ROAS — Strong Performance",
            "insight": f"Account is returning ${roas:.2f} for every $1 spent — well above the 3x benchmark for healthy ad accounts.",
            "action": "Scale your highest-ROAS campaigns 20-30% to capture incremental revenue while returns stay strong.",
        })
    elif roas >= 2:
        insights.append({
            "type": "info", "metric": "ROAS",
            "title": f"{roas:.1f}x ROAS — Room to Optimize",
            "insight": f"Account ROAS of {roas:.2f}x is profitable but below the 4x growth threshold. Selective optimization will push this higher.",
            "action": "Concentrate budget on campaigns above 3x ROAS and audit lower performers for budget waste.",
        })
    elif roas > 0 and spend > 0:
        insights.append({
            "type": "danger", "metric": "ROAS",
            "title": f"{roas:.1f}x ROAS — Below Break-even",
            "insight": f"Account ROAS of {roas:.2f}x means you're spending more than you're earning. Immediate action is required to stop losses.",
            "action": "Pause all campaigns below 1.5x ROAS and reallocate that spend to proven performers.",
        })

    if ctr >= 2.0 and impressions > 1000:
        insights.append({
            "type": "success", "metric": "CTR",
            "title": f"{ctr:.1f}% CTR — Creative is Working",
            "insight": f"Average CTR of {ctr:.2f}% exceeds the 2% social benchmark — your ad creative is resonating with audiences.",
            "action": "Scale winning ad sets and test small variations on hooks and visuals to find further gains.",
        })
    elif ctr < 0.5 and impressions > 5000:
        insights.append({
            "type": "warning", "metric": "CTR",
            "title": f"{ctr:.2f}% CTR — Creative Fatigue",
            "insight": f"CTR of {ctr:.2f}% across {impressions:,} impressions is well below the 1-2% industry average. Creative may be stale.",
            "action": "Test 3-5 new ad variations with different headlines, visuals, and calls-to-action.",
        })

    if spend > 0 and revenue > spend:
        profit = revenue - spend
        insights.append({
            "type": "success", "metric": "Revenue",
            "title": f"Profitable — ${profit:,.0f} Gross Margin",
            "insight": f"${revenue:,.0f} revenue on ${spend:,.0f} spend generates ${profit:,.0f} gross margin before operating costs.",
            "action": "Identify the top 20% of campaigns by revenue and concentrate scaling efforts there first.",
        })

    if clicks > 0 and conversions == 0 and spend > 50:
        insights.append({
            "type": "danger", "metric": "Conversions",
            "title": "Zero Conversions — Tracking Issue Likely",
            "insight": f"${spend:,.0f} spent and {clicks:,} clicks recorded but zero conversions tracked. Either tracking is broken or campaigns need a full review.",
            "action": "Verify your conversion pixel or tag is firing on thank-you/confirmation pages before making other changes.",
        })
    elif clicks > 100 and conversions > 0:
        cvr = conversions / clicks * 100
        if cvr < 1.0:
            insights.append({
                "type": "warning", "metric": "CVR",
                "title": f"{cvr:.1f}% Conv. Rate — Landing Page Gap",
                "insight": f"{conversions:,} conversions from {clicks:,} clicks ({cvr:.2f}% CVR). The ads are generating traffic but the landing page isn't closing.",
                "action": "A/B test the landing page headline, CTA button, and page load speed to recover this traffic.",
            })

    active = [c for c in campaigns if c.get("status") == "active"]
    if active:
        top = max(active, key=lambda c: c.get("roas", 0))
        if top.get("roas", 0) > 0:
            insights.append({
                "type": "info", "metric": "Top Campaign",
                "title": f"{top['campaign_name']} is Leading",
                "insight": f"Highest-ROAS active campaign with {top['roas']:.2f}x return and ${top.get('revenue', 0):,.0f} revenue in the period.",
                "action": "Prioritise this campaign for additional budget when scaling — it has the strongest proven return.",
            })

    return insights[:6]


def _rule_based_opportunities(campaigns: list[dict], totals: dict) -> list[dict]:
    """Deterministic opportunity generator — runs when AI is unavailable."""
    opps = []
    # Only analyse active campaigns — paused/ended campaigns skew the recommendations
    active = [c for c in campaigns if c.get("status") == "active"]
    if not active:
        active = campaigns  # fallback: use all if none are marked active

    # Identify scale candidates (high ROAS, low budget)
    for c in sorted(active, key=lambda x: x["roas"], reverse=True):
        if c["roas"] >= 4.0 and (c.get("daily_budget") or 0) < 200 and c["spend"] > 0:
            monthly_revenue = c["revenue"] * (30 / max(totals.get("days", 30), 1))
            opps.append({
                "id": f"scale-{c['campaign_id']}",
                "type": "scale",
                "title": f"Scale {c['campaign_name']} — {c['roas']:.1f}x ROAS",
                "description": (
                    f"{c['campaign_name']} is returning {c['roas']:.2f}x ROAS on ${c['spend']:.2f} spend. "
                    f"Increasing daily budget by 20-30% should yield proportional revenue gains. "
                    f"Current daily budget of ${c.get('daily_budget', 0) or 0:.0f} is leaving profitable inventory on the table."
                ),
                "campaign": c["campaign_name"],
                "expected_impact": f"+${monthly_revenue * 0.25:.0f}/month revenue",
                "confidence": "high",
                "effort": "low",
            })
        if len(opps) >= 2:
            break

    # Identify pause candidates (zero conversions + meaningful spend) — active only
    for c in active:
        if c["conversions"] == 0 and c["spend"] > 50:
            opps.append({
                "id": f"pause-{c['campaign_id']}",
                "type": "pause",
                "title": f"Pause {c['campaign_name']} — No Conversions",
                "description": (
                    f"${c['spend']:.2f} spent with zero conversions recorded. "
                    f"This campaign is burning budget without measurable return. "
                    f"Pausing it immediately stops waste and frees budget for performing campaigns."
                ),
                "campaign": c["campaign_name"],
                "expected_impact": f"Save ${c['spend']:.0f} in wasted spend",
                "confidence": "high",
                "effort": "low",
            })

    # Creative refresh candidates (low CTR + significant impressions) — active only
    for c in active:
        if c["ctr"] < 0.5 and c["impressions"] > 5000 and c["spend"] > 20:
            opps.append({
                "id": f"creative-{c['campaign_id']}",
                "type": "creative_refresh",
                "title": f"Refresh Creative on {c['campaign_name']}",
                "description": (
                    f"CTR of {c['ctr']:.2f}% across {c['impressions']:,} impressions signals creative fatigue or poor-fit audience. "
                    f"Test 3-5 new ad variations with different hooks and visuals. "
                    f"Industry average CTR is 1-2% — there's significant room to improve."
                ),
                "campaign": c["campaign_name"],
                "expected_impact": "+30-60% CTR with refreshed creative",
                "confidence": "medium",
                "effort": "medium",
            })

    # Budget shift opportunity (losers → winners) — active only
    top = [c for c in active if c["roas"] >= 3.0 and c["spend"] > 0]
    bottom = [c for c in active if c["roas"] < 1.5 and c["spend"] > 50]
    if top and bottom:
        total_waste = sum(c["spend"] for c in bottom)
        avg_top_roas = sum(c["roas"] for c in top) / len(top)
        opps.append({
            "id": "budget-shift",
            "type": "budget_shift",
            "title": f"Shift Budget from Weak to Strong Campaigns",
            "description": (
                f"${total_waste:.2f}/period is going to {len(bottom)} campaign(s) with ROAS below 1.5x. "
                f"Reallocating to {len(top)} high-performer(s) averaging {avg_top_roas:.1f}x ROAS would significantly improve overall account efficiency. "
                f"Reduce budget on underperformers by 50% and redirect to your top campaigns."
            ),
            "campaign": None,
            "expected_impact": f"+{(avg_top_roas - 1) * 15:.0f}% account revenue with same total spend",
            "confidence": "medium",
            "effort": "low",
        })

    # Landing page opportunity (high CTR, low CVR) — active only
    for c in active:
        if c["ctr"] >= 2.0 and c["clicks"] > 0 and c["conversions"] > 0:
            cvr = c["conversions"] / c["clicks"] * 100
            if cvr < 1.0:
                opps.append({
                    "id": f"landing-{c['campaign_id']}",
                    "type": "audience",
                    "title": f"Landing Page Opportunity on {c['campaign_name']}",
                    "description": (
                        f"Strong CTR of {c['ctr']:.2f}% but only {cvr:.2f}% conversion rate ({c['conversions']} conversions from {c['clicks']:,} clicks). "
                        f"The ad is working — the landing page isn't converting. "
                        f"A/B test the headline, CTA placement, and page load speed to recover this traffic."
                    ),
                    "campaign": c["campaign_name"],
                    "expected_impact": "+2-4x conversions from existing ad spend",
                    "confidence": "high",
                    "effort": "medium",
                })

    if not opps:
        opps.append({
            "id": "healthy-account",
            "type": "scale",
            "title": "Account Performing Within Normal Range",
            "description": (
                "No critical issues detected in active campaigns. "
                "Continue monitoring CTR, ROAS, and CPA. "
                "Consider A/B testing ad creative every 2-3 weeks to prevent performance decay."
            ),
            "campaign": None,
            "expected_impact": "Maintain current performance",
            "confidence": "high",
            "effort": "low",
        })

    return opps[:5]


@router.get("")
async def get_insights(
    days: int = 30,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns, totals = await _build_campaign_data(db, current_user.id, days, platform, account_id, start_date, end_date)

    if not campaigns:
        return {"insights": [], "totals": totals, "message": "No data available. Sync your ad accounts first."}

    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)

    if not svc._is_configured():
        return {"insights": _rule_based_insights(campaigns, totals), "totals": totals}

    try:
        insights = await svc.generate_performance_insights(campaigns, totals)
    except Exception:
        return {"insights": _rule_based_insights(campaigns, totals), "totals": totals}

    return {"insights": insights, "totals": totals}


@router.get("/health")
async def get_health_score(
    days: int = 30,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns, totals = await _build_campaign_data(db, current_user.id, days, platform, account_id, start_date, end_date)

    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)

    health = svc.calculate_health_score(campaigns, totals)
    return {"health": health, "totals": totals}


@router.post("/audit")
async def run_audit(
    days: int = 30,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns, totals = await _build_campaign_data(db, current_user.id, days, platform, account_id, start_date, end_date)

    if not campaigns:
        return {"error": "No campaign data found. Sync your ad accounts before running an audit."}

    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)

    if not svc._is_configured():
        return {"error": "AI provider not configured. Add your Anthropic API key in Settings → AI Services."}

    try:
        audit = await svc.generate_account_audit(campaigns, totals, platform or "all")
    except Exception as e:
        return {"error": str(e)}

    return {"audit": audit, "generated_at": date.today().isoformat()}


@router.get("/opportunities")
async def get_opportunities(
    days: int = 30,
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns, totals = await _build_campaign_data(db, current_user.id, days, platform, account_id, start_date, end_date)

    if not campaigns:
        return {"opportunities": [], "message": "No data available. Sync your ad accounts first."}

    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)

    try:
        opportunities = await svc.generate_opportunities(campaigns, totals)
    except Exception:
        # Fall back to deterministic rule-based opportunities — always useful
        opportunities = _rule_based_opportunities(campaigns, totals)

    return {"opportunities": opportunities, "totals": totals}
