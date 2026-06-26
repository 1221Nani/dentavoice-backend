import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import anthropic

from database import get_db
from models import Campaign, PerformanceMetric, User
from auth import get_current_user
from utils import get_user_settings_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = """You are a senior performance marketing AI. Be concise and data-backed.

## Tools
- get_account_overview — fetch campaigns + metrics (always call first)
- get_audience_insights — budget/platform recommendations from historical data
- create_campaign — create a draft campaign
- create_ad_copy — save headlines/descriptions/primary text to Creative Studio
- push_campaign_live — push draft to platform (call after create_campaign)
- pause_campaign / activate_campaign — change campaign status
- update_campaign_budget — adjust daily spend
- get_top_creatives — ad copy history
- search_competitor_ads — Meta Ad Library research

## ROAS benchmarks
<1.5x = pause, 1.5–3x = optimize, 3–5x = scale, >5x = aggressive scale

## Campaign creation workflow
When asked to create or set up a campaign, execute ALL of these steps in order without asking clarifying questions:

1. call get_account_overview — infer the business name and niche from existing campaign names
2. call get_audience_insights — get recommended budget

3. Create Google Search campaign:
   - call create_campaign: platform=google, objective=leads or sales, budget from insights, name format: "Brand-Search-MonthYY" (e.g. "AscendWC-Search-Jun26", max 50 chars — NEVER use the user's message as name)
   - call create_ad_copy: platform=google, campaign_id from above, provide 5 headlines (max 30 chars each) and 2 descriptions (max 90 chars each). Headlines must be specific to the business.

4. Create Meta campaign:
   - call create_campaign: platform=meta, objective=leads or sales, same budget, name format: "Brand-Meta-MonthYY"
   - call create_ad_copy: platform=meta, campaign_id from above, provide primary_text (2-3 sentences about the business), headline (max 40 chars), description (max 30 chars), cta (e.g. "Get a Free Quote")

5. Report back in under 200 words: what was built, the ad copy created, and what to do next (add images in Creative Studio, review copy, push live from Campaigns page when ready)

Keep total response under 250 words."""

TOOLS = [
    {
        "name": "get_account_overview",
        "description": "Fetch all campaigns with complete performance metrics. Call this first when asked to analyze an account.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "pause_campaign",
        "description": "Pause an underperforming campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "Campaign ID to pause"},
                "reason": {"type": "string", "description": "Data-backed reason for pausing"}
            },
            "required": ["campaign_id", "reason"]
        }
    },
    {
        "name": "activate_campaign",
        "description": "Activate or resume a paused campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "Campaign ID to activate"},
                "reason": {"type": "string", "description": "Reason for activating"}
            },
            "required": ["campaign_id", "reason"]
        }
    },
    {
        "name": "update_campaign_budget",
        "description": "Update the daily budget for a campaign — use to scale up winners or cut spend on poor performers.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "Campaign ID"},
                "new_budget": {"type": "number", "description": "New daily budget in USD"},
                "reason": {"type": "string", "description": "Why the budget is changing"}
            },
            "required": ["campaign_id", "new_budget", "reason"]
        }
    },
    {
        "name": "create_campaign",
        "description": "Create a new ad campaign as a draft. Always call push_campaign_live after this to actually push it to Meta or Google Ads.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Campaign name"},
                "platform": {"type": "string", "enum": ["meta", "google"], "description": "Advertising platform: meta (Facebook/Instagram) or google (Google Ads)"},
                "objective": {"type": "string", "enum": ["sales", "leads", "awareness", "traffic", "engagement", "app_installs"], "description": "Campaign objective"},
                "daily_budget": {"type": "number", "description": "Daily budget in USD"},
                "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format (optional)"}
            },
            "required": ["name", "platform", "objective", "daily_budget"]
        }
    },
    {
        "name": "push_campaign_live",
        "description": "Push a draft campaign to Meta or Google Ads so it goes live. Call this after create_campaign to complete the full setup on the platform.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "The campaign ID returned by create_campaign"}
            },
            "required": ["campaign_id"]
        }
    },
    {
        "name": "get_top_creatives",
        "description": "Fetch the saved ad creatives (headlines, ad copy, CTAs) from this account. Use before creating a campaign to understand what messaging has been used.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "search_competitor_ads",
        "description": "Search the Meta Ad Library for competitor ads by keyword (brand name, product, or niche). Use to research competitor messaging and ad angles before building a campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword — use the business type or competitor brand (e.g. 'dental clinic', 'weight loss supplements', 'luxury real estate')"},
                "country": {"type": "string", "description": "Two-letter country code, default US"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_audience_insights",
        "description": "Analyze existing campaign data to recommend optimal budget, platform, and objective for a new campaign based on what has performed best historically.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "create_ad_copy",
        "description": "Save ad copy (headlines, descriptions, primary text) for a campaign. Call this right after create_campaign. For Google Search: provide headlines + descriptions. For Meta: provide primary_text + headline + description + cta.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "Campaign ID from create_campaign"},
                "platform": {"type": "string", "enum": ["google", "meta"], "description": "Platform this copy is for"},
                "headlines": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Google Search only: 3-5 headlines, max 30 chars each. E.g. ['Book a Free Consultation', 'Wellness Experts Near You', 'Trusted by 500+ Clients']"
                },
                "descriptions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Google Search only: 2-3 descriptions, max 90 chars each."
                },
                "primary_text": {"type": "string", "description": "Meta only: main ad body text (2-3 sentences, max 500 chars)"},
                "headline": {"type": "string", "description": "Meta only: headline shown below the image (max 40 chars)"},
                "description": {"type": "string", "description": "Meta only: link description (max 30 chars)"},
                "cta": {"type": "string", "description": "Call to action e.g. 'Learn More', 'Get a Quote', 'Book Now'"}
            },
            "required": ["campaign_id", "platform"]
        }
    }
]


