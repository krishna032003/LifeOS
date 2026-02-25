from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UserProfileSchema(BaseModel):
    user_id: Optional[str] = None
    name: str = Field(..., description="User's full name")
    degree: str = Field(..., description="User's degree program")
    year: int = Field(..., ge=1, le=5, description="Year of study (1-5)")
    batch: str = Field(..., description="Batch or division section")
    goals: List[str] = Field(default_factory=list, description="Top active goals")
    constraints: List[str] = Field(default_factory=list, description="Schedule constraints")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class OnboardResponse(BaseModel):
    success: bool
    user_id: str
    message: str
