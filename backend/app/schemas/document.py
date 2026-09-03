from datetime import datetime

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    patient_id: int
    document_name: str = Field(min_length=1, max_length=255)
    document_type: str = Field(min_length=1, max_length=100)
    description: str | None = None


class DocumentResponse(BaseModel):
    id: int
    patient_id: int
    uploaded_by: int
    document_name: str
    document_type: str
    description: str | None
    storage_path: str
    is_encrypted: bool
    created_at: datetime

    model_config = {"from_attributes": True}