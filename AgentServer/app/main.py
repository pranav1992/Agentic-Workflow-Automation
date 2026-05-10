from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import workflows, agent, tool, edge, position
from app.infrastructure.db.engine import create_db_and_tables
from app.api.exceptions.base_exception_handler import base_exception_handler
from app.api.middleware import (
    RequestIdMiddleware,
    TenantIsolationMiddleware,
    RequestTimingMiddleware,
    SecurityHeadersMiddleware,
    ErrorHandlingMiddleware,
)
from app.core.settings import get_settings
from app.core.exceptions import setup_exception_handlers
from app.core.logging import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    settings = get_settings()
    logger.info(f"Starting VoiceOrchid Agent Server in {settings.ENVIRONMENT}")
    
    # Ensure tables exist before serving requests
    create_db_and_tables()
    logger.info("Database tables initialized")
    
    yield
    
    logger.info("Shutting down VoiceOrchid Agent Server")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        debug=settings.DEBUG,
    )
    
    # Add middleware stack (order matters - last added is first executed)
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestTimingMiddleware)
    app.add_middleware(TenantIsolationMiddleware)
    app.add_middleware(RequestIdMiddleware)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )
    
    # Setup exception handlers
    setup_exception_handlers(app)
    
    # Include v1 routers
    app.include_router(workflows.router)
    app.include_router(agent.router)
    app.include_router(tool.router)
    app.include_router(position.router)
    app.include_router(edge.router)
    
    # Legacy exception handler (keep for backwards compatibility)
    base_exception_handler(app)
    
    # Health check endpoints
    @app.get("/health")
    async def healthcheck() -> dict[str, str]:
        """Basic health check"""
        return {"status": "ok", "version": settings.APP_VERSION}
    
    @app.get("/health/ready")
    async def readiness_check() -> dict[str, str]:
        """Readiness check - indicates if service is ready to handle requests"""
        return {
            "status": "ready",
            "environment": settings.ENVIRONMENT,
        }
    
    @app.get("/health/live")
    async def liveness_check() -> dict[str, str]:
        """Liveness check - indicates if service is running"""
        return {"status": "alive"}
    
    logger.info("FastAPI application initialized successfully")
    return app


# Create the application instance
app = create_app()
