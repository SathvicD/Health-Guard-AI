from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_log import AccessLog


def get_access_logs_for_user(
    db: Session,
    user_id: int,
    days: int = 30,
):
    """Fetch recent access logs for a user."""

    cutoff_time = datetime.utcnow() - timedelta(days=days)

    statement = (
        select(AccessLog)
        .where(
            AccessLog.user_id == user_id,
            AccessLog.accessed_at >= cutoff_time,
        )
        .order_by(AccessLog.accessed_at.asc())
    )

    return list(
        db.execute(statement).scalars().all()
    )


def build_user_features(
    db: Session,
    user_id: int,
    days: int = 30,
):
    """
    Convert a user's access history into ML features.
    """

    logs = get_access_logs_for_user(
        db=db,
        user_id=user_id,
        days=days,
    )

    if not logs:
        return None

    data = []

    for log in logs:
        data.append(
            {
                "accessed_at": log.accessed_at,
                "decision": log.decision,
                "document_id": log.document_id,
                "patient_id": log.patient_id,
                "action": log.action,
            }
        )

    df = pd.DataFrame(data)

    # Convert timestamp
    df["accessed_at"] = pd.to_datetime(
        df["accessed_at"]
    )

    # Basic behavioral features
    total_accesses = len(df)

    allowed_accesses = (
        df["decision"] == "ALLOW"
    ).sum()

    denied_accesses = (
        df["decision"] == "DENY"
    ).sum()

    unique_patients = (
        df["patient_id"].nunique()
    )

    unique_documents = (
        df["document_id"].nunique()
    )

    view_count = (
        df["action"] == "VIEW"
    ).sum()

    # Access hour statistics
    df["hour"] = df["accessed_at"].dt.hour

    average_access_hour = df["hour"].mean()

    night_access_count = (
        (df["hour"] < 6) |
        (df["hour"] >= 22)
    ).sum()

    features = {
        "total_accesses": total_accesses,
        "allowed_accesses": int(allowed_accesses),
        "denied_accesses": int(denied_accesses),
        "unique_patients": unique_patients,
        "unique_documents": unique_documents,
        "view_count": int(view_count),
        "average_access_hour": float(
            average_access_hour
        ),
        "night_access_count": int(
            night_access_count
        ),
    }

    return features