from fastapi import APIRouter

from app.api.routes import (
    bug_analysis,
    chat,
    duplicates,
    execute,
    health,
    mobile,
    prioritize,
    report,
    requirements,
    risk,
    testgen,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(requirements.router)
api_router.include_router(testgen.router)
api_router.include_router(execute.router)
api_router.include_router(bug_analysis.router)
api_router.include_router(duplicates.router)
api_router.include_router(report.router)
api_router.include_router(prioritize.router)
api_router.include_router(risk.router)
api_router.include_router(chat.router)
api_router.include_router(mobile.router)