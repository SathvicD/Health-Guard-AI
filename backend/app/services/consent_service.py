from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.consent import Consent
from app.models.document import Document
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.consent import ConsentCreate


# ============================================================
# CREATE CONSENT REQUEST
# Doctor → Patient
# ============================================================

def create_consent_request(
    db: Session,
    consent_data: ConsentCreate,
    current_user: User,
) -> Consent:

    # --------------------------------------------------------
    # 1. Only doctors can request document access
    # --------------------------------------------------------

    if current_user.role.value != "doctor":
        raise ValueError(
            "Only doctors can request document access"
        )


    # --------------------------------------------------------
    # 2. Requesting user must be the authenticated doctor
    # --------------------------------------------------------

    if consent_data.requesting_user_id != current_user.id:
        raise ValueError(
            "Invalid requesting user"
        )


    # --------------------------------------------------------
    # 3. Doctor must belong to the requesting hospital
    # --------------------------------------------------------

    if (
        consent_data.requesting_hospital_id
        != current_user.hospital_id
    ):
        raise ValueError(
            "Doctor does not belong to the requesting hospital"
        )


    # --------------------------------------------------------
    # 4. Validate requesting hospital
    # --------------------------------------------------------

    hospital = db.execute(
        select(Hospital).where(
            Hospital.id
            == consent_data.requesting_hospital_id
        )
    ).scalar_one_or_none()


    if not hospital:
        raise ValueError(
            "Requesting hospital not found"
        )


    if not hospital.is_active:
        raise ValueError(
            "Requesting hospital is inactive"
        )


    # --------------------------------------------------------
    # 5. Validate document
    # --------------------------------------------------------

    document = db.execute(
        select(Document).where(
            Document.id
            == consent_data.document_id
        )
    ).scalar_one_or_none()


    if not document:
        raise ValueError(
            "Medical document not found"
        )


    # --------------------------------------------------------
    # 6. Validate document owner
    #
    # The patient receiving the consent request is ALWAYS
    # the patient who owns the requested document.
    # --------------------------------------------------------

    patient = db.execute(
        select(User).where(
            User.id == document.patient_id
        )
    ).scalar_one_or_none()


    if not patient:
        raise ValueError(
            "The patient who owns this document could not be found"
        )


    if patient.role.value != "patient":
        raise ValueError(
            "Document owner is not a valid patient account"
        )


    if not patient.is_active:
        raise ValueError(
            "The patient account owning this document is inactive"
        )


    # --------------------------------------------------------
    # 7. Prevent a doctor from requesting their own document
    # --------------------------------------------------------

    if document.patient_id == current_user.id:
        raise ValueError(
            "A doctor cannot request access to their own document"
        )


    # --------------------------------------------------------
    # 8. Validate consent time range
    # --------------------------------------------------------

    if consent_data.expiry_time <= consent_data.start_time:
        raise ValueError(
            "Expiry time must be after start time"
        )


    # --------------------------------------------------------
    # 9. Prevent duplicate pending requests
    #
    # Same doctor + same document + pending
    # --------------------------------------------------------

    duplicate_pending = db.execute(
        select(Consent).where(
            Consent.document_id
            == document.id,

            Consent.requesting_user_id
            == current_user.id,

            Consent.requesting_hospital_id
            == current_user.hospital_id,

            Consent.status
            == "pending",
        )
    ).scalar_one_or_none()


    if duplicate_pending:
        raise ValueError(
            "A pending access request already exists for this document"
        )


    # --------------------------------------------------------
    # 10. Prevent duplicate currently-approved access
    # --------------------------------------------------------

    now = datetime.now(timezone.utc).replace(
        tzinfo=None
    )


    approved_consents = db.execute(
        select(Consent).where(
            Consent.document_id
            == document.id,

            Consent.requesting_user_id
            == current_user.id,

            Consent.requesting_hospital_id
            == current_user.hospital_id,

            Consent.status
            == "approved",
        )
    ).scalars().all()


    for existing_consent in approved_consents:

        start_time = (
            existing_consent.start_time
            or now
        )

        expiry_time = (
            existing_consent.expiry_time
        )


        # Currently active approved consent
        if (
            start_time <= now
            and (
                expiry_time is None
                or now < expiry_time
            )
        ):

            raise ValueError(
                "An active approved consent already exists for this document"
            )


    # --------------------------------------------------------
    # 11. Create consent
    #
    # IMPORTANT:
    # patient_id comes from the document owner.
    # It is NOT accepted from the doctor.
    # --------------------------------------------------------

    purpose = (
        consent_data.purpose.strip()
        if consent_data.purpose
        else "Medical record access"
    )


    consent = Consent(

        # Patient who owns the document
        patient_id=document.patient_id,

        # Requested document
        document_id=document.id,

        # Doctor's hospital
        requesting_hospital_id=(
            consent_data.requesting_hospital_id
        ),

        # Authenticated doctor
        requesting_user_id=current_user.id,

        # Reason for access
        purpose=purpose,

        # Initial state
        status="pending",

        # Requested access period
        start_time=consent_data.start_time,

        expiry_time=consent_data.expiry_time,
    )


    db.add(consent)

    db.commit()

    db.refresh(consent)


    return consent


