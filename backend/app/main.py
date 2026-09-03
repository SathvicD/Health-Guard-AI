from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.hospitals import router as hospitals_router
from app.api.routes.documents import router as documents_router
from app.api.routes.consent import router as consent_router
from app.api.routes.access import router as access_router
from app.api.routes.security import router as security_router

from app.core.config import (
    APP_NAME,
    APP_VERSION,
    CORS_ORIGINS,
)


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title=APP_NAME,
    description=(
        "AI-Powered Zero-Trust Healthcare Data Sharing "
        "& Misuse Detection Platform"
    ),
    version=APP_VERSION,
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# API ROUTES
# =========================================================

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(hospitals_router)
app.include_router(documents_router)
app.include_router(consent_router)
app.include_router(access_router)
app.include_router(security_router)


# =========================================================
# ROOT ENDPOINT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "HealthGuard AI API is running",
        "status": "healthy",
        "version": APP_VERSION,
    }