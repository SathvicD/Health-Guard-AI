from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    hospital_id: Mapped[int | None] = mapped_column(
        ForeignKey("hospitals.id"),
        nullable=True,
        index=True
    )

    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id"),
        nullable=False,
        index=True
    )

    consent_id: Mapped[int | None] = mapped_column(
        ForeignKey("consents.id"),
        nullable=True,
        index=True
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    purpose: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    decision: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    risk_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    accessed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )