from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, security_scheme

from app.models.access_log import AccessLog
from app.models.document import Document
from app.models.hospital import Hospital
from app.models.user import User

from app.schemas.security import (
    SecurityDashboardResponse,
    SecurityEventResponse,
)


router = APIRouter(
    prefix="/security",
    tags=["Security Center"],
)


# =========================================================
# CURRENT AUTHENTICATED USER
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security_scheme
    ),
    db: Session = Depends(get_db),
) -> User:

    payload = decode_access_token(
        credentials.credentials
    )

    user_id = int(payload["sub"])

    user = db.execute(
        select(User).where(
            User.id == user_id
        )
    ).scalar_one_or_none()

    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


# =========================================================
# SECURITY EVENT BUILDER
# =========================================================

def build_security_event(
    db: Session,
    log: AccessLog,
) -> SecurityEventResponse:

    # -----------------------------------------------------
    # Get user
    # -----------------------------------------------------

    user = db.execute(
        select(User).where(
            User.id == log.user_id
        )
    ).scalar_one_or_none()


    # -----------------------------------------------------
    # Get hospital
    # -----------------------------------------------------

    hospital = None

    if log.hospital_id:

        hospital = db.execute(
            select(Hospital).where(
                Hospital.id == log.hospital_id
            )
        ).scalar_one_or_none()


    # -----------------------------------------------------
    # Get document
    # -----------------------------------------------------

    document = db.execute(
        select(Document).where(
            Document.id == log.document_id
        )
    ).scalar_one_or_none()


    # -----------------------------------------------------
    # Determine risk level
    # -----------------------------------------------------

    risk_level = None

    if log.risk_score is not None:

        if log.risk_score < 40:

            risk_level = "LOW"

        elif log.risk_score < 70:

            risk_level = "MEDIUM"

        else:

            risk_level = "HIGH"


    # -----------------------------------------------------
    # Determine prediction
    #
    # This is derived from the audit decision/reason.
    # The actual ML prediction is not stored in the
    # AccessLog table.
    # -----------------------------------------------------

    prediction = None

    if log.risk_score is not None:

        if (
            log.decision == "DENY"
            and log.risk_score >= 70
        ):

            prediction = "ANOMALOUS"

        elif log.risk_score < 40:

            prediction = "NORMAL"

        else:

            prediction = "REVIEW"


    return SecurityEventResponse(

        id=log.id,

        user_id=log.user_id,

        user_name=(
            user.full_name
            if user
            else f"User #{log.user_id}"
        ),

        hospital_id=log.hospital_id,

        hospital_name=(
            hospital.name
            if hospital
            else None
        ),

        patient_id=log.patient_id,

        document_id=log.document_id,

        document_name=(
            document.document_name
            if document
            else f"Medical Document #{log.document_id}"
        ),

        consent_id=log.consent_id,

        action=log.action,

        purpose=log.purpose,

        decision=log.decision,

        risk_score=(
            round(log.risk_score, 2)
            if log.risk_score is not None
            else None
        ),

        risk_level=risk_level,

        prediction=prediction,

        ip_address=log.ip_address,

        user_agent=log.user_agent,

        reason=log.reason,

        accessed_at=log.accessed_at,
    )


# =========================================================
# SECURITY CENTER DASHBOARD
# =========================================================

@router.get(
    "/dashboard",
    response_model=SecurityDashboardResponse,
)
def security_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    # -----------------------------------------------------
    # Only hospital administrators can view the
    # organization-wide Security Center.
    # -----------------------------------------------------

    if current_user.role.value != "hospital_admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only hospital administrators "
                "can access the Security Center."
            ),
        )


    # -----------------------------------------------------
    # Hospital must be assigned
    # -----------------------------------------------------

    if current_user.hospital_id is None:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Hospital administrator is not "
                "assigned to a hospital."
            ),
        )


    hospital_id = current_user.hospital_id


    # -----------------------------------------------------
    # Base query
    # -----------------------------------------------------

    base_query = select(
        AccessLog
    ).where(
        AccessLog.hospital_id == hospital_id
    )


    logs = db.execute(
        base_query
        .order_by(
            AccessLog.accessed_at.desc()
        )
    ).scalars().all()


    # -----------------------------------------------------
    # Statistics
    # -----------------------------------------------------

    total_events = len(logs)

    allowed_events = sum(
        1
        for log in logs
        if log.decision == "ALLOW"
    )

    blocked_events = sum(
        1
        for log in logs
        if log.decision == "DENY"
    )

    mfa_events = sum(
        1
        for log in logs
        if log.decision == "MFA_REQUIRED"
    )

    high_risk_events = sum(
        1
        for log in logs
        if (
            log.risk_score is not None
            and log.risk_score >= 70
        )
    )

    anomalous_events = sum(
        1
        for log in logs
        if (
            log.risk_score is not None
            and log.risk_score >= 70
            and log.decision == "DENY"
        )
    )


    # -----------------------------------------------------
    # Recent events
    # -----------------------------------------------------

    recent_logs = logs[:10]


    recent_events = [
        build_security_event(
            db,
            log
        )
        for log in recent_logs
    ]


    return SecurityDashboardResponse(

        total_events=total_events,

        allowed_events=allowed_events,

        blocked_events=blocked_events,

        mfa_events=mfa_events,

        high_risk_events=high_risk_events,

        anomalous_events=anomalous_events,

        recent_events=recent_events,
    )


# =========================================================
# PATIENT AUDIT LOGS
# =========================================================

@router.get(
    "/audit-logs",
    response_model=list[SecurityEventResponse],
)
def patient_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    # -----------------------------------------------------
    # Only patients can access their own audit history.
    # -----------------------------------------------------

    if current_user.role.value != "patient":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only patients can access "
                "their audit logs."
            ),
        )


    # -----------------------------------------------------
    # Retrieve events concerning this patient.
    # -----------------------------------------------------

    logs = db.execute(
        select(AccessLog)
        .where(
            AccessLog.patient_id ==
            current_user.id
        )
        .order_by(
            AccessLog.accessed_at.desc()
        )
        .limit(100)
    ).scalars().all()


    return [
        build_security_event(
            db,
            log
        )
        for log in logs
    ]