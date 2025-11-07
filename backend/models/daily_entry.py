from sqlalchemy import Table, Column, Date, Text, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from core.database import metadata

daily_entries = Table(
    "daily_entries",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("date", Date, nullable=False),
    Column("visibility", Text, nullable=False),
    Column("created_at", TIMESTAMP(timezone=True), server_default=func.now(), nullable=False),
)