"""
API versioning utilities and decorators
"""
from typing import List, Callable
from fastapi import APIRouter, Depends
from app.core.logging import get_logger

logger = get_logger(__name__)


class APIVersion:
    """API versioning utilities"""
    
    VERSION_1 = "v1"
    VERSION_2 = "v2"
    
    CURRENT = VERSION_1
    SUPPORTED_VERSIONS = [VERSION_1, VERSION_2]


def create_versioned_router(
    version: str,
    prefix: str,
    tags: List[str] = None,
    dependencies: List = None,
) -> APIRouter:
    """
    Create a versioned API router
    
    Args:
        version: API version (v1, v2, etc.)
        prefix: Router prefix
        tags: OpenAPI tags
        dependencies: Router dependencies
    
    Returns:
        Configured APIRouter
    """
    if tags is None:
        tags = []
    
    if dependencies is None:
        dependencies = []
    
    versioned_prefix = f"/api/{version}{prefix}"
    
    logger.info(f"Creating API router for {version}: {versioned_prefix}")
    
    return APIRouter(
        prefix=versioned_prefix,
        tags=tags,
        dependencies=dependencies,
    )


def deprecate_in_version(version: str, message: str = ""):
    """
    Decorator to mark endpoint as deprecated
    
    Args:
        version: Version in which it will be removed
        message: Deprecation message
    """
    def decorator(func: Callable) -> Callable:
        func.deprecated = True
        func.deprecated_in_version = version
        func.deprecation_message = message or f"Deprecated in {version}"
        return func
    return decorator
