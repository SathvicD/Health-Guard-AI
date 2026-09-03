from datetime import datetime

from pydantic import BaseModel


class SecurityEventResponse(BaseModel):
    id: int

    user_id: int
    user_name: str

    hospital_id: int | None
    hospital_name: str | None

    patient_id: int

    document_id: int
    document_name: str

    consent_id: int | None

    action: str
    purpose: str | None

    decision: str

    risk_score: float | None
    risk_level: str | None
    prediction: str | None

    ip_address: str | None
    user_agent: str | None

    reason: str | None

    accessed_at: datetime


class SecurityDashboardResponse(BaseModel):
    total_events: int
    allowed_events: int
    blocked_events: int
    mfa_events: int
    high_risk_events: int
    anomalous_events: int

    recent_events: list[SecurityEventResponse]