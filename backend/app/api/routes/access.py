from io import BytesIO
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from fastapi.responses import StreamingResponse

from fastapi.security import HTTPAuthorizationCredentials

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.security import (
    decode_access_token,
    security_scheme,
)

from app.models.consent import Consent
from app.models.document import Document
from app.models.user import User

from app.schemas.document import DocumentResponse

from app.services.access_service import (
    access_document,
)

from app.services.audit_service import (
    create_access_log,
)

from app.services.encryption_service import (
    decrypt_data,
)

from app.ml.model_training import (
    train_ml_service,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/access",
    tags=["Document Access"],
)


# =========================================================
# ML SERVICE
# =========================================================
#
# The ML service is loaded when the API module starts.
#
# The service analyzes the authenticated doctor's
# historical access behavior.
# =========================================================

ml_service = train_ml_service()


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

    try:

        user_id = int(
            payload["sub"]
        )

    except (
        KeyError,
        TypeError,
        ValueError,
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user = db.execute(
        select(User).where(
            User.id == user_id
        )
    ).scalar_one_or_none()


    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )


    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )


    return user


# =========================================================
# HELPER — CLIENT IP
# =========================================================

def get_client_ip(
    request: Request,
) -> str | None:

    if request.client:

        return request.client.host

    return None


# =========================================================
# HELPER — USER AGENT
# =========================================================

def get_user_agent(
    request: Request,
) -> str | None:

    return request.headers.get(
        "user-agent"
    )


# =========================================================
# HELPER — FIND RELATED CONSENT
# =========================================================
#
# Used primarily for audit logging when access fails.
# =========================================================

def get_latest_related_consent(
    db: Session,
    document: Document,
    current_user: User,
) -> Consent | None:

    statement = (
        select(Consent)
        .where(
            Consent.document_id
            == document.id,

            Consent.requesting_user_id
            == current_user.id,

            Consent.requesting_hospital_id
            == current_user.hospital_id,

            Consent.patient_id
            == document.patient_id,
        )
        .order_by(
            Consent.created_at.desc()
        )
    )

    return (
        db.execute(statement)
        .scalars()
        .first()
    )


# =========================================================
# HELPER — FIND DOCUMENT
# =========================================================

def get_document(
    db: Session,
    document_id: int,
) -> Document | None:

    statement = (
        select(Document)
        .where(
            Document.id == document_id
        )
    )

    return (
        db.execute(statement)
        .scalar_one_or_none()
    )


# =========================================================
# HELPER — ML ANALYSIS
# =========================================================

def analyze_document_access(
    db: Session,
    current_user: User,
):

    return ml_service.analyze_user(
        db=db,
        user_id=current_user.id,
    )


# =========================================================
# HELPER — ENSURE DOCTOR
# =========================================================

def ensure_doctor(
    current_user: User,
):

    if current_user.role.value != "doctor":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only doctors can access "
                "shared medical documents."
            ),
        )


# =========================================================
# ACCESS SHARED DOCUMENT
# =========================================================
#
# This endpoint performs:
#
# 1. Doctor authentication
# 2. Doctor authorization
# 3. Patient consent validation
# 4. Consent time validation
# 5. ML behavioral analysis
# 6. Zero Trust security decision
#
# It returns document metadata.
#
# It does NOT decrypt or return the actual file.
# =========================================================