class ChatRequest(BaseModel):
    message: str
    history: Optional[list] = []


async def _deterministic_analysis(message: str, db: AsyncSession, user_id: int) -> str:
    """Rule-based account summary returned when no AI API key is available."""
    data = await run_tool("get_account_overview", {}, db, user_id)
    campaigns = data.get("campaigns", [])

    if not campaigns:
        return (
            "I don't see any campaign data in your account yet.\n\n"
            "To get started:\n"
            "1. Go to the **Performance** page and click **Sync Live Data** to pull your campaigns.\n"
            "2. Or go to **Campaigns** and create a campaign manually.\n\n"
            "Once data is synced, I can analyze your account performance."
        )

    with_data = [c for c in campaigns if "total_spend" in c]
    total_spend = sum(c["total_spend"] for c in with_data)
    total_revenue = sum(c["total_revenue"] for c in with_data)
    total_conversions = sum(c.get("conversions", 0) for c in with_data)
    total_clicks = sum(c.get("clicks", 0) for c in with_data)
    total_impressions = sum(c.get("impressions", 0) for c in with_data)
    account_roas = round(total_revenue / total_spend, 2) if total_spend else 0
    avg_ctr = round(total_clicks / total_impressions * 100, 2) if total_impressions else 0

    active = [c for c in with_data if c.get("status") == "active"]
    paused = [c for c in campaigns if c.get("status") == "paused"]
    top = max(with_data, key=lambda c: c.get("roas", 0)) if with_data else None
    worst = min(with_data, key=lambda c: c.get("roas", 0)) if len(with_data) > 1 else None
    to_scale = [c for c in active if c.get("roas", 0) >= 4.0]
    to_pause = [c for c in active if c.get("roas", 0) < 1.5 and c.get("total_spend", 0) > 50]

    lines = []
    lines.append(f"**Account Overview — {len(campaigns)} campaigns ({len(active)} active, {len(paused)} paused)**\n")
    lines.append(f"Total Spend: **${total_spend:,.2f}** | Revenue: **${total_revenue:,.2f}** | ROAS: **{account_roas:.2f}x** | Avg CTR: **{avg_ctr:.2f}%**")
    if total_conversions:
        cpa = total_spend / total_conversions
        lines.append(f"Conversions: **{total_conversions:,}** | CPA: **${cpa:.2f}**")
    lines.append("")

    if top:
        lines.append(f"**Top Performer:** {top['name']} — {top['roas']:.2f}x ROAS, ${top['total_revenue']:.2f} revenue")
    if worst:
        lines.append(f"**Needs Attention:** {worst['name']} — {worst['roas']:.2f}x ROAS, ${worst['total_spend']:.2f} spent")
    lines.append("")

    lines.append("**Recommendations:**")
    if to_scale:
        names = ", ".join(c["name"] for c in to_scale[:3])
        lines.append(f"✅ Scale these campaigns (4x+ ROAS): {names}")
    if to_pause:
        names = ", ".join(c["name"] for c in to_pause[:3])
        lines.append(f"⏸ Consider pausing (below 1.5x ROAS with spend): {names}")
    if not to_scale and not to_pause:
        lines.append("✅ Account is within normal operating range. Focus on creative testing to push performance higher.")

    if account_roas < 1 and total_spend > 0:
        lines.append(f"\n⛔ **URGENT:** Account ROAS of {account_roas:.2f}x is below break-even. Review all active campaigns immediately.")
    elif account_roas >= 4:
        lines.append(f"\n📈 Strong overall ROAS. This account has headroom to scale total budget 20-30% while maintaining efficiency.")

    lines.append("\n_This is a rules-based analysis from your stored data. Add an AI API key in Settings for natural language Q&A and deeper insights._")
    return "\n".join(lines)


