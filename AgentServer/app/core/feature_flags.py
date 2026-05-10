"""
Feature flags management
"""
from typing import Dict, Any, Optional
from functools import lru_cache
from app.core.settings import get_settings


class FeatureFlagManager:
    """Manage feature flags for A/B testing and gradual rollouts"""
    
    def __init__(self):
        self.flags = self._load_flags()
    
    def _load_flags(self) -> Dict[str, bool]:
        """Load feature flags from settings"""
        settings = get_settings()
        return settings.FEATURE_FLAGS or {}
    
    def is_enabled(self, flag_name: str, default: bool = False) -> bool:
        """Check if a feature flag is enabled"""
        return self.flags.get(flag_name, default)
    
    def enable_flag(self, flag_name: str) -> None:
        """Enable a feature flag"""
        self.flags[flag_name] = True
    
    def disable_flag(self, flag_name: str) -> None:
        """Disable a feature flag"""
        self.flags[flag_name] = False
    
    def get_all_flags(self) -> Dict[str, bool]:
        """Get all feature flags"""
        return self.flags.copy()


@lru_cache(maxsize=1)
def get_feature_flag_manager() -> FeatureFlagManager:
    """Get feature flag manager singleton"""
    return FeatureFlagManager()


# Common feature flags
FEATURE_FLAGS = {
    "multi_tenancy": True,
    "audit_logging": True,
    "rate_limiting": True,
    "advanced_metrics": False,
    "api_v2": True,
    "workflow_versioning": False,
    "agent_marketplace": False,
}
