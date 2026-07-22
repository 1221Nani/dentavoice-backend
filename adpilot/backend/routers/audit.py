from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import AuditResult, User
from services import AnthropicService, GoogleAdsService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/audit", tags=["audit"])

SKILLS = {
    "rank_vs_budget_diagnosis": {
        "name": "Rank vs. Budget Diagnosis",
        "description": "Finds Search campaigns losing impression share to weak Ad Rank vs a capped budget.",
        "tier": 1,
    },
    "tracking_health_check": {
        "name": "Tracking Health Check",
        "description": "Flags campaigns spending with zero recorded conversions — a likely tracking gap. Heuristic pass, not a full GA4 audit.",
        "tier": 1,
    },
    "wasted_spend_finder": {
        "name": "Wasted Spend Finder",
        "description": "Surfaces search terms burning budget with zero conversions across all campaigns.",
        "tier": 2,
    },
    "shopping_negative_term_catcher": {
        "name": "Shopping Negative Term Catcher",
        "description": "Finds irrelevant search terms leaking into Shopping/PMax campaigns.",
        "tier": 2,
    },
    "rsa_ad_copy_grader": {
        "name": "RSA Ad Copy Grader",
        "description": "Grades Responsive Search Ads using Google's ad strength and per-asset performance labels.",
        "tier": 2,
    },
    "product_scale_or_kill_grader": {
        "name": "Product Scale-or-Kill Grader",
        "description": "Recommends scale, hold, or kill for each Shopping product based on spend and ROAS.",
        "tier": 3,
    },
    "pmax_vs_search_scorecard": {
        "name": "PMax vs. Search Scorecard",
        "description": "Compares Performance Max and Search efficiency side by side.",
        "tier": 3,
    },
    "pmax_creative_asset_grader": {
        "name": "PMax Creative Asset Grader",
        "description": "Grades Performance Max asset groups by per-asset performance label.",
        "tier": 3,
    },
    "buyer_intent_keyword_filter": {
        "name": "Buyer-Intent Keyword Filter",
        "description": "Researches new keyword ideas and filters for genuine buyer intent. Requires seed keywords or a landing page URL.",
        "tier": 4,
        "requires_input": True,
    },
}


class AuditRunRequest(BaseModel):
    date_range: str = "LAST_30_DAYS"
    seed_keywords: Optional[list[str]] = None
    landing_page_url: Optional[str] = None
    geo_target_ids: Optional[list[str]] = None


def _micros(v) -> float:
    return round(int(v or 0) / 1_000_000, 4)


