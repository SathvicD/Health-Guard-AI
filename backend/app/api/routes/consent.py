from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, security_scheme
from app.models.user import User
from app.schemas.consent import ConsentCreate, ConsentResponse
from app.services.consent_service import (
    approve_consent,
    create_consent_request,
    deny_consent,
    get_patient_consent_requests,
)

router = APIRouter(prefix="/consents", tags=["Consents"])


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:

    payload = decode_access_token(credentials.credentials)

    user_id = int(payload["sub"])

    statement = select(User).where(User.id == user_id)

    user = db.execute(statement).scalar_one_or_none()

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


@router.post(
    "",
    response_model=ConsentResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_consent(
    consent_data: ConsentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_consent_request(
            db=db,
            consent_data=consent_data,
            current_user=current_user,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.get(
    "/my-requests",
    response_model=list[ConsentResponse],
)
def get_my_consent_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_patient_consent_requests(
        db=db,
        current_user=current_user,
    )


@router.patch(
    "/{consent_id}/approve",
    response_model=ConsentResponse,
)
def approve_consent_request(
    consent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return approve_consent(
            db=db,
            consent_id=consent_id,
            current_user=current_user,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.patch(
    "/{consent_id}/deny",
    response_model=ConsentResponse,
)
def deny_consent_request(
    consent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return deny_consent(
            db=db,
            consent_id=consent_id,
            current_user=current_user,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )