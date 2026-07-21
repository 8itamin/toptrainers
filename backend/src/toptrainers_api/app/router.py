from fastapi import APIRouter

from toptrainers_api.modules.health.router import router as health_router
from toptrainers_api.modules.identity.router import router as identity_router
from toptrainers_api.modules.programs.router import router as programs_router
from toptrainers_api.modules.showcase.router import router as showcase_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(showcase_router)
api_router.include_router(identity_router)
api_router.include_router(programs_router)