# ============================================================
# GET PATIENT CONSENT REQUESTS
# Patient → Requests received for their documents
# ============================================================

def get_patient_consent_requests(
    db: Session,
    current_user: User,
) -> list[Consent]:

    # --------------------------------------------------------
    # Only patients should receive patient consent requests
    # --------------------------------------------------------

    if current_user.role.value != "patient":
        raise ValueError(
            "Only patients can view received consent requests"
        )


    statement = (
        select(Consent)
        .where(
            Consent.patient_id
            == current_user.id
        )
        .order_by(
            Consent.created_at.desc()
        )
    )


    return list(
        db.execute(statement)
        .scalars()
        .all()
    )


# ============================================================
# APPROVE CONSENT
# Patient → Approve doctor's request
# ============================================================

def approve_consent(
    db: Session,
    consent_id: int,
    current_user: User,
) -> Consent:

    # --------------------------------------------------------
    # Only patients can approve
    # --------------------------------------------------------

    if current_user.role.value != "patient":
        raise ValueError(
            "Only the patient can approve consent"
        )


    # --------------------------------------------------------
    # Find consent
    # --------------------------------------------------------

    consent = db.execute(
        select(Consent).where(
            Consent.id == consent_id
        )
    ).scalar_one_or_none()


    if not consent:
        raise ValueError(
            "Consent request not found"
        )


    # --------------------------------------------------------
    # Patient ownership validation
    # --------------------------------------------------------

    if consent.patient_id != current_user.id:
        raise ValueError(
            "You cannot approve this consent request"
        )


    # --------------------------------------------------------
    # Only pending requests can be approved
    # --------------------------------------------------------

    if consent.status != "pending":
        raise ValueError(
            "Consent cannot be approved because it is already "
            f"{consent.status}"
        )


    # --------------------------------------------------------
    # Validate expiry
    # --------------------------------------------------------

    now = datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )


    if (
        consent.expiry_time
        and consent.expiry_time <= now
    ):

        consent.status = "expired"

        db.commit()

        db.refresh(consent)

        raise ValueError(
            "Consent request has already expired"
        )


    # --------------------------------------------------------
    # Approve
    # --------------------------------------------------------

    consent.status = "approved"


    db.commit()

    db.refresh(consent)


    return consent


# ============================================================
# DENY CONSENT
# Patient → Deny doctor's request
# ============================================================

def deny_consent(
    db: Session,
    consent_id: int,
    current_user: User,
) -> Consent:

    # --------------------------------------------------------
    # Only patients can deny
    # --------------------------------------------------------

    if current_user.role.value != "patient":
        raise ValueError(
            "Only the patient can deny consent"
        )


    # --------------------------------------------------------
    # Find consent
    # --------------------------------------------------------

    consent = db.execute(
        select(Consent).where(
            Consent.id == consent_id
        )
    ).scalar_one_or_none()


    if not consent:
        raise ValueError(
            "Consent request not found"
        )


    # --------------------------------------------------------
    # Patient ownership validation
    # --------------------------------------------------------

    if consent.patient_id != current_user.id:
        raise ValueError(
            "You cannot deny this consent request"
        )


    # --------------------------------------------------------
    # Only pending requests can be denied
    # --------------------------------------------------------

    if consent.status != "pending":
        raise ValueError(
            "Consent cannot be denied because it is already "
            f"{consent.status}"
        )


    # --------------------------------------------------------
    # Deny
    # --------------------------------------------------------

    consent.status = "denied"


    db.commit()

    db.refresh(consent)


    return consent