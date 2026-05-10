"""
Comprehensive logging with structured logging and tracing
"""
import logging
import json
import uuid
from typing import Any, Dict, Optional
from datetime import datetime
import sys
from app.core.settings import get_settings
from app.core.tenancy import TenantContext


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": TenantContext.get_request_id(),
            "tenant_id": str(TenantContext.get_tenant_id()) if TenantContext.get_tenant_id() else None,
            "user_id": str(TenantContext.get_user_id()) if TenantContext.get_user_id() else None,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add extra fields
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        
        return json.dumps(log_data)


class StructuredLogger:
    """Wrapper for structured logging"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup logging handlers with JSON formatting"""
        settings = get_settings()
        
        # Only setup if no handlers already exist
        if self.logger.handlers:
            return
        
        # Console handler with JSON formatting
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(JSONFormatter())
        self.logger.addHandler(console_handler)
        
        # Set log level
        log_level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
        self.logger.setLevel(log_level)
    
    def info(self, message: str, **extra_data):
        """Log info message"""
        record = self.logger.makeRecord(
            self.logger.name, logging.INFO, "", 0, message, (), None
        )
        record.extra_data = extra_data
        self.logger.handle(record)
    
    def error(self, message: str, **extra_data):
        """Log error message"""
        record = self.logger.makeRecord(
            self.logger.name, logging.ERROR, "", 0, message, (), None
        )
        record.extra_data = extra_data
        self.logger.handle(record)
    
    def warning(self, message: str, **extra_data):
        """Log warning message"""
        record = self.logger.makeRecord(
            self.logger.name, logging.WARNING, "", 0, message, (), None
        )
        record.extra_data = extra_data
        self.logger.handle(record)
    
    def debug(self, message: str, **extra_data):
        """Log debug message"""
        record = self.logger.makeRecord(
            self.logger.name, logging.DEBUG, "", 0, message, (), None
        )
        record.extra_data = extra_data
        self.logger.handle(record)


def get_logger(name: str) -> StructuredLogger:
    """Get a structured logger instance"""
    return StructuredLogger(name)
