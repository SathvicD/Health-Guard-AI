"""
HealthGuard AI - Document Service

Handles medical document upload, validation,
encrypted storage, and patient document retrieval.
"""

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.user import User
from app.services.encryption_service import encrypt_data


DOCUMENT_STORAGE_DIR = Path("storage/documents")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
}

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
}


DOCUMENT_STORAGE_DIR.mkdir(
    parents=True,
    exist_ok=True
)


def create_document(
    db: Session,
    current_user: User,
    file: UploadFile,
    document_type: str,
    description: str | None = None,
):
    """
    Upload and securely store a medical document.

    The uploaded file is:
    1. Validated
    2. Read into memory (maximum 10 MB)
    3. Encrypted
    4. Stored using a random UUID filename
    5. Registered in PostgreSQL
    """

    # ---------------------------------------------------------
    # 1. ROLE CHECK
    # ---------------------------------------------------------

    if current_user.role.value != "patient":
        raise PermissionError(
            "Only patients can upload medical documents."
        )

    # ---------------------------------------------------------
    # 2. FILE NAME VALIDATION
    # ---------------------------------------------------------

    original_filename = (file.filename or "").strip()

    if not original_filename:
        raise ValueError(
            "A valid filename is required."
        )

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. "
            "Allowed types: PDF, PNG, JPG, JPEG."
        )

    # ---------------------------------------------------------
    # 3. CONTENT TYPE VALIDATION
    # ---------------------------------------------------------

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            "Unsupported content type."
        )

    # ---------------------------------------------------------
    # 4. READ FILE
    # ---------------------------------------------------------

    chunks = []
    total_size = 0

    try:

        while True:

            chunk = file.file.read(1024 * 1024)

            if not chunk:
                break

            total_size += len(chunk)

            if total_size > MAX_FILE_SIZE:
                raise ValueError(
                    "File size exceeds the 10 MB limit."
                )

            chunks.append(chunk)

        if total_size == 0:
            raise ValueError(
                "The uploaded document is empty."
            )

        original_data = b"".join(chunks)

        # -----------------------------------------------------
        # 5. ENCRYPT DOCUMENT
        # -----------------------------------------------------

        encrypted_data = encrypt_data(original_data)

        # -----------------------------------------------------
        # 6. CREATE PATIENT STORAGE DIRECTORY
        # -----------------------------------------------------

        patient_directory = (
            DOCUMENT_STORAGE_DIR
            / f"patient_{current_user.id}"
        )

        patient_directory.mkdir(
            parents=True,
            exist_ok=True
        )

        # -----------------------------------------------------
        # 7. GENERATE RANDOM STORAGE NAME
        # -----------------------------------------------------

        encrypted_filename = (
            f"{uuid4().hex}.enc"
        )

        storage_file = (
            patient_directory
            / encrypted_filename
        )

        # -----------------------------------------------------
        # 8. WRITE ENCRYPTED DATA TO DISK
        # -----------------------------------------------------

        storage_file.write_bytes(
            encrypted_data
        )

        # -----------------------------------------------------
        # 9. CREATE DATABASE RECORD
        # -----------------------------------------------------

        document = Document(
            patient_id=current_user.id,
            uploaded_by=current_user.id,
            document_name=original_filename,
            document_type=document_type.strip(),
            description=(
                description.strip()
                if description
                else None
            ),
            storage_path=str(storage_file),
            is_encrypted=True,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return document

    except Exception:

        # -----------------------------------------------------
        # CLEANUP IF DATABASE/STORAGE OPERATION FAILS
        # -----------------------------------------------------

        try:

            if "storage_file" in locals():
                if storage_file.exists():
                    storage_file.unlink()

        except Exception:
            pass

        db.rollback()

        raise


def get_patient_documents(
    db: Session,
    current_user: User,
):
    """
    Return documents belonging to the authenticated patient.
    """

    if current_user.role.value != "patient":
        raise ValueError(
            "Direct document access is not allowed. "
            "Patient consent is required."
        )

    statement = (
        select(Document)
        .where(
            Document.patient_id == current_user.id
        )
        .order_by(
            Document.created_at.desc()
        )
    )

    return list(
        db.execute(statement)
        .scalars()
        .all()
    )