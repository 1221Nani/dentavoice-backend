import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Creative, User
from services import AnthropicService, ImageGenService, VideoGenService
from auth import get_current_user
from utils import get_user_settings_dict

router = APIRouter(prefix="/api/creatives", tags=["creatives"])


class CopyRequest(BaseModel):
    product: str
    audience: str
    platform: str
    objective: str
    tone: str = "professional"
    num_variants: int = 3
    campaign_id: Optional[int] = None


class ImageRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    quality: str = "hd"
    style: str = "vivid"
    campaign_id: Optional[int] = None


class VideoRequest(BaseModel):
    prompt: str
    source_image_url: Optional[str] = None
    duration: int = 5
    ratio: str = "1280:720"
    campaign_id: Optional[int] = None


class CreativeSave(BaseModel):
    campaign_id: Optional[int] = None
    type: str
    content: str
    prompt: Optional[str] = None
    platform: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    cta: Optional[str] = None


@router.get("")
async def list_creatives(
    campaign_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Creative).where(Creative.user_id == current_user.id).order_by(Creative.created_at.desc())
    if campaign_id:
        q = q.where(Creative.campaign_id == campaign_id)
    result = await db.execute(q)
    return [_creative_to_dict(c) for c in result.scalars().all()]


def _rule_based_ad_copy(product: str, audience: str, platform: str, objective: str, tone: str, num_variants: int) -> list[dict]:
    """Template-based ad copy — fallback when AI API is unavailable."""
    ctas_by_obj = {
        "sales":     ["Shop Now", "Buy Now", "Get Yours", "Order Today", "Claim Offer"],
        "leads":     ["Get a Free Quote", "Book a Call", "Sign Up Free", "Request Info", "Get Started"],
        "awareness": ["Learn More", "Discover More", "See How It Works", "Find Out More", "Explore"],
        "traffic":   ["Visit Now", "See More", "Read More", "Explore Now", "Click Here"],
    }
    obj_ctas = ctas_by_obj.get(objective, ["Learn More", "Get Started", "Sign Up"])

    tone_openers = {
        "professional": ["Discover", "Introducing", "Experience", "Elevate", "Achieve"],
        "casual":       ["Hey!", "Check this out —", "You'll love", "Meet", "Here's"],
        "urgent":       ["Don't miss out —", "Limited time:", "Act now —", "Last chance:", "Today only:"],
        "playful":      ["Ready for something awesome?", "Game changer alert!", "Say hello to", "This changes everything:", "Fun fact:"],
        "luxurious":    ["Exclusively for", "The finest", "Curated for", "Reserved for", "Crafted for"],
    }
    openers = tone_openers.get(tone, tone_openers["professional"])
    p = product[:20]
    a = audience[:20]

    if platform == "google":
        set_templates = [
            {
                "headlines": [
                    f"{product} for {audience}", f"Best {product} Online",
                    f"Shop {product} Today", f"{product} On Sale Now",
                    f"Top Rated {product}", f"Buy {product} Direct",
                    f"{product} — Save Today", f"Quality {product} Here",
                    f"Trusted {product} Brand", f"Premium {product} Store",
                    f"Fast Shipping on {p}", f"New {product} Arrivals",
                    f"{p} — Free Returns", f"Why {a} Love {p}",
                    f"Get {product} Now",
                ],
                "descriptions": [
                    f"Discover {product} designed for {audience}. Results guaranteed or your money back. Shop now.",
                    f"{product} trusted by {audience} everywhere. Free shipping on all orders. Order today.",
                    f"Join thousands of {audience} who rely on {product} daily. Shop the full range now.",
                    f"Get {product} at the best price. {audience} love us — see why. Order today.",
                ],
            },
            {
                "headlines": [
                    f"Limited Time: {p} Offer", f"Exclusive {product} Deal",
                    f"Don't Miss Out on {p}", f"Act Now — {product}",
                    f"Today Only: {p}", f"Last Chance for {p}",
                    f"Special Offer on {p}", f"Hurry — {p} Sale",
                    f"Save Big on {product}", f"Urgent: {p} Available",
                    f"Book {product} Today", f"Claim Your {p} Now",
                    f"Flash Sale: {product}", f"Ends Soon: {p}",
                    f"Reserve Your {p} Now",
                ],
                "descriptions": [
                    f"Limited availability — {product} for {audience} won't last. Act now before it's gone.",
                    f"Exclusive deal for {audience}: get {product} at an unbeatable price. Today only.",
                    f"Don't let {audience} miss out on {product}. This offer expires soon — claim it now.",
                    f"Hurry! {product} is in high demand among {audience}. Secure yours before it sells out.",
                ],
            },
            {
                "headlines": [
                    f"Trusted by {a}", f"5-Star {product}",
                    f"Award-Winning {p}", f"Loved by {audience}",
                    f"#1 Choice for {a}", f"Proven {product} Results",
                    f"Expert-Backed {p}", f"Thousands Trust {p}",
                    f"Recommended {product}", f"See Why {a} Choose Us",
                    f"Certified {product}", f"Verified {p} Results",
                    f"Top Choice: {p}", f"Guaranteed {product}",
                    f"Real Results with {p}",
                ],
                "descriptions": [
                    f"Thousands of {audience} trust {product} for real results. See verified reviews today.",
                    f"Award-winning {product} recommended by experts. See why {audience} keep coming back.",
                    f"Join a community of {audience} who have transformed their experience with {product}.",
                    f"Backed by real {audience} results. {product} delivers — satisfaction guaranteed.",
                ],
            },
        ]
        rsa_sets = []
        for i in range(min(num_variants, 3)):
            t = set_templates[i % len(set_templates)]
            rsa_sets.append({
                "type": "google_rsa",
                "set": i + 1,
                "headlines": [h[:30] for h in t["headlines"]],
                "descriptions": [d[:90] for d in t["descriptions"]],
            })
        return rsa_sets

    # Meta variants
    angles = [
        {
            "hook": f"{openers[0 % len(openers)]} {product} — designed for {audience}.",
            "headline": f"{product} — For {audience}",
            "primary_text": f"Discover why {audience} trust {product}. Get the results you've been looking for — start today.",
            "description": f"For {audience}.",
            "cta": obj_ctas[0 % len(obj_ctas)],
        },
        {
            "hook": f"{openers[1 % len(openers)]} a smarter way to get results.",
            "headline": f"The Smart Choice for {a}",
            "primary_text": f"{product} gives {audience} exactly what they need. Join thousands who've already seen the difference.",
            "description": f"Results you can trust.",
            "cta": obj_ctas[1 % len(obj_ctas)],
        },
        {
            "hook": f"{openers[2 % len(openers)]} better outcomes with {product}.",
            "headline": f"Transform Your Results with {p}",
            "primary_text": f"Stop settling. {product} delivers real outcomes for {audience}. Try it today.",
            "description": f"Trusted by {a} everywhere.",
            "cta": obj_ctas[2 % len(obj_ctas)],
        },
        {
            "hook": f"{openers[3 % len(openers)]} {product} — the choice of {audience}.",
            "headline": f"Why {a} Choose {p}",
            "primary_text": f"Join a growing community of {audience} who rely on {product} every day.",
            "description": f"#1 choice for {a}.",
            "cta": obj_ctas[3 % len(obj_ctas)],
        },
        {
            "hook": f"{openers[4 % len(openers)]} — {product} built to deliver.",
            "headline": f"{p} — Results That Speak",
            "primary_text": f"Built for {audience}, {product} delivers every time. Your search ends here.",
            "description": f"Made for {a} like you.",
            "cta": obj_ctas[4 % len(obj_ctas)],
        },
    ]

    variants = []
    for i in range(min(num_variants, 5)):
        ang = angles[i % len(angles)]
        variants.append({
            "hook": ang["hook"],
            "headline": ang["headline"][:40],
            "primary_text": ang["primary_text"][:125],
            "description": ang["description"][:30],
            "cta": ang["cta"],
        })
    return variants


@router.post("/copy")
async def generate_copy(
    payload: CopyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = AnthropicService(settings=settings)
    ai_warning = None
    try:
        variants = await svc.generate_ad_copy(
            product=payload.product,
            audience=payload.audience,
            platform=payload.platform,
            objective=payload.objective,
            tone=payload.tone,
            num_variants=payload.num_variants,
        )
        # Safety check: if Google was requested but AI returned Meta-style variants, fall back to rule-based
        if payload.platform == "google":
            if not variants or not all(v.get("type") == "google_rsa" and v.get("headlines") for v in variants):
                ai_warning = "AI returned unexpected format for Google RSA"
                variants = _rule_based_ad_copy(
                    product=payload.product, audience=payload.audience, platform=payload.platform,
                    objective=payload.objective, tone=payload.tone, num_variants=payload.num_variants,
                )
    except ValueError as e:
        ai_warning = str(e)
        variants = _rule_based_ad_copy(
            product=payload.product,
            audience=payload.audience,
            platform=payload.platform,
            objective=payload.objective,
            tone=payload.tone,
            num_variants=payload.num_variants,
        )

    saved = []
    for v in variants:
        is_rsa = v.get("type") == "google_rsa"
        c = Creative(
            user_id=current_user.id,
            campaign_id=payload.campaign_id,
            type="copy",
            content=json.dumps(v) if is_rsa else v.get("primary_text", ""),
            prompt=f"{payload.product} | {payload.audience}",
            platform=payload.platform,
            headline=None if is_rsa else v.get("headline"),
            description=None if is_rsa else v.get("description"),
            cta=None if is_rsa else v.get("cta"),
        )
        db.add(c)
        await db.flush()
        row = _creative_to_dict(c)
        saved.append({**row, **v} if is_rsa else {**row, "hook": v.get("hook"), "primary_text": v.get("primary_text")})

    await db.commit()
    response = {"variants": saved}
    if ai_warning:
        response["warning"] = ai_warning
    return response


@router.post("/image")
async def generate_image(
    payload: ImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = ImageGenService(settings=settings)
    try:
        results = await svc.generate(
            prompt=payload.prompt,
            size=payload.size,
            quality=payload.quality,
            style=payload.style,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    saved = []
    for r in results:
        c = Creative(
            user_id=current_user.id,
            campaign_id=payload.campaign_id,
            type="image",
            content=r["url"],
            prompt=payload.prompt,
        )
        db.add(c)
        await db.flush()
        saved.append({**_creative_to_dict(c), "revised_prompt": r.get("revised_prompt")})

    await db.commit()
    return {"images": saved}


@router.post("/video")
async def generate_video(
    payload: VideoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_user_settings_dict(db, current_user.id)
    svc = VideoGenService(settings=settings)
    try:
        if payload.source_image_url:
            result = await svc.generate_from_image(
                image_url=payload.source_image_url,
                prompt=payload.prompt,
                duration=payload.duration,
            )
        else:
            result = await svc.generate_from_text(
                prompt=payload.prompt,
                duration=payload.duration,
                ratio=payload.ratio,
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result.get("status") != "succeeded":
        raise HTTPException(status_code=500, detail=f"Video generation failed: {result.get('error', 'Unknown')}")

    c = Creative(
        user_id=current_user.id,
        campaign_id=payload.campaign_id,
        type="video",
        content=result["url"],
        prompt=payload.prompt,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _creative_to_dict(c)


@router.post("/save")
async def save_creative(
    payload: CreativeSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = Creative(
        user_id=current_user.id,
        campaign_id=payload.campaign_id,
        type=payload.type,
        content=payload.content,
        prompt=payload.prompt,
        platform=payload.platform,
        headline=payload.headline,
        description=payload.description,
        cta=payload.cta,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _creative_to_dict(c)


@router.put("/{creative_id}/status")
async def update_status(
    creative_id: int,
    status: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_owned(db, creative_id, current_user.id)
    c.status = status
    await db.commit()
    return {"ok": True}


@router.delete("/{creative_id}")
async def delete_creative(
    creative_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_owned(db, creative_id, current_user.id)
    await db.delete(c)
    await db.commit()
    return {"ok": True}


@router.get("/options/sizes")
async def get_image_sizes():
    return ImageGenService().get_sizes()


@router.get("/options/ratios")
async def get_video_ratios():
    return VideoGenService().get_ratios()


async def _get_owned(db: AsyncSession, creative_id: int, user_id: int) -> Creative:
    result = await db.execute(
        select(Creative).where(Creative.id == creative_id, Creative.user_id == user_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Creative not found")
    return c


def _creative_to_dict(c: Creative) -> dict:
    return {
        "id": c.id,
        "campaign_id": c.campaign_id,
        "type": c.type,
        "content": c.content,
        "prompt": c.prompt,
        "platform": c.platform,
        "headline": c.headline,
        "description": c.description,
        "cta": c.cta,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }
