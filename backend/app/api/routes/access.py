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

from app.services.access_service import access_document
from app.services.audit_service import create_access_log
from app.services.encryption_service import decrypt_data

from app.ml.model_training import train_ml_service


router = APIRouter(
    prefix="/access",
    tags=["Document Access"],
)


# ---------------------------------------------------------
# Train/load ML service when the API module starts
# ---------------------------------------------------------

ml_service = train_ml_service()


# ---------------------------------------------------------
# Current authenticated user
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Document access endpoint
# ---------------------------------------------------------

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

    # -----------------------------------------------------
    # STEP 1 — Validate consent and document access
    # -----------------------------------------------------

    try:

        document, consent = access_document(
            db=db,
            document_id=document_id,
            current_user=current_user,
        )

    except ValueError as exc:

        # Find document for audit logging
        document = db.execute(
            select(Document).where(
                Document.id == document_id
            )
        ).scalar_one_or_none()

        if document:

            # Find latest related consent
            consent = db.execute(
                select(Consent)
                .where(
                    Consent.document_id == document_id,
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
            ).scalars().first()

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
                ip_address=(
                    request.client.host
                    if request.client
                    else None
                ),
                user_agent=request.headers.get(
                    "user-agent"
                ),
                reason=str(exc),
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    # -----------------------------------------------------
    # STEP 2 — Run ML behavioral risk analysis
    # -----------------------------------------------------

    ml_result = ml_service.analyze_user(
        db=db,
        user_id=current_user.id,
    )

    # -----------------------------------------------------
    # STEP 3 — Handle insufficient ML history
    # -----------------------------------------------------

    if ml_result["status"] == "INSUFFICIENT_DATA":

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="VIEW",
            purpose=consent.purpose,
            decision="ALLOW",
            risk_score=None,
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                "ML analysis skipped due to "
                "insufficient access history; "
                "valid consent permitted access."
            ),
        )

        return document

    # -----------------------------------------------------
    # STEP 4 — Extract ML security decision
    # -----------------------------------------------------

    risk_score = ml_result["risk_score"]
    risk_level = ml_result["risk_level"]
    security_action = ml_result["security_action"]

    # -----------------------------------------------------
    # STEP 5 — HIGH RISK → DENY
    # -----------------------------------------------------

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
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                f"ML security analysis detected "
                f"anomalous behavior. "
                f"Risk level: {risk_level}. "
                f"Access blocked."
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
                "prediction": ml_result[
                    "prediction"
                ],
                "security_action": security_action,
            },
        )

    # -----------------------------------------------------
    # STEP 6 — MEDIUM RISK → MFA REQUIRED
    # -----------------------------------------------------

    if security_action == "MFA_REQUIRED":

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
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                f"ML analysis detected "
                f"medium-risk behavior. "
                f"Additional authentication "
                f"is required."
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
                "prediction": ml_result[
                    "prediction"
                ],
                "security_action": security_action,
            },
        )

    # -----------------------------------------------------
    # STEP 7 — LOW RISK → ALLOW
    # -----------------------------------------------------

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
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
        reason=(
            f"ML analysis approved access. "
            f"Risk level: {risk_level}."
        ),
    )

    return document

# ---------------------------------------------------------
# Secure medical document download
# ---------------------------------------------------------

