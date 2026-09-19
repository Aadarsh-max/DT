from fastapi import APIRouter

from app.api.routes import health, requirements

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(requirements.router)

# Feature routers are added here in later phases.