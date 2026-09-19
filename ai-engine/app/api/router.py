from fastapi import APIRouter

from app.api.routes import bug_analysis, duplicates, execute, health, requirements, testgen

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(requirements.router)
api_router.include_router(testgen.router)
api_router.include_router(execute.router)
api_router.include_router(bug_analysis.router)
api_router.include_router(duplicates.router)

# Feature routers are added here in later phases.