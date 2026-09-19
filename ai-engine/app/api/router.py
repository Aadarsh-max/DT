from fastapi import APIRouter

from app.api.routes import health, requirements, testgen

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(requirements.router)
api_router.include_router(testgen.router)

# Feature routers are added here in later phases.