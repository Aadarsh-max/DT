from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.llm.groq_client import groq_client
from app.llm.ollama_client import ollama
from app.utils.logger import get_logger

log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("AI engine starting on port %s", settings.app_port)
    yield
    await ollama.close()
    await groq_client.close()
    log.info("AI engine stopped")


app = FastAPI(title="AI Testing Engine", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root() -> dict:
    return {"name": "AI Testing Engine", "status": "running", "docs": "/docs"}