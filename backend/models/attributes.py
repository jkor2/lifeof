from sqlalchemy import Table, Column, ForeignKey, String, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from core.database import metadata

entry_attributes = Table(
    "entry_attributes",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("entry_id", UUID(as_uuid=True), ForeignKey("daily_entries.id", ondelete="CASCADE")),
    Column("name", String, nullable=False),      # e.g. "sleep_hours"
    Column("value", String, nullable=True),      # can store numbers or text
    Column("unit", String, nullable=True),       # e.g. "hrs", "bpm"
    Column("note", Text, nullable=True)
)