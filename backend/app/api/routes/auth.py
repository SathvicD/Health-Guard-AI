from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
)
from app.schemas.auth import UserLogin, UserRegister, UserResponse
from app.services.auth_service import authenticate_user, create_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    """Register a new HealthGuard user."""

    try:
        user = create_user(db, user_data)

        return user

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.post("/login")
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    """Authenticate a user and return a JWT access token."""

    user = authenticate_user(
        db=db,
        email=user_data.email,
        password=user_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
    data={"sub": str(user.id), "role": user.role.value},
    expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }