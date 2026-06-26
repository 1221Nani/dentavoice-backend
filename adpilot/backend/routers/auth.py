from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import secrets
from datetime import datetime, timedelta

from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# token -> {email, expires_at}
_reset_tokens: dict = {}


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register")
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"token": create_access_token(user.id), "user": _user_dict(user)}


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_access_token(user.id), "user": _user_dict(user)}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    # Always return success to avoid email enumeration
    if not user:
        return {"message": "If that email exists, a reset link has been generated."}

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "email": user.email,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
    }
    return {
        "message": "Reset link generated. Use it within 1 hour.",
        "reset_token": token,
    }


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    entry = _reset_tokens.get(payload.token)
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if datetime.utcnow() > entry["expires_at"]:
        del _reset_tokens[payload.token]
        raise HTTPException(status_code=400, detail="Reset token has expired")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    result = await db.execute(select(User).where(User.email == entry["email"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    del _reset_tokens[payload.token]
    return {"message": "Password reset successfully. You can now log in."}


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }
