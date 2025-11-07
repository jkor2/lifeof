from sqlalchemy import Table, Column, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from core.database import metadata

entry_attributes = Table(
    "entry_attributes",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("entry_id", UUID(as_uuid=True), ForeignKey("daily_entries.id", ondelete="CASCADE"), nullable=False),
    Column("name", Text, nullable=False),
    Column("value", Text),
    Column("unit", Text),
    Column("note", Text),
    Column("created_at", TIMESTAMP(timezone=True), server_default=func.now(), nullable=False),
)