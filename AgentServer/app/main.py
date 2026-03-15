from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import workflows
from app.api.routers import agent
from app.infrastructure.db.engine import create_db_and_tables
from app.exception_handler import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist before serving requests
    create_db_and_tables()
    yield


app = FastAPI(
    title="Agent Server",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows.router)
app.include_router(agent.router)

register_exception_handlers(app)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
