from datetime import datetime, timedelta
import random

from app.core.database import SessionLocal
from app.models.access_log import AccessLog


def generate_normal_logs(
    db,
    user_id: int = 3,
    hospital_id: int = 2,
    patient_id: int = 1,
    document_id: int = 1,
    count: int = 20,
):
    """
    Generate realistic normal access behavior
    for development/testing.
    """

    now = datetime.utcnow()

    for i in range(count):

        # Spread activity across recent days
        days_ago = random.randint(1, 14)

        # Normal hospital working hours
        hour = random.randint(9, 17)
        minute = random.randint(0, 59)

        accessed_at = (
            now
            - timedelta(days=days_ago)
        ).replace(
            hour=hour,
            minute=minute,
            second=random.randint(0, 59),
            microsecond=0,
        )

        # Mostly successful access
        decision = (
            "DENY"
            if random.random() < 0.10
            else "ALLOW"
        )

        if decision == "ALLOW":
            reason = "Document access permitted"
        else:
            reason = (
                "Access denied. "
                "No valid approved consent exists."
            )

        log = AccessLog(
            user_id=user_id,
            hospital_id=hospital_id,
            patient_id=patient_id,
            document_id=document_id,
            consent_id=1,
            action="VIEW",
            purpose="Cardiac consultation",
            decision=decision,
            risk_score=None,
            ip_address="127.0.0.1",
            user_agent="HealthGuard-Test-Client",
            reason=reason,
            accessed_at=accessed_at,
        )

        db.add(log)

    db.commit()

    print(
        f"Created {count} normal access logs."
    )


def main():

    db = SessionLocal()

    try:

        generate_normal_logs(
            db=db,
            user_id=3,
            hospital_id=2,
            patient_id=1,
            document_id=1,
            count=20,
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()