from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")
    creatives = relationship("Creative", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("AppSetting", back_populates="user", cascade="all, delete-orphan")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False)  # meta | google
    platform_id = Column(String, nullable=True)
    objective = Column(String, nullable=False)
    status = Column(String, default="draft")  # draft | active | paused | ended
    daily_budget = Column(Float, default=0.0)
    total_budget = Column(Float, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    targeting = Column(JSON, nullable=True)
    ad_account_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="campaigns")
    metrics = relationship("PerformanceMetric", back_populates="campaign", cascade="all, delete-orphan")
    creatives = relationship("Creative", back_populates="campaign")


class Creative(Base):
    __tablename__ = "creatives"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    type = Column(String, nullable=False)  # image | video | copy
    content = Column(Text, nullable=False)
    prompt = Column(Text, nullable=True)
    platform = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    cta = Column(String, nullable=True)
    status = Column(String, default="draft")  # draft | approved | rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="creatives")
    campaign = relationship("Campaign", back_populates="creatives")


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    date = Column(String, nullable=False)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    spend = Column(Float, default=0.0)
    revenue = Column(Float, default=0.0)
    ctr = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    roas = Column(Float, default=0.0)
    platform = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="metrics")


class OptimizerRecommendation(Base):
    __tablename__ = "optimizer_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    type = Column(String, nullable=False)  # budget | bid | pause | creative | targeting
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    impact = Column(String, nullable=False)  # high | medium | low
    action = Column(JSON, nullable=True)
    status = Column(String, default="pending")  # pending | applied | dismissed
    created_at = Column(DateTime, default=datetime.utcnow)


class CompetitorAd(Base):
    __tablename__ = "competitor_ads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String, nullable=False)
    advertiser_name = Column(String, nullable=False)
    ad_id = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    video_url = Column(Text, nullable=True)
    cta = Column(String, nullable=True)
    landing_page = Column(Text, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    countries = Column(JSON, nullable=True)
    raw_data = Column(JSON, nullable=True)
    saved_at = Column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_app_setting_user_key"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=True)
    is_secret = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="settings")
