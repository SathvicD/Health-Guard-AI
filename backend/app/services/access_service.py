from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.consent import Consent
from app.models.document import Document
from app.models.user import User


def access_document(
    db: Session,
    document_id: int,
    current_user: User,
):
    # ---------------------------------------------------------
    # STEP 1 — Only doctors can access shared documents
    # ---------------------------------------------------------

    if current_user.role.value != "doctor":
        raise ValueError(
            "Only doctors can access shared documents"
        )

    # ---------------------------------------------------------
    # STEP 2 — Find requested document
    # ---------------------------------------------------------

    document = db.execute(
        select(Document).where(
            Document.id == document_id
        )
    ).scalar_one_or_none()

    if not document:
        raise ValueError(
            "Document not found"
        )

    # ---------------------------------------------------------
    # STEP 3 — Find all matching approved consents
    #
    # IMPORTANT:
    # A doctor may have created multiple consent requests
    # for the same document during testing.
    #
    # Therefore, do NOT use scalar_one_or_none().
    # ---------------------------------------------------------

    statement = (
        select(Consent)
        .where(
            Consent.document_id == document_id,
            Consent.requesting_user_id == current_user.id,
            Consent.requesting_hospital_id == current_user.hospital_id,
            Consent.patient_id == document.patient_id,
            Consent.status == "approved",
        )
        .order_by(
            Consent.created_at.desc()
        )
    )

    consents = db.execute(
        statement
    ).scalars().all()

    # ---------------------------------------------------------
    # STEP 4 — Get current Indian Standard Time
    # ---------------------------------------------------------

    IST = ZoneInfo("Asia/Kolkata")

    now = datetime.now(IST).replace(
        tzinfo=None
    )

    # ---------------------------------------------------------
    # STEP 5 — Find a currently valid consent
    # ---------------------------------------------------------

    valid_consent = None
    future_consent = None

    for consent in consents:

        # -----------------------------------------------------
        # Consent has not started yet
        # -----------------------------------------------------

        if (
            consent.start_time
            and now < consent.start_time
        ):

            future_consent = consent
            continue

        # -----------------------------------------------------
        # Consent has already expired
        # -----------------------------------------------------

        if (
            consent.expiry_time
            and now >= consent.expiry_time
        ):

            consent.status = "expired"
            continue

        # -----------------------------------------------------
        # Consent is currently valid
        # -----------------------------------------------------

        valid_consent = consent
        break

    # ---------------------------------------------------------
    # Save any expired consent status changes
    # ---------------------------------------------------------

    db.commit()

    # ---------------------------------------------------------
    # STEP 6 — Valid consent not found
    # ---------------------------------------------------------

    if not valid_consent:

        if future_consent:

            raise ValueError(
                "Access denied. Consent period has not started."
            )

        raise ValueError(
            "Access denied. No valid approved consent exists."
        )

    # ---------------------------------------------------------
    # STEP 7 — Return document + valid consent
    #
    # access.py will now run the ML security analysis.
    # ---------------------------------------------------------

    return document, valid_consent