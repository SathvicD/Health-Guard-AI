from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, security_scheme
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.document_service import (
    create_document,
    get_patient_documents,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


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