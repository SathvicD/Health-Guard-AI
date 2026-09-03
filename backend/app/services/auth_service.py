from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.auth import UserRegister


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email.lower())
    return db.execute(statement).scalar_one_or_none()


def create_user(db: Session, user_data: UserRegister) -> User:
    """
    Create a new public HealthGuard AI account.

    Public registration is allowed only for:
        - patient
        - doctor

    Hospital administrators and other privileged roles must not
    be created through the public registration endpoint.
    """

    # ---------------------------------------------------------
    # Validate publicly allowed roles
    # ---------------------------------------------------------

    allowed_public_roles = {
        "patient",
        "doctor",
    }

    role = user_data.role.value

    if role not in allowed_public_roles:
        raise ValueError(
            "This account type cannot be created through public registration."
        )

    # ---------------------------------------------------------
    # Check duplicate email
    # ---------------------------------------------------------

    existing_user = get_user_by_email(
        db,
        user_data.email,
    )

    if existing_user:
        raise ValueError(
            "Email already registered"
        )

    # ---------------------------------------------------------
    # Doctor hospital validation
    # ---------------------------------------------------------

    if role == "doctor":

        if user_data.hospital_id is None:
            raise ValueError(
                "Doctor must be associated with a hospital."
            )

        hospital = db.execute(
            select(Hospital).where(
                Hospital.id == user_data.hospital_id
            )
        ).scalar_one_or_none()

        if not hospital:
            raise ValueError(
                "Hospital not found."
            )

        if not hospital.is_active:
            raise ValueError(
                "Selected hospital is inactive."
            )

    # ---------------------------------------------------------
    # Patient registration
    # ---------------------------------------------------------

    if role == "patient":

        # Patients are not required to belong to a hospital.
        # Ignore any hospital_id supplied by the client.
        hospital_id = None

    else:

        hospital_id = user_data.hospital_id

    # ---------------------------------------------------------
    # Create user
    # ---------------------------------------------------------

    new_user = User(
        email=user_data.email.lower().strip(),
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name.strip(),
        role=user_data.role,
        hospital_id=hospital_id,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:

    user = get_user_by_email(
        db,
        email,
    )

    if not user:
        return None

    if not user.is_active:
        return None

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None

    return user