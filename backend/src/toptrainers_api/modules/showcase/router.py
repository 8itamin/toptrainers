from fastapi import APIRouter

from toptrainers_api.modules.showcase.schemas import SHOWCASE_BLOCK_TYPES

router = APIRouter(prefix="/showcase", tags=["showcase"])


@router.get("/blocks/catalog", response_model=list[str])
async def block_catalog() -> list[str]:
    """Public catalog; editors must use only registered typed block kinds."""
    return list(SHOWCASE_BLOCK_TYPES)
