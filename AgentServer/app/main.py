from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import workflows
from app.api.routers import agent
from app.api.routers import tool
from app.api.routers import edge
from app.infrastructure.db.engine import create_db_and_tables
from app.api.exceptions.base_exception_handler import base_exception_handler
from app.api.routers import position


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
    "http://127.0.0.1:5173",
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
app.include_router(tool.router)
app.include_router(position.router)
app.include_router(edge.router)

base_exception_handler(app)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
