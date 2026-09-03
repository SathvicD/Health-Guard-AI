"""
HealthGuard AI
Application Configuration
"""

import os

from dotenv import load_dotenv


load_dotenv()


# =========================================================
# APPLICATION SETTINGS
# =========================================================

APP_NAME = os.getenv(
    "APP_NAME",
    "HealthGuard AI",
)

APP_VERSION = os.getenv(
    "APP_VERSION",
    "1.0.0",
)


# =========================================================
# DATABASE
# =========================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL"
)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured."
    )


# =========================================================
# JWT
# =========================================================

JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY"
)

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not configured."
    )


# =========================================================
# DOCUMENT ENCRYPTION
# =========================================================

ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY"
)

if not ENCRYPTION_KEY:
    raise RuntimeError(
        "ENCRYPTION_KEY is not configured."
    )


# =========================================================
# CORS
# =========================================================

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500",
).split(",")

CORS_ORIGINS = [
    origin.strip()
    for origin in CORS_ORIGINS
    if origin.strip()
]