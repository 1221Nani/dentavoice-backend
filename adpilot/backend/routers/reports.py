from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from database import get_db
from models import Campaign, PerformanceMetric, User
from auth import get_current_user
from services import AnthropicService
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _rule_based_narration(totals: dict, campaign_breakdown: list[dict], period: str) -> dict:
    """Deterministic report narration — runs when AI is unavailable."""
    spend = totals.get("spend", 0)
    revenue = totals.get("revenue", 0)
    roas = totals.get("roas", 0)
    ctr = totals.get("ctr", 0)
    conversions = totals.get("conversions", 0)
    cpa = totals.get("cpa", 0)
    clicks = totals.get("clicks", 0)

    roas_label = (
        "outstanding" if roas >= 5 else
        "strong" if roas >= 3 else
        "acceptable" if roas >= 2 else
        "below break-even" if roas >= 1 else
        "negative"
    )
    ctr_label = (
        "excellent" if ctr >= 3 else
        "good" if ctr >= 2 else
        "average" if ctr >= 1 else
        "below average"
    )

    top = max(campaign_breakdown, key=lambda c: c.get("roas", 0), default=None) if campaign_breakdown else None
    worst = min(campaign_breakdown, key=lambda c: c.get("roas", 0), default=None) if campaign_breakdown else None

    concern = None
    if roas < 1:
        concern = f"Account ROAS of {roas:.2f}x is negative — spending more than earning. Immediate review of all campaigns required."
    elif ctr < 0.5:
        concern = f"Average CTR of {ctr:.2f}% is below 0.5% — ad creative is significantly underperforming industry benchmarks."
    elif worst and worst.get("conversions", 0) == 0 and worst.get("spend", 0) > 50:
        concern = f"{worst['campaign_name']} spent ${worst.get('spend', 0):.2f} with zero conversions — recommend pausing immediately."

    if roas >= 3:
        recommendation = f"Scale budgets on top-performing campaigns by 20-30% while ROAS stays above 3x to maximize revenue growth."
    elif conversions == 0:
        recommendation = "Verify conversion tracking is correctly set up — no conversions recorded despite ad spend. Check pixel/tag implementation."
    elif roas < 1.5:
        recommendation = f"Pause campaigns below 1.5x ROAS and reallocate that budget to campaigns with proven conversion history."
    else:
        recommendation = f"Focus on landing page optimization to improve the {clicks:,} click → {conversions:,} conversion rate and lift overall ROAS."

    return {
        "headline": f"Account delivered ${revenue:.2f} revenue on ${spend:.2f} spend ({roas:.2f}x ROAS) for {period}.",
        "spend_narrative": (
            f"Total spend of ${spend:.2f} returned {roas:.2f}x ROAS, which is {roas_label}. "
            + ("Continue scaling — returns are healthy." if roas >= 3 else "Improve conversion efficiency before increasing spend.")
        ),
        "revenue_narrative": (
            f"Revenue of ${revenue:.2f} represents a {roas:.2f}x return on investment. "
            + ("Strong returns — identify top campaigns for further scaling." if roas >= 3 else "Below-target returns — review audience targeting and landing pages.")
        ),
        "ctr_narrative": (
            f"Average CTR of {ctr:.2f}% is {ctr_label}. "
            + ("Creative is resonating well with the target audience." if ctr >= 2 else "Test new creative variations and ad formats to improve click-through rates.")
        ),
        "conversion_narrative": (
            f"{conversions:,} conversions recorded"
            + (f" at ${cpa:.2f} CPA." if cpa else ".")
            + (" Efficient acquisition — scale what's working." if cpa and roas >= 2 else " Review the full funnel from ad to landing page to checkout." if conversions > 0 else " Ensure conversion tracking is properly implemented.")
        ),
        "top_performer": (
            f"{top['campaign_name']} led the account with {top.get('roas', 0):.2f}x ROAS and ${top.get('revenue', 0):.2f} revenue."
            if top else "No campaign breakdown available for this period."
        ),
        "concern": concern,
        "recommendation": recommendation,
    }


class ReportRequest(BaseModel):
    title: str
    start_date: str
    end_date: str
    platform: Optional[str] = None
    campaign_ids: Optional[list[int]] = None
    metrics: list[str] = ["spend", "revenue", "impressions", "clicks", "conversions", "roas", "ctr"]
    chart_type: str = "line"
    group_by: str = "day"
    narrate: bool = False