@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
)
def access_shared_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    # =====================================================
    # STEP 1 — DOCTOR AUTHORIZATION
    # =====================================================

    ensure_doctor(
        current_user
    )


    # =====================================================
    # STEP 2 — VALIDATE CONSENT
    # =====================================================

    try:

        document, consent = access_document(
            db=db,
            document_id=document_id,
            current_user=current_user,
        )

    except ValueError as exc:

        document = get_document(
            db=db,
            document_id=document_id,
        )


        if document:

            consent = get_latest_related_consent(
                db=db,
                document=document,
                current_user=current_user,
            )


            create_access_log(
                db=db,
                current_user=current_user,
                patient_id=document.patient_id,
                document_id=document.id,
                consent_id=(
                    consent.id
                    if consent
                    else None
                ),
                action="VIEW",
                purpose=(
                    consent.purpose
                    if consent
                    else None
                ),
                decision="DENY",
                risk_score=None,
                ip_address=get_client_ip(
                    request
                ),
                user_agent=get_user_agent(
                    request
                ),
                reason=str(exc),
            )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


    # =====================================================
    # STEP 3 — ML BEHAVIORAL ANALYSIS
    # =====================================================

    ml_result = analyze_document_access(
        db=db,
        current_user=current_user,
    )


    # =====================================================
    # STEP 4 — INSUFFICIENT ML HISTORY
    # =====================================================
    #
    # A new/low-history doctor is not automatically
    # blocked if valid patient consent exists.
    # =====================================================

    if (
        ml_result.get("status")
        == "INSUFFICIENT_DATA"
    ):

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="ACCESS_CHECK",
            purpose=consent.purpose,
            decision="ALLOW",
            risk_score=None,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Valid patient consent exists. "
                "ML analysis skipped because "
                "insufficient behavioral history "
                "is available."
            ),
        )

        return document


    # =====================================================
    # STEP 5 — EXTRACT ML RESULT
    # =====================================================

    risk_score = ml_result.get(
        "risk_score"
    )

    risk_level = ml_result.get(
        "risk_level"
    )

    prediction = ml_result.get(
        "prediction"
    )

    security_action = ml_result.get(
        "security_action"
    )


    # =====================================================
    # STEP 6 — HIGH RISK → DENY
    # =====================================================

    if security_action == "DENY":

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="ACCESS_CHECK",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "ML security analysis detected "
                "anomalous behavior. "
                f"Risk level: {risk_level}. "
                "Access blocked."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Access denied by HealthGuard AI."
                ),
                "risk_level": risk_level,
                "risk_score": risk_score,
                "prediction": prediction,
                "security_action": security_action,
            },
        )


    # =====================================================
    # STEP 7 — MEDIUM RISK → MFA
    # =====================================================

    if (
        security_action
        == "MFA_REQUIRED"
    ):

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="ACCESS_CHECK",
            purpose=consent.purpose,
            decision="MFA_REQUIRED",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "ML analysis detected "
                "medium-risk behavior. "
                "Additional authentication "
                "is required."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Additional authentication "
                    "is required before accessing "
                    "this medical document."
                ),
                "risk_level": risk_level,
                "risk_score": risk_score,
                "prediction": prediction,
                "security_action": security_action,
            },
        )


    # =====================================================
    # STEP 8 — LOW RISK → ALLOW
    # =====================================================

    create_access_log(
        db=db,
        current_user=current_user,
        patient_id=document.patient_id,
        document_id=document.id,
        consent_id=consent.id,
        action="ACCESS_CHECK",
        purpose=consent.purpose,
        decision="ALLOW",
        risk_score=risk_score,
        ip_address=get_client_ip(
            request
        ),
        user_agent=get_user_agent(
            request
        ),
        reason=(
            "ML security analysis approved "
            "document access. "
            f"Risk level: {risk_level}."
        ),
    )


    return document


# =========================================================
# SECURE IN-APP SHARED DOCUMENT VIEWER
# =========================================================
#
# This is the endpoint that actually returns the medical
# document to the authenticated doctor.
#
# Security sequence:
#
# Doctor JWT
#      ↓
# Doctor role
#      ↓
# Patient consent
#      ↓
# Consent time window
#      ↓
# ML behavioral analysis
#      ↓
# Security decision
#      ↓
# Encrypted storage
#      ↓
# Decrypt in memory
#      ↓
# Stream inline
#
# There is NO dedicated download endpoint.
# =========================================================

