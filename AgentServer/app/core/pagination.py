"""
Pagination utilities
"""
from typing import TypeVar, Generic, List
from pydantic import BaseModel, Field
from math import ceil

T = TypeVar('T')


class PaginationParams(BaseModel):
    """Pagination parameters"""
    skip: int = Field(default=0, ge=0, description="Number of records to skip")
    limit: int = Field(default=20, ge=1, le=100, description="Number of records to return")
    
    @property
    def offset(self) -> int:
        return self.skip


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    data: List[T]
    total: int
    skip: int
    limit: int
    
    @property
    def page(self) -> int:
        """Calculate current page number (1-indexed)"""
        return (self.skip // self.limit) + 1
    
    @property
    def pages(self) -> int:
        """Calculate total number of pages"""
        return ceil(self.total / self.limit) if self.limit > 0 else 0
    
    @property
    def has_more(self) -> bool:
        """Check if there are more records"""
        return (self.skip + self.limit) < self.total