@router.get(
    "/documents/{document_id}/download",
)
def download_shared_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # STEP 1 — Validate consent
    # -----------------------------------------------------

    try:

        document, consent = access_document(
            db=db,
            document_id=document_id,
            current_user=current_user,
        )

    except ValueError as exc:

        # Find document for audit logging
        document = db.execute(
            select(Document).where(
                Document.id == document_id
            )
        ).scalar_one_or_none()

        if document:

            consent = db.execute(
                select(Consent)
                .where(
                    Consent.document_id == document_id,
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
            ).scalars().first()

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
                action="DOWNLOAD",
                purpose=(
                    consent.purpose
                    if consent
                    else None
                ),
                decision="DENY",
                risk_score=None,
                ip_address=(
                    request.client.host
                    if request.client
                    else None
                ),
                user_agent=request.headers.get(
                    "user-agent"
                ),
                reason=str(exc),
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    # -----------------------------------------------------
    # STEP 2 — ML behavioral analysis
    # -----------------------------------------------------

    ml_result = ml_service.analyze_user(
        db=db,
        user_id=current_user.id,
    )

    # -----------------------------------------------------
    # STEP 3 — Insufficient ML history
    #
    # Valid consent is sufficient for the demo when
    # insufficient behavioral history exists.
    # -----------------------------------------------------

    if ml_result["status"] == "INSUFFICIENT_DATA":

        pass

    else:

        risk_score = ml_result["risk_score"]
        risk_level = ml_result["risk_level"]
        security_action = ml_result["security_action"]

        # -------------------------------------------------
        # HIGH RISK
        # -------------------------------------------------

        if security_action == "DENY":

            create_access_log(
                db=db,
                current_user=current_user,
                patient_id=document.patient_id,
                document_id=document.id,
                consent_id=consent.id,
                action="DOWNLOAD",
                purpose=consent.purpose,
                decision="DENY",
                risk_score=risk_score,
                ip_address=(
                    request.client.host
                    if request.client
                    else None
                ),
                user_agent=request.headers.get(
                    "user-agent"
                ),
                reason=(
                    "ML security analysis detected "
                    "anomalous behavior. "
                    f"Risk level: {risk_level}. "
                    "Download blocked."
                ),
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": (
                        "Document download denied "
                        "by HealthGuard AI."
                    ),
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "prediction": ml_result[
                        "prediction"
                    ],
                    "security_action": security_action,
                },
            )

        # -------------------------------------------------
        # MEDIUM RISK
        # -------------------------------------------------

        if security_action == "MFA_REQUIRED":

            create_access_log(
                db=db,
                current_user=current_user,
                patient_id=document.patient_id,
                document_id=document.id,
                consent_id=consent.id,
                action="DOWNLOAD",
                purpose=consent.purpose,
                decision="MFA_REQUIRED",
                risk_score=risk_score,
                ip_address=(
                    request.client.host
                    if request.client
                    else None
                ),
                user_agent=request.headers.get(
                    "user-agent"
                ),
                reason=(
                    "Medium-risk behavior detected. "
                    "Additional authentication required "
                    "before document download."
                ),
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": (
                        "Additional authentication "
                        "is required before downloading "
                        "this medical document."
                    ),
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "prediction": ml_result[
                        "prediction"
                    ],
                    "security_action": security_action,
                },
            )

    # -----------------------------------------------------
    # STEP 4 — Locate encrypted document
    # -----------------------------------------------------

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
            action="DOWNLOAD",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=(
                ml_result.get("risk_score")
                if ml_result.get("status")
                != "INSUFFICIENT_DATA"
                else None
            ),
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                "Secure document storage file "
                "was not found."
            ),
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secure document file not found.",
        )

    # -----------------------------------------------------
    # STEP 5 — Read encrypted bytes
    # -----------------------------------------------------

    try:

        encrypted_data = storage_path.read_bytes()

    except OSError:

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="DOWNLOAD",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=(
                ml_result.get("risk_score")
                if ml_result.get("status")
                != "INSUFFICIENT_DATA"
                else None
            ),
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                "Unable to read secure "
                "document storage."
            ),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to read secure document.",
        )

    # -----------------------------------------------------
    # STEP 6 — Decrypt document in memory
    # -----------------------------------------------------

    try:

        if document.is_encrypted:

            document_data = decrypt_data(
                encrypted_data
            )

        else:

            # Legacy document support.
            #
            # Existing older documents may still be
            # stored unencrypted. They should eventually
            # be migrated to encrypted storage.
            document_data = encrypted_data

    except ValueError:

        create_access_log(
            db=db,
            current_user=current_user,
            patient_id=document.patient_id,
            document_id=document.id,
            consent_id=consent.id,
            action="DOWNLOAD",
            purpose=consent.purpose,
            decision="DENY",
            risk_score=(
                ml_result.get("risk_score")
                if ml_result.get("status")
                != "INSUFFICIENT_DATA"
                else None
            ),
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get(
                "user-agent"
            ),
            reason=(
                "Document decryption failed."
            ),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to decrypt the medical document."
            ),
        )

    # -----------------------------------------------------
    # STEP 7 — Record successful download
    # -----------------------------------------------------

    create_access_log(
        db=db,
        current_user=current_user,
        patient_id=document.patient_id,
        document_id=document.id,
        consent_id=consent.id,
        action="DOWNLOAD",
        purpose=consent.purpose,
        decision="ALLOW",
        risk_score=(
            ml_result.get("risk_score")
            if ml_result.get("status")
            != "INSUFFICIENT_DATA"
            else None
        ),
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
        reason=(
            "Document access authorized. "
            "Encrypted document decrypted "
            "in memory and delivered securely."
        ),
    )

    # -----------------------------------------------------
    # STEP 8 — Return decrypted document
    #
    # The decrypted bytes exist only in memory.
    # We do NOT write the decrypted PDF to disk.
    # -----------------------------------------------------

    media_type = "application/octet-stream"

    if document.document_name.lower().endswith(
        ".pdf"
    ):
        media_type = "application/pdf"

    elif document.document_name.lower().endswith(
        ".png"
    ):
        media_type = "image/png"

    elif document.document_name.lower().endswith(
        ".jpg"
    ) or document.document_name.lower().endswith(
        ".jpeg"
    ):
        media_type = "image/jpeg"

    return StreamingResponse(
        BytesIO(document_data),
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{document.document_name}"'
            )
        },
    )