@router.get(
    "/documents/{document_id}/view",
)
def view_shared_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    # =====================================================
    # STEP 1 — DOCTOR AUTHORIZATION
    # =====================================================

    ensure_doctor(
        current_user
    )


    # =====================================================
    # STEP 2 — VALIDATE CONSENT
    # =====================================================

    try:

        document, consent = access_document(
            db=db,
            document_id=document_id,
            current_user=current_user,
        )

    except ValueError as exc:

        document = get_document(
            db=db,
            document_id=document_id,
        )


        if document:

            consent = get_latest_related_consent(
                db=db,
                document=document,
                current_user=current_user,
            )


            create_access_log(
                db=db,
                current_user=current_user,
                patient_id=document.patient_id,
                document_id=document.id,
                consent_id=(
                    consent.id
                    if consent
                    else None
                ),
                action="VIEW",
                purpose=(
                    consent.purpose
                    if consent
                    else None
                ),
                decision="DENY",
                risk_score=None,
                ip_address=get_client_ip(
                    request
                ),
                user_agent=get_user_agent(
                    request
                ),
                reason=str(exc),
            )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


    # =====================================================
    # STEP 3 — ML BEHAVIORAL ANALYSIS
    # =====================================================

    ml_result = analyze_document_access(
        db=db,
        current_user=current_user,
    )


    # =====================================================
    # STEP 4 — ML STATUS
    # =====================================================

    if (
        ml_result.get("status")
        == "INSUFFICIENT_DATA"
    ):

        risk_score = None
        risk_level = "UNKNOWN"
        prediction = "INSUFFICIENT_DATA"
        security_action = "ALLOW"

    else:

        risk_score = ml_result.get(
            "risk_score"
        )

        risk_level = ml_result.get(
            "risk_level"
        )

        prediction = ml_result.get(
            "prediction"
        )

        security_action = ml_result.get(
            "security_action"
        )


    # =====================================================
    # STEP 5 — HIGH RISK → DENY
    # =====================================================

    if security_action == "DENY":

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "ML security analysis detected "
                "anomalous behavior. "
                f"Risk level: {risk_level}. "
                "Secure document viewer blocked."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Secure document viewing "
                    "was denied by HealthGuard AI."
                ),
                "risk_level": risk_level,
                "risk_score": risk_score,
                "prediction": prediction,
                "security_action": security_action,
            },
        )


    # =====================================================
    # STEP 6 — MEDIUM RISK → MFA
    # =====================================================

    if (
        security_action
        == "MFA_REQUIRED"
    ):

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="MFA_REQUIRED",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Medium-risk behavior detected. "
                "Additional authentication required "
                "before secure document viewing."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Additional authentication "
                    "is required before viewing "
                    "this medical document."
                ),
                "risk_level": risk_level,
                "risk_score": risk_score,
                "prediction": prediction,
                "security_action": security_action,
            },
        )


    # =====================================================
    # STEP 7 — VERIFY STORAGE PATH
    # =====================================================

    storage_path = Path(
        document.storage_path
    )


    if not storage_path.exists():

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Secure medical document "
                "was not found in storage."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Secure medical document "
                "was not found."
            ),
        )


    if not storage_path.is_file():

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Document storage path "
                "is invalid."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Medical document storage "
                "entry is invalid."
            ),
        )


    # =====================================================
    # STEP 8 — READ ENCRYPTED STORAGE
    # =====================================================

    try:

        stored_data = (
            storage_path.read_bytes()
        )

    except OSError:

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Unable to read secure "
                "document storage."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to read the secure "
                "medical document."
            ),
        )


    if not stored_data:

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Stored medical document "
                "contains no data."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "The medical document is empty."
            ),
        )


    # =====================================================
    # STEP 9 — DECRYPT IN MEMORY
    # =====================================================
    #
    # The decrypted bytes are never written to disk.
    # =====================================================

    try:

        if document.is_encrypted:

            document_data = decrypt_data(
                stored_data
            )

        else:

            # Legacy support for documents uploaded before
            # encryption was enabled.
            #
            # These should eventually be migrated to
            # encrypted storage.

            document_data = stored_data

    except ValueError:

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=risk_score,
            ip_address=get_client_ip(
                request
            ),
            user_agent=get_user_agent(
                request
            ),
            reason=(
                "Medical document decryption failed."
            ),
        )


        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to decrypt the "
                "medical document."
            ),
        )


    if not document_data:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Unable to prepare the document "
                "for secure viewing."
            ),
        )


    # =====================================================
    # STEP 10 — DETERMINE MIME TYPE
    # =====================================================

    document_name = (
        document.document_name.lower()
    )


    if document_name.endswith(
        ".pdf"
    ):

        media_type = (
            "application/pdf"
        )

    elif document_name.endswith(
        ".png"
    ):

        media_type = (
            "image/png"
        )

    elif (
        document_name.endswith(".jpg")
        or
        document_name.endswith(".jpeg")
    ):

        media_type = (
            "image/jpeg"
        )

    else:

        media_type = (
            "application/octet-stream"
        )


    # =====================================================
    # STEP 11 — SUCCESSFUL VIEW AUDIT
    # =====================================================

    create_access_log(
        db=db,
        current_user=current_user,
        patient_id=document.patient_id,
        document_id=document.id,
        consent_id=consent.id,
        action="VIEW",
        purpose=consent.purpose,
        decision="ALLOW",
        risk_score=risk_score,
        ip_address=get_client_ip(
            request
        ),
        user_agent=get_user_agent(
            request
        ),
        reason=(
            "Secure in-app document viewing "
            "authorized. Document decrypted "
            "in memory and streamed inline. "
            f"Risk level: {risk_level}."
        ),
    )


    # =====================================================
    # STEP 12 — STREAM INLINE
    # =====================================================
    #
    # Content-Disposition: inline
    # allows the browser to render the document.
    #
    # There is intentionally no:
    #
    #     Content-Disposition: attachment
    #
    # and no dedicated /download endpoint.
    #
    # IMPORTANT:
    # This does not make browser content impossible
    # to save or screenshot. The decrypted content
    # necessarily reaches the authenticated browser.
    # =====================================================

    return StreamingResponse(
        BytesIO(document_data),
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{document.document_name}"'
            ),

            # Prevent browser/proxy caching.
            "Cache-Control": (
                "no-store, "
                "no-cache, "
                "must-revalidate, "
                "private"
            ),

            "Pragma": "no-cache",

            "Expires": "0",

            # Prevent MIME sniffing.
            "X-Content-Type-Options": (
                "nosniff"
            ),

            # Restrict framing to this application origin.
            "X-Frame-Options": (
                "SAMEORIGIN"
            ),
        },
    )