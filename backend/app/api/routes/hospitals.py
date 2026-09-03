from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, security_scheme
from app.schemas.hospital import HospitalCreate, HospitalResponse
from app.services.hospital_service import (
    create_hospital,
    get_hospital,
    get_hospitals,
)

router = APIRouter(
    prefix="/hospitals",
    tags=["Hospitals"],
)


def require_authentication(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
):
    return decode_access_token(credentials.credentials)


@router.post(
    "",
    response_model=HospitalResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_hospital(
    hospital_data: HospitalCreate,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_authentication),
):
    try:
        return create_hospital(db, hospital_data)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=list[HospitalResponse],
)
def list_hospitals(
    db: Session = Depends(get_db),
):
    return get_hospitals(db)


@router.get(
    "/{hospital_id}",
    response_model=HospitalResponse,
)
def read_hospital(
    hospital_id: int,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_authentication),
):
    hospital = get_hospital(db, hospital_id)

    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found",
        )

    return hospital