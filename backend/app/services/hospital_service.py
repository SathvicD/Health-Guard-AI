from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hospital import Hospital
from app.schemas.hospital import HospitalCreate


def create_hospital(
    db: Session,
    hospital_data: HospitalCreate,
) -> Hospital:

    existing_hospital = db.execute(
        select(Hospital).where(
            Hospital.registration_number
            == hospital_data.registration_number
        )
    ).scalar_one_or_none()

    if existing_hospital:
        raise ValueError("Hospital registration number already exists")

    hospital = Hospital(
        name=hospital_data.name.strip(),
        registration_number=hospital_data.registration_number.strip(),
        address=hospital_data.address.strip(),
        city=hospital_data.city.strip(),
        state=hospital_data.state.strip(),
    )

    db.add(hospital)
    db.commit()
    db.refresh(hospital)

    return hospital


def get_hospital(
    db: Session,
    hospital_id: int,
) -> Hospital | None:

    statement = select(Hospital).where(
        Hospital.id == hospital_id
    )

    return db.execute(statement).scalar_one_or_none()


def get_hospitals(db: Session) -> list[Hospital]:

    statement = select(Hospital).order_by(Hospital.id)

    return list(db.execute(statement).scalars().all())