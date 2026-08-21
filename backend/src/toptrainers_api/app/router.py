from fastapi import APIRouter

from toptrainers_api.modules.assignments.router import router as assignments_router
from toptrainers_api.modules.clients.router import router as clients_router
from toptrainers_api.modules.exercises.router import router as exercises_router
from toptrainers_api.modules.health.router import router as health_router
from toptrainers_api.modules.identity.router import router as identity_router
from toptrainers_api.modules.programs.router import router as programs_router
from toptrainers_api.modules.showcase.router import router as showcase_router
from toptrainers_api.modules.workouts.router import router as workouts_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(showcase_router)
api_router.include_router(identity_router)
api_router.include_router(clients_router)
api_router.include_router(assignments_router)
api_router.include_router(programs_router)
api_router.include_router(exercises_router)
api_router.include_router(workouts_router)