@router.post("/generate")
async def generate_report(
    payload: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PerformanceMetric).where(
        PerformanceMetric.user_id == current_user.id,
        PerformanceMetric.date >= payload.start_date,
        PerformanceMetric.date <= payload.end_date,
    )
    if payload.platform:
        q = q.where(PerformanceMetric.platform == payload.platform)
    if payload.campaign_ids:
        q = q.where(PerformanceMetric.campaign_id.in_(payload.campaign_ids))

    result = await db.execute(q.order_by(PerformanceMetric.date))
    metrics = result.scalars().all()

    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == current_user.id)
    )
    campaigns = {c.id: c.name for c in campaigns_result.scalars().all()}

    daily_data = {}
    for m in metrics:
        key = m.date
        if payload.group_by == "week":
            d = date.fromisoformat(m.date)
            key = (d - timedelta(days=d.weekday())).isoformat()
        elif payload.group_by == "month":
            key = m.date[:7]

        if key not in daily_data:
            daily_data[key] = {
                "period": key,
                "impressions": 0, "clicks": 0, "conversions": 0,
                "spend": 0.0, "revenue": 0.0,
            }
        daily_data[key]["impressions"] += m.impressions
        daily_data[key]["clicks"] += m.clicks
        daily_data[key]["conversions"] += m.conversions
        daily_data[key]["spend"] += m.spend
        daily_data[key]["revenue"] += m.revenue

    chart_data = []
    for d in sorted(daily_data.values(), key=lambda x: x["period"]):
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["roas"] = round(d["revenue"] / d["spend"], 2) if d["spend"] else 0
        d["ctr"] = round(d["clicks"] / d["impressions"] * 100, 2) if d["impressions"] else 0
        d["cpc"] = round(d["spend"] / d["clicks"], 2) if d["clicks"] else 0
        d["cpa"] = round(d["spend"] / d["conversions"], 2) if d["conversions"] else 0
        row = {"period": d["period"]}
        for metric in payload.metrics:
            row[metric] = d.get(metric, 0)
        chart_data.append(row)

    totals = {
        "impressions": sum(r.get("impressions", 0) for r in chart_data),
        "clicks": sum(r.get("clicks", 0) for r in chart_data),
        "conversions": sum(r.get("conversions", 0) for r in chart_data),
        "spend": round(sum(r.get("spend", 0) for r in chart_data), 2),
        "revenue": round(sum(r.get("revenue", 0) for r in chart_data), 2),
    }
    if totals["spend"]:
        totals["roas"] = round(totals["revenue"] / totals["spend"], 2)
        totals["cpa"] = round(totals["spend"] / totals["conversions"], 2) if totals["conversions"] else 0
    if totals["impressions"]:
        totals["ctr"] = round(totals["clicks"] / totals["impressions"] * 100, 2)

    per_campaign = {}
    for m in metrics:
        cid = m.campaign_id
        cname = campaigns.get(cid, f"Campaign {cid}")
        if cid not in per_campaign:
            per_campaign[cid] = {
                "campaign_id": cid, "campaign_name": cname,
                "spend": 0, "revenue": 0, "clicks": 0, "impressions": 0, "conversions": 0,
            }
        per_campaign[cid]["spend"] += m.spend
        per_campaign[cid]["revenue"] += m.revenue
        per_campaign[cid]["clicks"] += m.clicks
        per_campaign[cid]["impressions"] += m.impressions
        per_campaign[cid]["conversions"] += m.conversions

    campaign_breakdown = []
    for d in per_campaign.values():
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["roas"] = round(d["revenue"] / d["spend"], 2) if d["spend"] else 0
        d["ctr"] = round(d["clicks"] / d["impressions"] * 100, 2) if d["impressions"] else 0
        campaign_breakdown.append(d)

    narration = None
    if payload.narrate:
        settings = await get_user_settings_dict(db, current_user.id)
        svc = AnthropicService(settings=settings)
        period = f"{payload.start_date} to {payload.end_date}"
        try:
            narration = await svc.generate_report_narration(totals, chart_data, campaign_breakdown, period)
        except Exception:
            narration = _rule_based_narration(totals, campaign_breakdown, period)

    return {
        "title": payload.title,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "platform": payload.platform or "all",
        "chart_type": payload.chart_type,
        "metrics": payload.metrics,
        "chart_data": chart_data,
        "totals": totals,
        "campaign_breakdown": campaign_breakdown,
        "narration": narration,
        "generated_at": date.today().isoformat(),
    }
