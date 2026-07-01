from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os

load_dotenv()

from database import init_db, get_db
from routers import campaigns, creatives, performance, optimizer, competitors, reports, settings as settings_router
from routers import auth as auth_router
from routers import ai_chat
from routers import oauth_meta
from routers import oauth_google
from routers import sync as sync_router
from routers import insights as insights_router
from models import Campaign, PerformanceMetric, User
from auth import get_current_user

app = FastAPI(title="AdPilot AI", version="2.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(campaigns.router)
app.include_router(creatives.router)
app.include_router(performance.router)
app.include_router(optimizer.router)
app.include_router(competitors.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(ai_chat.router)
app.include_router(oauth_meta.router)
app.include_router(oauth_google.router)
app.include_router(sync_router.router)
app.include_router(insights_router.router)


@app.on_event("startup")
async def startup():
    try:
        await init_db()
    except Exception as e:
        import logging
        logging.warning(f"DB init failed at startup (will retry on first request): {e}")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "AdPilot AI"}


@app.get("/api/dashboard/summary")
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == current_user.id)
    )
    campaigns = campaigns_result.scalars().all()

    metrics_result = await db.execute(
        select(PerformanceMetric).where(PerformanceMetric.user_id == current_user.id)
    )
    all_metrics = metrics_result.scalars().all()

    total_spend = sum(m.spend for m in all_metrics)
    total_revenue = sum(m.revenue for m in all_metrics)
    total_clicks = sum(m.clicks for m in all_metrics)
    total_impressions = sum(m.impressions for m in all_metrics)
    total_conversions = sum(m.conversions for m in all_metrics)
    active_campaigns = sum(1 for c in campaigns if c.status == "active")

    platform_counts = {"meta": 0, "google": 0}
    for c in campaigns:
        if c.platform in platform_counts:
            platform_counts[c.platform] += 1

    return {
        "total_campaigns": len(campaigns),
        "active_campaigns": active_campaigns,
        "platform_counts": platform_counts,
        "total_spend": round(total_spend, 2),
        "total_revenue": round(total_revenue, 2),
        "total_clicks": total_clicks,
        "total_impressions": total_impressions,
        "total_conversions": total_conversions,
        "roas": round(total_revenue / total_spend, 2) if total_spend else 0,
        "ctr": round(total_clicks / total_impressions * 100, 2) if total_impressions else 0,
        "cpa": round(total_spend / total_conversions, 2) if total_conversions else 0,
    }
