from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.consent import Consent
from app.models.document import Document
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.consent import ConsentCreate


def create_consent_request(
    db: Session,
    consent_data: ConsentCreate,
    current_user: User,
) -> Consent:

    # Only doctors can request access
    if current_user.role.value != "doctor":
        raise ValueError("Only doctors can request document access")

    # The requesting user must be the authenticated doctor
    if consent_data.requesting_user_id != current_user.id:
        raise ValueError("Invalid requesting user")

    # The requesting hospital must match the doctor's hospital
    if consent_data.requesting_hospital_id != current_user.hospital_id:
        raise ValueError("Doctor does not belong to the requesting hospital")

    # Validate hospital
    hospital = db.execute(
        select(Hospital).where(
            Hospital.id == consent_data.requesting_hospital_id
        )
    ).scalar_one_or_none()

    if not hospital:
        raise ValueError("Requesting hospital not found")

    if not hospital.is_active:
        raise ValueError("Requesting hospital is inactive")

    # Validate document
    document = db.execute(
        select(Document).where(
            Document.id == consent_data.document_id
        )
    ).scalar_one_or_none()

    if not document:
        raise ValueError("Document not found")

    # Prevent invalid time ranges
    if consent_data.expiry_time <= consent_data.start_time:
        raise ValueError("Expiry time must be after start time")

    # The consent belongs to the patient who owns the document
    consent = Consent(
        patient_id=document.patient_id,
        document_id=document.id,
        requesting_hospital_id=consent_data.requesting_hospital_id,
        requesting_user_id=consent_data.requesting_user_id,
        purpose=consent_data.purpose.strip(),
        status="pending",
        start_time=consent_data.start_time,
        expiry_time=consent_data.expiry_time,
    )

    db.add(consent)
    db.commit()
    db.refresh(consent)

    return consent


def get_patient_consent_requests(
    db: Session,
    current_user: User,
) -> list[Consent]:

    statement = (
        select(Consent)
        .where(Consent.patient_id == current_user.id)
        .order_by(Consent.created_at.desc())
    )

    return list(db.execute(statement).scalars().all())


def approve_consent(
    db: Session,
    consent_id: int,
    current_user: User,
) -> Consent:

    consent = db.execute(
        select(Consent).where(Consent.id == consent_id)
    ).scalar_one_or_none()

    if not consent:
        raise ValueError("Consent request not found")

    # Only the patient who owns the document can approve
    if consent.patient_id != current_user.id:
        raise ValueError("You cannot approve this consent request")

    if current_user.role.value != "patient":
        raise ValueError("Only the patient can approve consent")

    if consent.status != "pending":
        raise ValueError(
            f"Consent cannot be approved because it is already {consent.status}"
        )

    # Make sure the consent period is valid
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if consent.expiry_time <= now:
        consent.status = "expired"
        db.commit()
        db.refresh(consent)
        raise ValueError("Consent request has already expired")

    consent.status = "approved"

    db.commit()
    db.refresh(consent)

    return consent


def deny_consent(
    db: Session,
    consent_id: int,
    current_user: User,
) -> Consent:

    consent = db.execute(
        select(Consent).where(Consent.id == consent_id)
    ).scalar_one_or_none()

    if not consent:
        raise ValueError("Consent request not found")

    # Only the patient who owns the document can deny
    if consent.patient_id != current_user.id:
        raise ValueError("You cannot deny this consent request")

    if current_user.role.value != "patient":
        raise ValueError("Only the patient can deny consent")

    if consent.status != "pending":
        raise ValueError(
            f"Consent cannot be denied because it is already {consent.status}"
        )

    consent.status = "denied"

    db.commit()
    db.refresh(consent)

    return consent