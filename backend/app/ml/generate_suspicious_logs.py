from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.access_log import AccessLog
from app.models.document import Document
from app.models.user import User


def generate_suspicious_logs(
    db,
    user_id: int = 3,
    hospital_id: int = 2,
    count: int = 100,
):
    """
    Generate synthetic suspicious behavior for ML testing.

    The generated events simulate:
    - High-volume record access
    - Access to many different patients
    - Access to many different documents
    - Late-night activity
    - Unknown device
    - Unusual IP address
    - Repeated denied attempts
    """

    # Get test patients
    patients = list(
        db.execute(
            select(User)
            .where(
                User.email.like(
                    "testpatient%@healthguard.local"
                )
            )
            .order_by(User.id)
        ).scalars().all()
    )

    # Get test documents
    documents = list(
        db.execute(
            select(Document)
            .where(
                Document.document_name.like(
                    "Test_Medical_Record_%"
                )
            )
            .order_by(Document.id)
        ).scalars().all()
    )

    if not patients:
        raise ValueError(
            "No test patients found. "
            "Run generate_test_data.py first."
        )

    if not documents:
        raise ValueError(
            "No test documents found. "
            "Run generate_test_data.py first."
        )

    base_time = datetime.utcnow()

    for i in range(count):

        # Generate activity around 2 AM
        accessed_at = (
            base_time - timedelta(minutes=i * 2)
        ).replace(
            hour=2,
            minute=(i * 2) % 60,
            second=0,
            microsecond=0,
        )

        # Every fifth request is denied
        if i % 5 == 0:
            decision = "DENY"
            reason = (
                "Access denied. "
                "Suspicious access pattern."
            )
        else:
            decision = "ALLOW"
            reason = "Document access permitted"

        # Rotate through real test patients/documents
        patient = patients[i % len(patients)]
        document = documents[i % len(documents)]

        log = AccessLog(
            user_id=user_id,
            hospital_id=hospital_id,
            patient_id=patient.id,
            document_id=document.id,
            consent_id=None,
            action="VIEW",
            purpose="Medical record access",
            decision=decision,
            risk_score=None,
            ip_address="192.168.100.50",
            user_agent="Unknown-Device",
            reason=reason,
            accessed_at=accessed_at,
        )

        db.add(log)

    db.commit()

    print(
        f"Created {count} suspicious access logs."
    )


def main():

    db = SessionLocal()

    try:

        generate_suspicious_logs(
            db=db,
            user_id=3,
            hospital_id=2,
            count=100,
        )

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()