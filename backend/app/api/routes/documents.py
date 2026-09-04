from io import BytesIO
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
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

from app.models.document import Document
from app.models.user import User

from app.schemas.document import DocumentResponse

from app.services.document_service import (
    create_document,
    get_patient_documents,
)

from app.services.encryption_service import (
    decrypt_data,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


# =========================================================
# CURRENT USER
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

    user_id = int(
        payload["sub"]
    )

    statement = select(User).where(
        User.id == user_id
    )

    user = db.execute(
        statement
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
# UPLOAD MEDICAL DOCUMENT
# =========================================================

@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return create_document(
            db=db,
            current_user=current_user,
            file=file,
            document_type=document_type,
            description=description,
        )

    except PermissionError as exc:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# =========================================================
# GET MY DOCUMENTS
# =========================================================

@router.get(
    "/my-documents",
    response_model=list[DocumentResponse],
)
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return get_patient_documents(
            db=db,
            current_user=current_user,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


# =========================================================
# VIEW MY MEDICAL DOCUMENT
#
# Patient-only secure in-application viewing.
#
# The document is:
#   1. Authenticated using JWT
#   2. Restricted to the patient who owns it
#   3. Read from encrypted storage
#   4. Decrypted only in server memory
#   5. Streamed inline to the authenticated browser
#
# There is NO dedicated download endpoint here.
# =========================================================

@router.get(
    "/{document_id}/view",
)
def view_patient_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # =====================================================
    # PATIENT ROLE CHECK
    # =====================================================

    if current_user.role.value != "patient":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only patients can directly view "
                "their own documents."
            ),
        )


    # =====================================================
    # DOCUMENT OWNERSHIP CHECK
    # =====================================================

    statement = (
        select(Document)
        .where(
            Document.id == document_id,
            Document.patient_id == current_user.id,
        )
    )

    document = (
        db.execute(statement)
        .scalar_one_or_none()
    )


    if not document:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Document not found or you do not "
                "have permission to view it."
            ),
        )


    # =====================================================
    # STORAGE PATH
    # =====================================================

    storage_path = Path(
        document.storage_path
    )


    if not storage_path.exists():

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found in secure storage.",
        )


    if not storage_path.is_file():

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document storage entry is invalid.",
        )


    # =====================================================
    # READ FILE
    #
    # For the current project, documents are limited to
    # 10 MB, so reading into memory is acceptable.
    # =====================================================

    try:

        stored_data = (
            storage_path.read_bytes()
        )

    except OSError:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to read the document from secure storage.",
        )


    if not stored_data:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The document is empty.",
        )


    # =====================================================
    # DECRYPT DOCUMENT
    #
    # Encrypted documents are decrypted ONLY in memory.
    #
    # The decrypted document is never written back to disk.
    # =====================================================

    try:

        if document.is_encrypted:

            document_data = decrypt_data(
                stored_data
            )

        else:

            # Legacy documents that were uploaded before
            # encryption was enabled.

            document_data = stored_data

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


    if not document_data:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to prepare the document for viewing.",
        )


    # =====================================================
    # DETERMINE MIME TYPE
    # =====================================================

    extension = (
        Path(
            document.document_name
        )
        .suffix
        .lower()
    )


    media_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }


    media_type = media_types.get(
        extension,
        "application/octet-stream",
    )


    # =====================================================
    # INLINE SECURE VIEW
    # =====================================================

    return StreamingResponse(
        BytesIO(document_data),
        media_type=media_type,
        headers={
            # Browser should display the document instead
            # of treating this as a normal attachment.
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
            "X-Content-Type-Options": "nosniff",

            # Permit the application viewer to display it
            # inside the same application origin.
            "X-Frame-Options": "SAMEORIGIN",
        },
    )