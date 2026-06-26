from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, date, timedelta

from database import get_db
from models import Campaign, PerformanceMetric, AppSetting, User
from services import MetaAdsService, GoogleAdsService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/sync", tags=["sync"])


async def _upsert_setting(db: AsyncSession, user_id: int, key: str, value: str):
    result = await db.execute(
        select(AppSetting).where(AppSetting.user_id == user_id, AppSetting.key == key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(AppSetting(user_id=user_id, key=key, value=value, is_secret=True))


@router.post("/meta")
async def sync_meta(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = MetaAdsService(settings=settings)

    if not svc._is_configured():
        return {"ok": False, "error": "Meta Ads not connected. Go to Settings → Meta and connect your account."}

    # 1. Pull campaigns
    campaigns_resp = await svc.get_campaigns()
    meta_campaigns = campaigns_resp.get("data", [])
    campaigns_synced = 0

    campaign_id_map = {}  # meta platform_id -> local Campaign.id

    for mc in meta_campaigns:
        pid = str(mc.get("id", ""))
        if not pid:
            continue

        existing = await db.execute(
            select(Campaign).where(
                Campaign.user_id == current_user.id,
                Campaign.platform_id == pid,
                Campaign.platform == "meta",
            )
        )
        local = existing.scalar_one_or_none()

        status_raw = (mc.get("status") or "PAUSED").upper()
        status = "active" if status_raw == "ACTIVE" else "paused" if status_raw == "PAUSED" else "ended"
        daily_budget = int(mc.get("daily_budget") or mc.get("lifetime_budget") or 0) / 100

        if local:
            local.name = mc.get("name", local.name)
            local.status = status
            local.daily_budget = daily_budget
            local.updated_at = datetime.utcnow()
        else:
            local = Campaign(
                user_id=current_user.id,
                platform="meta",
                platform_id=pid,
                name=mc.get("name", f"Meta Campaign {pid}"),
                objective=mc.get("objective", "LINK_CLICKS").lower().replace("_", " "),
                status=status,
                daily_budget=daily_budget,
                ad_account_id=str(svc.ad_account_id),
            )
            db.add(local)
            await db.flush()
            campaigns_synced += 1

        campaign_id_map[pid] = local.id

    await db.commit()

    # 2. Pull insights (daily breakdown for last N days)
    date_preset = f"last_{days}d"
    insights_resp = await svc.get_insights(
        campaign_ids=list(campaign_id_map.keys()),
        date_preset=date_preset,
    )
    insight_rows = insights_resp.get("data", [])
    metrics_synced = 0

    for row in insight_rows:
        cid = str(row.get("campaign_id", ""))
        local_campaign_id = campaign_id_map.get(cid)
        if not local_campaign_id:
            continue

        day = row.get("date_start")
        if not day:
            continue

        impressions = int(row.get("impressions") or 0)
        clicks = int(row.get("clicks") or 0)
        spend = float(row.get("spend") or 0)

        # Extract conversions — covers both lead gen and sales campaign types
        # Use top-level aggregate types to avoid double-counting with pixel-specific variants
        CONVERSION_ACTION_TYPES = {
            # Sales
            "purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase",
            # Lead generation
            "lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead",
            "leadgen_grouped",
            # Other common conversion goals
            "complete_registration", "contact", "schedule", "find_location",
            "initiate_checkout",
        }
        conversions = 0
        for action in (row.get("actions") or []):
            if action.get("action_type") in CONVERSION_ACTION_TYPES:
                conversions += int(float(action.get("value") or 0))

        # Revenue: sum conversion values across all tracked types
        revenue = 0.0
        for action in (row.get("action_values") or []):
            if action.get("action_type") in CONVERSION_ACTION_TYPES:
                revenue += float(action.get("value") or 0)

        # Upsert metric for this campaign + date
        existing_metric = await db.execute(
            select(PerformanceMetric).where(
                and_(
                    PerformanceMetric.user_id == current_user.id,
                    PerformanceMetric.campaign_id == local_campaign_id,
                    PerformanceMetric.date == day,
                )
            )
        )
        metric = existing_metric.scalar_one_or_none()

        ctr = round(clicks / impressions * 100, 4) if impressions else 0
        cpc = round(spend / clicks, 4) if clicks else 0
        roas = round(revenue / spend, 4) if spend else 0

        if metric:
            metric.impressions = impressions
            metric.clicks = clicks
            metric.spend = spend
            metric.conversions = conversions
            metric.revenue = revenue
            metric.ctr = ctr
            metric.cpc = cpc
            metric.roas = roas
            metric.platform = "meta"
        else:
            db.add(PerformanceMetric(
                user_id=current_user.id,
                campaign_id=local_campaign_id,
                date=day,
                impressions=impressions,
                clicks=clicks,
                conversions=conversions,
                spend=spend,
                revenue=revenue,
                ctr=ctr,
                cpc=cpc,
                roas=roas,
                platform="meta",
            ))
            metrics_synced += 1

    await db.commit()

    return {
        "ok": True,
        "platform": "meta",
        "campaigns_synced": campaigns_synced,
        "metrics_upserted": len(insight_rows),
        "days": days,
        "message": f"Synced {len(meta_campaigns)} Meta campaigns and {len(insight_rows)} daily metric rows.",
    }


@router.post("/google")
async def sync_google(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import os
    settings = await get_user_settings_dict(db, current_user.id)

    # Fall back to .env for Google keys if not in DB
    for key in [
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
    ]:
        if not settings.get(key):
            env_val = os.getenv(key)
            if env_val:
                settings[key] = env_val

    svc = GoogleAdsService(settings=settings)

    if not svc._is_configured():
        return {"ok": False, "error": "Google Ads not configured. Check your credentials in Settings."}

    # Map days to Google date range
    if days <= 7:
        date_range = "LAST_7_DAYS"
    elif days <= 30:
        date_range = "LAST_30_DAYS"
    elif days <= 90:
        date_range = "LAST_90_DAYS"
    else:
        date_range = "LAST_90_DAYS"

    # 1. Pull campaigns
    campaigns_resp = await svc.get_campaigns()
    if campaigns_resp.get("error"):
        return {"ok": False, "error": campaigns_resp["error"]}

    google_campaigns = campaigns_resp.get("data", [])
    campaigns_synced = 0
    campaign_resource_map = {}  # resourceName -> local Campaign.id

    for gc in google_campaigns:
        campaign = gc.get("campaign", {})
        resource_name = campaign.get("resourceName", "")
        gid = str(campaign.get("id", ""))
        if not gid:
            continue

        existing = await db.execute(
            select(Campaign).where(
                Campaign.user_id == current_user.id,
                Campaign.platform_id == gid,
                Campaign.platform == "google",
            )
        )
        local = existing.scalar_one_or_none()

        g_status = (campaign.get("status") or "PAUSED").upper()
        status = "active" if g_status == "ENABLED" else "paused" if g_status == "PAUSED" else "ended"
        budget = gc.get("campaignBudget", {})
        daily_budget = int(budget.get("amountMicros") or 0) / 1_000_000

        channel = campaign.get("advertisingChannelType", "SEARCH").lower()
        objective = "traffic" if channel == "search" else "awareness" if channel == "display" else "traffic"

        if local:
            local.name = campaign.get("name", local.name)
            local.status = status
            local.daily_budget = daily_budget or local.daily_budget
            local.updated_at = datetime.utcnow()
        else:
            local = Campaign(
                user_id=current_user.id,
                platform="google",
                platform_id=gid,
                name=campaign.get("name", f"Google Campaign {gid}"),
                objective=objective,
                status=status,
                daily_budget=daily_budget,
                ad_account_id=str(svc.customer_id),
            )
            db.add(local)
            await db.flush()
            campaigns_synced += 1

        campaign_resource_map[gid] = local.id

    await db.commit()

    # 2. Pull metrics
    metrics_resp = await svc.get_campaign_metrics(date_range=date_range)
    if metrics_resp.get("error"):
        return {
            "ok": True,
            "platform": "google",
            "campaigns_synced": campaigns_synced,
            "metrics_upserted": 0,
            "warning": metrics_resp["error"],
            "message": f"Synced {len(google_campaigns)} campaigns but metrics failed: {metrics_resp['error']}",
        }

    metric_rows = metrics_resp.get("data", [])
    metrics_synced = 0

    for row in metric_rows:
        campaign = row.get("campaign", {})
        gid = str(campaign.get("id", ""))
        local_campaign_id = campaign_resource_map.get(gid)
        if not local_campaign_id:
            continue

        segments = row.get("segments", {})
        day = segments.get("date")
        if not day:
            continue

        m = row.get("metrics", {})
        impressions = int(m.get("impressions") or 0)
        clicks = int(m.get("clicks") or 0)
        cost_micros = int(m.get("costMicros") or 0)
        spend = round(cost_micros / 1_000_000, 4)
        # Conversion hierarchy:
        # 1. all_conversions — most inclusive (includes call conversions, cross-device, view-through)
        # 2. conversions — "included in conversions" actions only (excludes some call conversion types)
        # 3. phone_calls — raw call count from call-only ads/extensions (last resort for call-focused campaigns)
        conversions_primary = float(m.get("conversions") or 0)
        conversions_all = float(m.get("allConversions") or 0)
        phone_calls = float(m.get("phoneCalls") or 0)
        conversions = conversions_all if conversions_all > 0 else conversions_primary
        if conversions == 0 and phone_calls > 0:
            conversions = phone_calls
        revenue = float(m.get("allConversionsValue") or 0)

        ctr = round(clicks / impressions * 100, 4) if impressions else 0
        cpc = round(spend / clicks, 4) if clicks else 0
        roas = round(revenue / spend, 4) if spend else 0

        existing_metric = await db.execute(
            select(PerformanceMetric).where(
                and_(
                    PerformanceMetric.user_id == current_user.id,
                    PerformanceMetric.campaign_id == local_campaign_id,
                    PerformanceMetric.date == day,
                )
            )
        )
        metric = existing_metric.scalar_one_or_none()

        if metric:
            metric.impressions = impressions
            metric.clicks = clicks
            metric.spend = spend
            metric.conversions = int(conversions)
            metric.revenue = revenue
            metric.ctr = ctr
            metric.cpc = cpc
            metric.roas = roas
            metric.platform = "google"
        else:
            db.add(PerformanceMetric(
                user_id=current_user.id,
                campaign_id=local_campaign_id,
                date=day,
                impressions=impressions,
                clicks=clicks,
                conversions=int(conversions),
                spend=spend,
                revenue=revenue,
                ctr=ctr,
                cpc=cpc,
                roas=roas,
                platform="google",
            ))
            metrics_synced += 1

    await db.commit()

    return {
        "ok": True,
        "platform": "google",
        "campaigns_synced": campaigns_synced,
        "metrics_upserted": len(metric_rows),
        "days": days,
        "message": f"Synced {len(google_campaigns)} Google campaigns and {len(metric_rows)} daily metric rows.",
    }


@router.post("/all")
async def sync_all(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    meta_result = await sync_meta(days=days, current_user=current_user, db=db)
    google_result = await sync_google(days=days, current_user=current_user, db=db)
    return {
        "ok": True,
        "meta": meta_result,
        "google": google_result,
    }
