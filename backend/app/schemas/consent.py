from datetime import datetime

from pydantic import BaseModel, Field


class ConsentCreate(BaseModel):
    document_id: int
    requesting_hospital_id: int
    requesting_user_id: int
    purpose: str = Field(min_length=5, max_length=255)
    start_time: datetime
    expiry_time: datetime


class ConsentResponse(BaseModel):
    id: int
    patient_id: int
    document_id: int
    requesting_hospital_id: int
    requesting_user_id: int
    purpose: str
    status: str
    start_time: datetime | None
    expiry_time: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}