"""
Enhanced configuration management for multi-environment support
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field
from typing import Optional
from app.core.constants import Environment


class Settings(BaseSettings):
    """Application settings with environment-specific configuration"""
    
    # Application
    APP_NAME: str = "VoiceOrchid Agent Server"
    APP_VERSION: str = "0.2.0"
    ENVIRONMENT: Environment = Field(default=Environment.DEVELOPMENT)
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = Field(default="INFO")
    
    # Database
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    
    # Database pool settings
    DB_POOL_SIZE: int = Field(default=10)
    DB_MAX_OVERFLOW: int = Field(default=20)
    DB_POOL_RECYCLE: int = Field(default=3600)
    DB_ECHO: bool = Field(default=False)
    
    # Redis
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_DB: int = Field(default=0)
    REDIS_PASSWORD: Optional[str] = Field(default=None)
    
    # Security
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=30)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    
    # CORS
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True)
    CORS_ALLOW_METHODS: list[str] = Field(default=["*"])
    CORS_ALLOW_HEADERS: list[str] = Field(default=["*"])
    
    # API
    API_V1_STR: str = "/api/v1"
    API_V2_STR: str = "/api/v2"
    
    # Rate limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    RATE_LIMIT_REQUESTS: int = Field(default=100)
    RATE_LIMIT_PERIOD_SECONDS: int = Field(default=60)
    
    # Feature flags
    FEATURE_FLAGS: dict = Field(default_factory=dict)
    
    # Audit logging
    AUDIT_LOG_ENABLED: bool = Field(default=True)
    AUDIT_LOG_RETENTION_DAYS: int = Field(default=90)
    
    # Observability
    ENABLE_METRICS: bool = Field(default=True)
    ENABLE_TRACING: bool = Field(default=True)
    TRACE_SAMPLE_RATE: float = Field(default=0.1)
    
    # Multi-tenancy
    MULTI_TENANCY_ENABLED: bool = Field(default=True)
    DEFAULT_TENANT_ID: Optional[str] = Field(default=None)
    
    # LiveKit
    LIVEKIT_URL: Optional[str] = Field(default=None)
    LIVEKIT_API_KEY: Optional[str] = Field(default=None)
    LIVEKIT_API_SECRET: Optional[str] = Field(default=None)
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    
    model_config = ConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )
    
    @property
    def database_url(self) -> str:
        """Get database URL"""
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def redis_url(self) -> str:
        """Get Redis URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == Environment.PRODUCTION
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == Environment.DEVELOPMENT


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get global settings instance (singleton pattern)"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
