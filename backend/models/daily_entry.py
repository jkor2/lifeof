from sqlalchemy import Table, Column, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from core.database import metadata

daily_entries = Table(
    "daily_entries",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("date", String, nullable=False),
    Column("visibility", String, default="private"),
    Column("created_at", TIMESTAMP(timezone=True), server_default=func.now())
)