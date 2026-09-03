"""
HealthGuard AI - Document Encryption Service

Handles encryption and decryption of medical documents
using Fernet symmetric authenticated encryption.
"""

import os

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv


load_dotenv()


ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")


if not ENCRYPTION_KEY:
    raise RuntimeError(
        "ENCRYPTION_KEY is missing. "
        "Add it to the backend .env file."
    )


try:
    fernet = Fernet(ENCRYPTION_KEY.encode())
except Exception as exc:
    raise RuntimeError(
        "ENCRYPTION_KEY is invalid. "
        "Generate a valid Fernet key using Fernet.generate_key()."
    ) from exc


def encrypt_data(data: bytes) -> bytes:
    """
    Encrypt raw document bytes.

    Returns:
        Encrypted bytes suitable for storage on disk.
    """

    if not data:
        raise ValueError("Cannot encrypt an empty document.")

    return fernet.encrypt(data)


def decrypt_data(encrypted_data: bytes) -> bytes:
    """
    Decrypt document bytes.

    Raises:
        ValueError if the encrypted data is invalid
        or the wrong encryption key is being used.
    """

    if not encrypted_data:
        raise ValueError("Encrypted document is empty.")

    try:
        return fernet.decrypt(encrypted_data)

    except InvalidToken as exc:
        raise ValueError(
            "Unable to decrypt document. "
            "The file may be corrupted or the encryption key is incorrect."
        ) from exc