def _transform_search_terms(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        stv = row.get("searchTermView", {})
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        out.append({
            "search_term": stv.get("searchTerm", ""),
            "campaign_name": c.get("name", ""),
            "channel_type": c.get("advertisingChannelType", ""),
            "cost": _micros(m.get("costMicros")),
            "clicks": int(m.get("clicks") or 0),
            "conversions": float(m.get("conversions") or 0),
        })
    return out


def _transform_rsa_assets(rows: list[dict]) -> list[dict]:
    """Groups per-asset rows back up to one entry per ad, tallying how many
    assets landed in each performance_label bucket."""
    by_ad: dict = {}
    for row in rows:
        c = row.get("campaign", {})
        ag = row.get("adGroup", {})
        gad = row.get("adGroupAd", {})
        ad = gad.get("ad", {})
        view = row.get("adGroupAdAssetView", {})
        key = (c.get("name", ""), ag.get("name", ""), ad.get("id"))
        if key not in by_ad:
            by_ad[key] = {
                "campaign_name": c.get("name", ""),
                "ad_group_name": ag.get("name", ""),
                "ad_strength": gad.get("adStrength", "UNKNOWN"),
                "asset_labels": {},
            }
        label = view.get("performanceLabel", "UNRATED")
        by_ad[key]["asset_labels"][label] = by_ad[key]["asset_labels"].get(label, 0) + 1
    return list(by_ad.values())


def _transform_shopping_performance(rows: list[dict]) -> list[dict]:
    by_product: dict = {}
    for row in rows:
        seg = row.get("segments", {})
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        pid = seg.get("productItemId", "unknown")
        if pid not in by_product:
            by_product[pid] = {
                "product_item_id": pid,
                "product_title": seg.get("productTitle", pid),
                "campaign_name": c.get("name", ""),
                "cost": 0.0, "clicks": 0, "conversions": 0.0, "conversions_value": 0.0,
            }
        by_product[pid]["cost"] += _micros(m.get("costMicros"))
        by_product[pid]["clicks"] += int(m.get("clicks") or 0)
        by_product[pid]["conversions"] += float(m.get("conversions") or 0)
        by_product[pid]["conversions_value"] += float(m.get("conversionsValue") or 0)
    products = list(by_product.values())
    for p in products:
        p["cost"] = round(p["cost"], 2)
        p["conversions_value"] = round(p["conversions_value"], 2)
        p["roas"] = round(p["conversions_value"] / p["cost"], 2) if p["cost"] else 0
    products.sort(key=lambda p: p["cost"], reverse=True)
    return products


def _transform_channel_split(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        out.append({
            "campaign_name": c.get("name", ""),
            "channel_type": c.get("advertisingChannelType", ""),
            "cost": _micros(m.get("costMicros")),
            "conversions": float(m.get("conversions") or 0),
            "conversions_value": float(m.get("conversionsValue") or 0),
        })
    return out


def _transform_asset_groups(rows: list[dict]) -> list[dict]:
    by_group: dict = {}
    for row in rows:
        c = row.get("campaign", {})
        ag = row.get("assetGroup", {})
        aga = row.get("assetGroupAsset", {})
        gid = ag.get("id")
        if gid not in by_group:
            by_group[gid] = {
                "campaign_name": c.get("name", ""),
                "asset_group_name": ag.get("name", ""),
                "asset_labels": {},
            }
        label = aga.get("performanceLabel", "UNRATED")
        by_group[gid]["asset_labels"][label] = by_group[gid]["asset_labels"].get(label, 0) + 1
    return list(by_group.values())


# ---------------------------------------------------------------------------
# Deterministic rule-based fallbacks — one per skill, mirroring the pattern in
# optimizer.py/insights.py. Every skill must produce useful output even when
# the AI call fails or ANTHROPIC_API_KEY has no credits.
# ---------------------------------------------------------------------------

def _rule_rank_vs_budget(campaigns: list[dict]):
    findings = []
    for c in campaigns:
        rank_lost = c["rank_lost_pct"]
        budget_lost = c["budget_lost_pct"]
        if rank_lost >= 10 and budget_lost >= 10:
            diagnosis, rec = "both", "Both Ad Rank and budget are limiting reach — improve ad relevance/bids AND raise budget."
        elif rank_lost >= 10:
            diagnosis, rec = "rank_constrained", "Losing impression share to weak Ad Rank — improve ad relevance, landing page experience, or raise bids."
        elif budget_lost >= 10:
            diagnosis, rec = "budget_constrained", "Losing impression share to a capped budget — increase daily budget to capture more volume."
        else:
            diagnosis, rec = "healthy", "Impression share loss is minimal — no action needed."
        findings.append({**c, "diagnosis": diagnosis, "recommendation": rec})
    avg_rank_lost = sum(c["rank_lost_pct"] for c in campaigns) / len(campaigns)
    summary = f"Analyzed {len(campaigns)} Search campaign(s) with impression-share data. Average rank-lost impression share: {avg_rank_lost:.1f}%."
    return {"summary": summary}, findings


def _rule_wasted_spend(wasted: list[dict]):
    total = sum(t["cost"] for t in wasted)
    findings = [{**t, "reason": "Meaningful spend with zero conversions recorded.", "recommended_action": "monitor"} for t in wasted[:50]]
    summary = f"{len(wasted)} search term(s) totaling ${total:.2f} spend with zero conversions. Review for negative-keyword candidates."
    return {"summary": summary, "total_wasted_spend": round(total, 2)}, findings


def _rule_shopping_negative_terms(terms: list[dict]):
    findings = [
        {**t, "reason": "Shopping/PMax term with spend and no conversions — verify it matches the product catalog.", "recommended_action": "monitor"}
        for t in terms[:30] if t["conversions"] == 0
    ]
    summary = f"{len(findings)} Shopping/PMax search term(s) flagged for manual relevance review."
    return {"summary": summary}, findings


def _rule_rsa_grader(ads: list[dict]):
    findings = []
    for a in ads:
        low = a["asset_labels"].get("LOW", 0)
        rec = f"{low} asset(s) rated LOW — replace with new headline/description variants." if low else "No LOW-rated assets — ad copy is performing acceptably."
        findings.append({
            "campaign_name": a["campaign_name"],
            "ad_group_name": a["ad_group_name"],
            "ad_strength": a["ad_strength"],
            "low_performing_asset_count": low,
            "recommendation": rec,
        })
    weak = [a for a in ads if a["ad_strength"] in ("POOR", "AVERAGE")]
    summary = f"Graded {len(ads)} ad(s). {len(weak)} have POOR or AVERAGE ad strength and need copy work."
    return {"summary": summary}, findings


def _rule_shopping_grader(products: list[dict]):
    findings = []
    for p in products[:100]:
        if p["cost"] > 20 and p["conversions"] == 0:
            verdict, reasoning = "kill", "Meaningful spend with zero conversions."
        elif p["roas"] >= 3:
            verdict, reasoning = "scale", f"Strong ROAS of {p['roas']:.1f}x."
        elif 0 < p["roas"] < 1.5 and p["cost"] > 10:
            verdict, reasoning = "kill", f"ROAS of {p['roas']:.1f}x is below break-even."
        else:
            verdict, reasoning = "hold", "Performance is within a normal range — keep monitoring."
        findings.append({**p, "verdict": verdict, "reasoning": reasoning})
    scale = sum(1 for f in findings if f["verdict"] == "scale")
    kill = sum(1 for f in findings if f["verdict"] == "kill")
    summary = f"Graded {len(findings)} product(s): {scale} to scale, {kill} to kill."
    return {"summary": summary}, findings


def _rule_pmax_scorecard(campaigns: list[dict]):
    def totals_for(channel):
        subset = [c for c in campaigns if c["channel_type"] == channel]
        cost = sum(c["cost"] for c in subset)
        conv = sum(c["conversions"] for c in subset)
        value = sum(c["conversions_value"] for c in subset)
        return {"spend": round(cost, 2), "conversions": round(conv, 1), "roas": round(value / cost, 2) if cost else 0}

    search_totals = totals_for("SEARCH")
    pmax_totals = totals_for("PERFORMANCE_MAX")
    if search_totals["roas"] > pmax_totals["roas"]:
        rec = "Search is more efficient — hold or trim PMax budget in favor of Search."
    elif pmax_totals["roas"] > search_totals["roas"]:
        rec = "PMax is more efficient — consider shifting incremental budget from Search to PMax."
    else:
        rec = "Search and PMax are performing comparably."
    summary = f"Search: {search_totals['roas']:.1f}x ROAS on ${search_totals['spend']:.2f}. PMax: {pmax_totals['roas']:.1f}x ROAS on ${pmax_totals['spend']:.2f}."
    return {"summary": summary, "search_totals": search_totals, "pmax_totals": pmax_totals, "recommendation": rec}, campaigns


def _rule_pmax_asset_grader(groups: list[dict]):
    findings = []
    for g in groups:
        low = g["asset_labels"].get("LOW", 0)
        rec = f"{low} asset(s) rated LOW — swap in fresh creative." if low else "No LOW-rated assets."
        findings.append({
            "campaign_name": g["campaign_name"],
            "asset_group_name": g["asset_group_name"],
            "low_performing_asset_count": low,
            "recommendation": rec,
        })
    summary = f"Graded {len(groups)} asset group(s)."
    return {"summary": summary}, findings


def _rule_buyer_intent_filter(ideas: list[dict]):
    buyer_signals = ["buy", "price", "cost", "near me", "hire", "book", "quote", "service", "for sale", "best"]
    info_signals = ["how to", "what is", "diy", "guide", "tutorial", " vs ", "meaning"]
    findings = []
    for idea in ideas[:150]:
        text = (idea.get("text") or "").lower()
        if any(s in text for s in info_signals):
            intent = "informational"
        elif any(s in text for s in buyer_signals):
            intent = "buyer"
        else:
            intent = "navigational"
        findings.append({**idea, "intent": intent, "reasoning": "Keyword-pattern heuristic (AI unavailable)."})
    findings.sort(key=lambda f: (f["intent"] != "buyer", -(f.get("avg_monthly_searches") or 0)))
    buyer_count = sum(1 for f in findings if f["intent"] == "buyer")
    summary = f"{buyer_count} of {len(findings)} keyword ideas show buyer-intent signals."
    return {"summary": summary}, findings


# ---------------------------------------------------------------------------
# Per-skill handlers — fetch live Google Ads data, transform it, try the AI
# analysis, fall back to the deterministic rule above on any failure.
# ---------------------------------------------------------------------------

async def _run_rank_vs_budget_diagnosis(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_campaign_diagnostics(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    campaigns = []
    for row in res.get("data", []):
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        if c.get("advertisingChannelType") != "SEARCH":
            continue
        impr_share = m.get("searchImpressionShare")
        if impr_share is None:
            continue
        campaigns.append({
            "campaign_name": c.get("name", ""),
            "impression_share_pct": round(float(impr_share) * 100, 2),
            "rank_lost_pct": round(float(m.get("searchRankLostImpressionShare") or 0) * 100, 2),
            "budget_lost_pct": round(float(m.get("searchBudgetLostImpressionShare") or 0) * 100, 2),
            "cost": _micros(m.get("costMicros")),
            "conversions": float(m.get("conversions") or 0),
        })
    if not campaigns:
        return {"summary": "No Search campaigns with impression-share data found for this date range."}, []
    try:
        analysis = await ai.generate_rank_budget_analysis(campaigns)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_rank_vs_budget(campaigns)


async def _run_tracking_health_check(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_campaign_metrics(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    by_campaign: dict = {}
    for row in res.get("data", []):
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        cid = c.get("id")
        if cid not in by_campaign:
            by_campaign[cid] = {"campaign_name": c.get("name", ""), "clicks": 0, "cost": 0.0, "conversions": 0.0}
        by_campaign[cid]["clicks"] += int(m.get("clicks") or 0)
        by_campaign[cid]["cost"] += _micros(m.get("costMicros"))
        by_campaign[cid]["conversions"] += float(m.get("conversions") or 0)

    findings = []
    for c in by_campaign.values():
        if c["clicks"] >= 20 and c["conversions"] == 0 and c["cost"] > 10:
            findings.append({
                "campaign_name": c["campaign_name"],
                "clicks": c["clicks"],
                "cost": round(c["cost"], 2),
                "issue": "Zero conversions recorded despite meaningful click volume and spend — likely a broken or missing conversion tag, not genuinely zero conversions.",
                "recommended_action": "Verify the conversion action is firing on the confirmation/thank-you page using Google Tag Assistant or GA4 DebugView.",
            })
    if findings:
        summary = f"Checked {len(by_campaign)} campaign(s). {len(findings)} show spend and clicks with zero tracked conversions — a likely tracking gap."
    else:
        summary = f"Checked {len(by_campaign)} campaign(s). No zero-conversion-with-spend patterns found."
    disclaimer = (
        "This is a heuristic pass (spend-with-zero-conversions detection), not a full GA4/conversion-action audit — "
        "deep tag-level verification is a planned future enhancement."
    )
    return {"summary": summary, "disclaimer": disclaimer}, findings


async def _run_wasted_spend_finder(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_search_terms(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    terms = _transform_search_terms(res.get("data", []))
    wasted = sorted((t for t in terms if t["cost"] > 5 and t["conversions"] == 0), key=lambda t: t["cost"], reverse=True)
    if not wasted:
        return {"summary": "No search terms found with meaningful spend and zero conversions."}, []
    try:
        analysis = await ai.generate_wasted_spend_analysis(wasted)
        return {"summary": analysis.get("summary", ""), "total_wasted_spend": analysis.get("total_wasted_spend")}, analysis.get("findings", [])
    except Exception:
        return _rule_wasted_spend(wasted)


async def _run_shopping_negative_term_catcher(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_search_terms(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    terms = _transform_search_terms(res.get("data", []))
    shopping_terms = sorted(
        (t for t in terms if t["channel_type"] in ("SHOPPING", "PERFORMANCE_MAX") and t["cost"] > 0),
        key=lambda t: t["cost"], reverse=True,
    )
    if not shopping_terms:
        return {"summary": "No Shopping/PMax search terms found for this date range."}, []
    try:
        analysis = await ai.generate_negative_term_analysis(shopping_terms)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_shopping_negative_terms(shopping_terms)


async def _run_rsa_ad_copy_grader(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_rsa_asset_performance()
    if res.get("error"):
        raise ValueError(res["error"])
    ads = _transform_rsa_assets(res.get("data", []))
    if not ads:
        return {"summary": "No active Responsive Search Ads found."}, []
    try:
        analysis = await ai.generate_rsa_grade_analysis(ads)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_rsa_grader(ads)


async def _run_product_scale_or_kill_grader(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_shopping_performance(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    products = _transform_shopping_performance(res.get("data", []))
    if not products:
        return {"summary": "No Shopping product performance data found for this date range."}, []
    try:
        analysis = await ai.generate_shopping_grade_analysis(products)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_shopping_grader(products)


async def _run_pmax_vs_search_scorecard(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_campaign_diagnostics(payload.date_range)
    if res.get("error"):
        raise ValueError(res["error"])
    campaigns = _transform_channel_split(res.get("data", []))
    if not campaigns:
        return {"summary": "No campaign data found for this date range."}, []
    try:
        analysis = await ai.generate_pmax_search_scorecard(campaigns)
        return {
            "summary": analysis.get("summary", ""),
            "search_totals": analysis.get("search_totals"),
            "pmax_totals": analysis.get("pmax_totals"),
            "recommendation": analysis.get("recommendation"),
        }, campaigns
    except Exception:
        return _rule_pmax_scorecard(campaigns)


async def _run_pmax_creative_asset_grader(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    res = await google.get_asset_group_assets()
    if res.get("error"):
        raise ValueError(res["error"])
    groups = _transform_asset_groups(res.get("data", []))
    if not groups:
        return {"summary": "No Performance Max asset groups found."}, []
    try:
        analysis = await ai.generate_pmax_asset_grade(groups)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_pmax_asset_grader(groups)


async def _run_buyer_intent_keyword_filter(google: GoogleAdsService, ai: AnthropicService, payload: AuditRunRequest):
    seeds = payload.seed_keywords or []
    res = await google.generate_keyword_ideas(seeds, landing_page_url=payload.landing_page_url, geo_target_ids=payload.geo_target_ids)
    if res.get("error"):
        raise ValueError(res["error"])
    ideas = res.get("data", [])
    if not ideas:
        return {"summary": "No keyword ideas returned — try different seed keywords or a landing page URL."}, []
    try:
        analysis = await ai.generate_buyer_intent_filter(ideas)
        return {"summary": analysis.get("summary", "")}, analysis.get("findings", [])
    except Exception:
        return _rule_buyer_intent_filter(ideas)


_SKILL_HANDLERS = {
    "rank_vs_budget_diagnosis": _run_rank_vs_budget_diagnosis,
    "tracking_health_check": _run_tracking_health_check,
    "wasted_spend_finder": _run_wasted_spend_finder,
    "shopping_negative_term_catcher": _run_shopping_negative_term_catcher,
    "rsa_ad_copy_grader": _run_rsa_ad_copy_grader,
    "product_scale_or_kill_grader": _run_product_scale_or_kill_grader,
    "pmax_vs_search_scorecard": _run_pmax_vs_search_scorecard,
    "pmax_creative_asset_grader": _run_pmax_creative_asset_grader,
    "buyer_intent_keyword_filter": _run_buyer_intent_keyword_filter,
}


def _result_to_dict(r: AuditResult) -> dict:
    return {
        "id": r.id,
        "skill": r.skill,
        "platform": r.platform,
        "summary": r.summary,
        "findings": r.findings,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/skills")
async def list_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    connected = bool(settings.get("GOOGLE_ADS_REFRESH_TOKEN") and settings.get("GOOGLE_ADS_CUSTOMER_ID"))
    return {"skills": [{"id": skill_id, "connected": connected, **meta} for skill_id, meta in SKILLS.items()]}


@router.get("/results")
async def list_results(
    skill: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditResult).where(AuditResult.user_id == current_user.id)
    if skill:
        query = query.where(AuditResult.skill == skill)
    query = query.order_by(AuditResult.created_at.desc()).limit(50)
    result = await db.execute(query)
    return [_result_to_dict(r) for r in result.scalars().all()]


@router.get("/results/{result_id}")
async def get_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditResult).where(AuditResult.id == result_id, AuditResult.user_id == current_user.id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Audit result not found")
    return _result_to_dict(r)


@router.post("/{skill}/run")
async def run_skill(
    skill: str,
    payload: AuditRunRequest = AuditRunRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if skill not in SKILLS:
        raise HTTPException(status_code=404, detail=f"Unknown audit skill: {skill}")

    settings = await get_user_settings_dict(db, current_user.id)
    google = GoogleAdsService(settings=settings)
    ai = AnthropicService(settings=settings)

    if not google._is_configured():
        raise HTTPException(status_code=400, detail="Google Ads not connected. Connect it in Settings before running an audit.")

    handler = _SKILL_HANDLERS[skill]
    try:
        summary, findings = await handler(google, ai, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    row = AuditResult(
        user_id=current_user.id,
        campaign_id=None,
        skill=skill,
        platform="google",
        summary=summary,
        findings=findings,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _result_to_dict(row)
