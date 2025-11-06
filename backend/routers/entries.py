from fastapi import APIRouter
from schemas.entry import EntryCreate
from core.database import engine
from models.daily_entry import daily_entries
from models.attributes import entry_attributes
from sqlalchemy import text
import uuid

router = APIRouter(prefix="/entries", tags=["Entries"])

@router.post("/")
def create_entry(entry: EntryCreate):
    entry_id = str(uuid.uuid4())

    # Insert main entry
    with engine.begin() as conn:
        conn.execute(
            daily_entries.insert().values(
                id=entry_id,
                date=str(entry.date),
                visibility=entry.visibility
            )
        )

        # Insert attributes dynamically
        for attr in entry.attributes:
            conn.execute(
                entry_attributes.insert().values(
                    entry_id=entry_id,
                    name=attr.name,
                    value=attr.value,
                    unit=attr.unit,
                    note=attr.note
                )
            )

    return {"id": entry_id, "message": "Entry created successfully"}

@router.get("/")
def list_entries():
    query = text("""
        SELECT e.id, e.date, e.visibility, json_agg(
            json_build_object('name', a.name, 'value', a.value, 'unit', a.unit)
        ) AS attributes
        FROM daily_entries e
        LEFT JOIN entry_attributes a ON e.id = a.entry_id
        GROUP BY e.id, e.date, e.visibility
        ORDER BY e.date DESC;
    """)

    with engine.connect() as conn:
        result = conn.execute(query)
        rows = [dict(row._mapping) for row in result]
    return rows