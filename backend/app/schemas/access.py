from datetime import datetime

from pydantic import BaseModel


class AccessLogResponse(BaseModel):
    id: int
    user_id: int
    hospital_id: int | None
    patient_id: int
    document_id: int
    consent_id: int | None
    action: str
    purpose: str | None
    decision: str
    risk_score: float | None
    ip_address: str | None
    user_agent: str | None
    reason: str | None
    accessed_at: datetime

    model_config = {
        "from_attributes": True
    }