async def run_tool(name: str, inputs: dict, db: AsyncSession, user_id: int) -> dict:
    if name == "get_account_overview":
        result = await db.execute(select(Campaign).where(Campaign.user_id == user_id))
        campaigns = result.scalars().all()
        overview = []
        for c in campaigns:
            m_result = await db.execute(
                select(PerformanceMetric).where(
                    PerformanceMetric.campaign_id == c.id,
                    PerformanceMetric.user_id == user_id,
                )
            )
            metrics = m_result.scalars().all()
            if metrics:
                spend = sum(m.spend for m in metrics)
                revenue = sum(m.revenue for m in metrics)
                clicks = sum(m.clicks for m in metrics)
                impressions = sum(m.impressions for m in metrics)
                conversions = sum(m.conversions for m in metrics)
                overview.append({
                    "id": c.id, "name": c.name, "platform": c.platform,
                    "status": c.status, "daily_budget": c.daily_budget,
                    "objective": c.objective,
                    "total_spend": round(spend, 2),
                    "total_revenue": round(revenue, 2),
                    "impressions": impressions, "clicks": clicks, "conversions": conversions,
                    "ctr": round(clicks / impressions * 100, 2) if impressions else 0,
                    "cpc": round(spend / clicks, 2) if clicks else 0,
                    "roas": round(revenue / spend, 2) if spend else 0,
                    "cpa": round(spend / conversions, 2) if conversions else 0,
                })
            else:
                overview.append({
                    "id": c.id, "name": c.name, "platform": c.platform,
                    "status": c.status, "daily_budget": c.daily_budget,
                    "objective": c.objective, "note": "No performance data yet"
                })
        return {"campaigns": overview, "total": len(overview)}

    elif name == "pause_campaign":
        result = await db.execute(
            select(Campaign).where(Campaign.id == inputs["campaign_id"], Campaign.user_id == user_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return {"error": f"Campaign {inputs['campaign_id']} not found"}
        campaign.status = "paused"
        campaign.updated_at = datetime.utcnow()
        await db.commit()
        return {"success": True, "campaign": campaign.name, "new_status": "paused"}

    elif name == "activate_campaign":
        result = await db.execute(
            select(Campaign).where(Campaign.id == inputs["campaign_id"], Campaign.user_id == user_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return {"error": f"Campaign {inputs['campaign_id']} not found"}
        campaign.status = "active"
        campaign.updated_at = datetime.utcnow()
        await db.commit()
        return {"success": True, "campaign": campaign.name, "new_status": "active"}

    elif name == "update_campaign_budget":
        result = await db.execute(
            select(Campaign).where(Campaign.id == inputs["campaign_id"], Campaign.user_id == user_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return {"error": f"Campaign {inputs['campaign_id']} not found"}
        old_budget = campaign.daily_budget
        campaign.daily_budget = inputs["new_budget"]
        campaign.updated_at = datetime.utcnow()
        await db.commit()
        return {"success": True, "campaign": campaign.name, "old_budget": old_budget, "new_budget": inputs["new_budget"]}

    elif name == "create_campaign":
        camp_name = inputs["name"].strip()
        if len(camp_name) > 100:
            return {"error": "Campaign name too long. Use a short descriptive name under 60 characters, e.g. 'AscendWC-Branded-Search-Jun26'. Do not use the user's message as the name."}
        inputs["name"] = camp_name
        new_camp = Campaign(
            user_id=user_id,
            name=inputs["name"],
            platform=inputs["platform"],
            objective=inputs["objective"],
            status="draft",
            daily_budget=float(inputs["daily_budget"]),
            start_date=inputs.get("start_date"),
        )
        db.add(new_camp)
        await db.commit()
        await db.refresh(new_camp)
        return {
            "success": True,
            "campaign_id": new_camp.id,
            "name": new_camp.name,
            "platform": new_camp.platform,
            "objective": new_camp.objective,
            "daily_budget": new_camp.daily_budget,
            "status": new_camp.status,
            "next_step": "Call push_campaign_live with campaign_id to push this to the platform.",
        }

    elif name == "push_campaign_live":
        from utils import get_user_settings_dict
        from services import MetaAdsService, GoogleAdsService
        from routers.campaigns import _meta_objective

        result = await db.execute(
            select(Campaign).where(Campaign.id == inputs["campaign_id"], Campaign.user_id == user_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return {"error": f"Campaign {inputs['campaign_id']} not found"}

        settings = await get_user_settings_dict(db, user_id)
        try:
            if campaign.platform == "meta":
                svc = MetaAdsService(settings=settings)
                push_result = await svc.create_campaign(
                    name=campaign.name,
                    objective=_meta_objective(campaign.objective),
                    status="PAUSED",
                    daily_budget=campaign.daily_budget,
                )
                campaign.platform_id = push_result.get("id")
            elif campaign.platform == "google":
                svc = GoogleAdsService(settings=settings)
                push_result = await svc.create_campaign(
                    name=campaign.name,
                    budget_micros=int(campaign.daily_budget * 1_000_000),
                )
                campaign.platform_id = push_result.get("results", [{}])[0].get("resourceName")
            campaign.status = "active"
            campaign.updated_at = datetime.utcnow()
            await db.commit()
            return {
                "success": True,
                "campaign_id": campaign.id,
                "name": campaign.name,
                "platform": campaign.platform,
                "platform_id": campaign.platform_id,
                "message": f"Campaign '{campaign.name}' has been pushed live to {campaign.platform.capitalize()} Ads. It is now active (paused in the platform until you enable it).",
            }
        except Exception as e:
            return {
                "success": False,
                "campaign_id": campaign.id,
                "name": campaign.name,
                "error": f"Platform push failed: {str(e)}",
                "fallback": f"Campaign '{campaign.name}' is saved as a draft in AdPilot. The user can manually push it from the Campaigns page once API credentials are configured in Settings.",
            }

    elif name == "get_top_creatives":
        from models import Creative
        result = await db.execute(
            select(Creative).where(Creative.user_id == user_id).order_by(Creative.created_at.desc()).limit(20)
        )
        creatives = result.scalars().all()
        return {
            "creatives": [
                {
                    "id": c.id,
                    "type": c.type,
                    "headline": c.headline,
                    "description": c.description,
                    "cta": c.cta,
                    "platform": c.platform,
                    "status": c.status,
                    "content_preview": (c.content or "")[:400],
                }
                for c in creatives
            ],
            "total": len(creatives),
        }

    elif name == "search_competitor_ads":
        from utils import get_user_settings_dict
        from services import MetaAdsService

        settings = await get_user_settings_dict(db, user_id)
        svc = MetaAdsService(settings=settings)
        if not svc.access_token:
            return {
                "error": "Meta access token not configured — skipping competitor research. Proceeding with general industry benchmarks.",
                "ads": [],
            }
        ads = await svc.search_ad_library(
            query=inputs.get("query", ""),
            country=inputs.get("country", "US"),
            limit=12,
        )
        summaries = [
            {
                "advertiser": ad.get("page_name"),
                "headlines": ad.get("ad_creative_link_titles", []),
                "bodies": ad.get("ad_creative_bodies", []),
                "descriptions": ad.get("ad_creative_link_descriptions", []),
                "ctas": ad.get("ad_creative_link_captions", []),
                "running_since": ad.get("ad_delivery_start_time"),
            }
            for ad in ads[:12]
        ]
        return {"ads": summaries, "total": len(summaries), "query": inputs.get("query")}

    elif name == "get_audience_insights":
        result = await db.execute(select(Campaign).where(Campaign.user_id == user_id))
        campaigns = result.scalars().all()
        with_data = []
        for c in campaigns:
            m_result = await db.execute(
                select(PerformanceMetric).where(
                    PerformanceMetric.campaign_id == c.id,
                    PerformanceMetric.user_id == user_id,
                )
            )
            metrics = m_result.scalars().all()
            if metrics:
                spend = sum(m.spend for m in metrics)
                revenue = sum(m.revenue for m in metrics)
                conversions = sum(m.conversions for m in metrics)
                if spend > 0:
                    with_data.append({
                        "name": c.name,
                        "platform": c.platform,
                        "objective": c.objective,
                        "daily_budget": c.daily_budget,
                        "roas": round(revenue / spend, 2),
                        "cpa": round(spend / conversions, 2) if conversions else None,
                        "conversions": conversions,
                    })
        with_data.sort(key=lambda x: x["roas"], reverse=True)
        top = with_data[:5]
        budgets = [c["daily_budget"] for c in with_data if c["daily_budget"] > 0]
        avg_budget = round(sum(budgets) / len(budgets), 2) if budgets else 50.0
        meta_count = sum(1 for c in with_data if c["platform"] == "meta")
        return {
            "top_performing_campaigns": top,
            "recommended_daily_budget": avg_budget,
            "dominant_platform": "meta" if meta_count >= len(with_data) / 2 else "google",
            "total_campaigns_analyzed": len(with_data),
            "insight": (
                f"Top {len(top)} campaigns average {round(sum(c['roas'] for c in top)/len(top), 2) if top else 0}x ROAS. "
                f"Recommended starting budget: ${avg_budget}/day based on account history."
            ) if with_data else "No performance data yet. Recommended starting budget: $50/day.",
        }

    elif name == "create_ad_copy":
        from models import Creative
        camp_result = await db.execute(
            select(Campaign).where(Campaign.id == inputs["campaign_id"], Campaign.user_id == user_id)
        )
        campaign = camp_result.scalar_one_or_none()
        if not campaign:
            return {"error": f"Campaign {inputs['campaign_id']} not found"}

        platform = inputs["platform"]
        saved = []

        if platform == "google":
            headlines = inputs.get("headlines", [])
            descriptions = inputs.get("descriptions", [])
            if not headlines:
                return {"error": "Google Search ad copy requires at least 3 headlines."}
            # Enforce character limits
            headlines = [h[:30] for h in headlines]
            descriptions = [d[:90] for d in descriptions]
            import json as _json
            structured = _json.dumps({"type": "search_rsa", "headlines": headlines, "descriptions": descriptions})
            c = Creative(
                user_id=user_id,
                campaign_id=campaign.id,
                type="copy",
                platform="google",
                content=structured,
                headline=headlines[0],
                description=descriptions[0] if descriptions else None,
                cta=inputs.get("cta", "Learn More"),
                prompt=f"Google Search RSA for {campaign.name}",
            )
            db.add(c)
            await db.flush()
            saved.append({"id": c.id, "platform": "google", "headlines": headlines, "descriptions": descriptions})

        elif platform == "meta":
            primary_text = inputs.get("primary_text", "")
            headline = (inputs.get("headline") or "")[:40]
            description = (inputs.get("description") or "")[:30]
            cta = inputs.get("cta", "Learn More")
            c = Creative(
                user_id=user_id,
                campaign_id=campaign.id,
                type="copy",
                platform="meta",
                content=primary_text,
                headline=headline,
                description=description,
                cta=cta,
                prompt=f"Meta Ad copy for {campaign.name}",
            )
            db.add(c)
            await db.flush()
            saved.append({"id": c.id, "platform": "meta", "headline": headline, "primary_text": primary_text, "description": description, "cta": cta})

        await db.commit()
        return {
            "success": True,
            "campaign": campaign.name,
            "creatives_saved": saved,
            "message": f"Ad copy saved to Creative Studio for {campaign.name}. Images can be added later.",
        }

    return {"error": f"Unknown tool: {name}"}


@router.post("/chat")
async def ai_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_settings = await get_user_settings_dict(db, current_user.id)
    api_key = user_settings.get("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        fallback = await _deterministic_analysis(payload.message, db, current_user.id)
        simple_history = list(payload.history or [])
        simple_history.append({"role": "user", "content": payload.message})
        simple_history.append({"role": "assistant", "content": fallback})
        return {"response": fallback, "actions_taken": [], "messages": simple_history[-12:]}

    client = anthropic.AsyncAnthropic(api_key=api_key)
    messages = list(payload.history) + [{"role": "user", "content": payload.message}]
    actions_taken = []
    max_tool_rounds = 6

    try:
        # Agentic loop — runs until Claude stops calling tools or hits round limit
        for _ in range(max_tool_rounds):
            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            if response.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": response.content})
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = await run_tool(block.name, block.input, db, current_user.id)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        })
                        actions_taken.append({
                            "tool": block.name,
                            "input": block.input,
                            "result": result,
                        })
                messages.append({"role": "user", "content": tool_results})
            else:
                final_text = "".join(b.text for b in response.content if hasattr(b, "text"))
                # Return simple text history for next turn
                simple_history = [m for m in payload.history if isinstance(m.get("content"), str)]
                simple_history.append({"role": "user", "content": payload.message})
                simple_history.append({"role": "assistant", "content": final_text})
                return {
                    "response": final_text,
                    "actions_taken": actions_taken,
                    "messages": simple_history[-12:],
                }

    except anthropic.AuthenticationError as e:
        logger.error("Anthropic auth error: %s", e)
        raise HTTPException(status_code=502, detail="Anthropic API key is invalid or expired. Please update it in Settings → AI Services.")
    except anthropic.RateLimitError as e:
        logger.error("Anthropic rate limit: %s", e)
        raise HTTPException(status_code=429, detail="Anthropic rate limit reached. Please try again in a moment.")
    except anthropic.APIStatusError as e:
        logger.error("Anthropic API error %s: %s", e.status_code, e.message)
        msg = str(e.message or "")
        if "credit balance" in msg.lower() or "billing" in msg.lower():
            fallback = await _deterministic_analysis(payload.message, db, current_user.id)
            simple_history = list(payload.history or [])
            simple_history.append({"role": "user", "content": payload.message})
            simple_history.append({"role": "assistant", "content": fallback})
            return {"response": fallback, "actions_taken": [], "messages": simple_history[-12:]}
        raise HTTPException(status_code=502, detail=f"AI service error. Please check your API key in Settings.")
    except anthropic.APIConnectionError as e:
        logger.error("Anthropic connection error: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Anthropic API. Check your internet connection.")
    except Exception as e:
        logger.exception("Unexpected error in ai_chat")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
