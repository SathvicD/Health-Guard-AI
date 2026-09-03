from sqlalchemy.orm import Session

from app.models.access_log import AccessLog
from app.models.user import User


def create_access_log(
    db: Session,
    current_user: User,
    patient_id: int,
    document_id: int,
    consent_id: int | None,
    action: str,
    purpose: str | None,
    decision: str,
    risk_score: float | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    reason: str | None = None,
):
    log = AccessLog(
        user_id=current_user.id,
        hospital_id=current_user.hospital_id,
        patient_id=patient_id,
        document_id=document_id,
        consent_id=consent_id,
        action=action,
        purpose=purpose,
        decision=decision,
        risk_score=risk_score,
        ip_address=ip_address,
        user_agent=user_agent,
        reason=reason,
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log