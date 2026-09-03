from datetime import datetime

from pydantic import BaseModel, Field


class HospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    registration_number: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=2, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)


class HospitalResponse(BaseModel):
    id: int
    name: str
    registration_number: str
    address: str
    city: str
    state: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}