from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.document import Document


def generate_test_data(db):
    # Check whether test data already exists
    existing_test_patients = (
        db.query(User)
        .filter(User.email.like("testpatient%@healthguard.local"))
        .count()
    )

    if existing_test_patients > 0:
        print(
            f"Test data already exists: "
            f"{existing_test_patients} test patients found."
        )
        return

    print("Creating test patients and documents...")

    password_hash = hash_password("TestPatient@2026!")

    created_patients = []
    created_documents = []

    # Create 50 test patients
    for i in range(1, 51):

        patient = User(
            email=f"testpatient{i}@healthguard.local",
            password_hash=password_hash,
            full_name=f"Test Patient {i}",
            role=UserRole.PATIENT,
            hospital_id=None,
            is_active=True,
        )

        db.add(patient)
        db.flush()

        created_patients.append(patient)

    # Create one document for every test patient
    for i, patient in enumerate(created_patients, start=1):

        document = Document(
            patient_id=patient.id,
            uploaded_by=patient.id,
            document_name=f"Test_Medical_Record_{i}.pdf",
            document_type="Medical Record",
            description="Synthetic test document for ML testing",
            storage_path=f"storage/test_documents/patient_{patient.id}",
            is_encrypted=True,
        )

        db.add(document)
        db.flush()

        created_documents.append(document)

    db.commit()

    print(
        f"Created {len(created_patients)} test patients."
    )

    print(
        f"Created {len(created_documents)} test documents."
    )


def main():

    db = SessionLocal()

    try:

        generate_test_data(db)

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()