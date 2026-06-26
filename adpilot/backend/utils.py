from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import AppSetting


async def get_user_settings_dict(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(select(AppSetting).where(AppSetting.user_id == user_id))
    return {s.key: s.value for s in result.scalars().all() if s.value}
