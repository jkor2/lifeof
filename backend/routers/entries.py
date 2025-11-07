from fastapi import APIRouter, HTTPException, Query
from schemas.entry import EntryCreate, NoteCreate
from core.database import engine
from sqlalchemy import text
from typing import Optional

router = APIRouter(prefix="/entries", tags=["Entries"])


# ============================================================
# 🧩 Create or Upsert Entry (AM/PM supported)
# ============================================================
@router.post("/")
async def create_or_upsert_entry(entry: EntryCreate, upsert: bool = True):
    """
    Create or update a daily entry keyed by (date, day_period).
    Stores visibility, optional notes, and attributes.
    """
    async with engine.begin() as conn:
        # ✅ Check for existing entry matching BOTH date + day_period
        existing = await conn.execute(
            text("""
                SELECT id FROM daily_entries
                WHERE date = :d AND day_period = :p
            """),
            {"d": entry.date, "p": entry.day_period},
        )
        row = existing.fetchone()

        # ✅ Duplicate protection
        if row and not upsert:
            raise HTTPException(
                status_code=409,
                detail=f"Entry for {entry.date} ({entry.day_period}) already exists",
            )

        # ✅ Update existing entry for that period
        if row:
            entry_id = row[0]
            await conn.execute(
                text("""
                    UPDATE daily_entries
                    SET visibility = :v, notes = :n
                    WHERE id = :id
                """),
                {
                    "v": entry.visibility,
                    "n": getattr(entry, "notes", "") or "",
                    "id": entry_id,
                },
            )
        else:
            # ✅ Create new AM or PM record
            inserted = await conn.execute(
                text("""
                    INSERT INTO daily_entries (date, day_period, visibility, notes)
                    VALUES (:d, :p, :v, :n)
                    RETURNING id
                """),
                {
                    "d": entry.date,
                    "p": entry.day_period,
                    "v": entry.visibility,
                    "n": getattr(entry, "notes", "") or "",
                },
            )
            entry_id = inserted.scalar_one()

        # ✅ Clear old attributes for that entry (so AM/PM don’t merge)
        await conn.execute(
            text("DELETE FROM entry_attributes WHERE entry_id = :eid"),
            {"eid": entry_id},
        )

        # ✅ Insert new attributes for this entry only
        for a in getattr(entry, "attributes", []) or []:
            if not a.name:
                continue
            await conn.execute(
                text("""
                    INSERT INTO entry_attributes (entry_id, name, value, unit, note)
                    VALUES (:eid, :name, :value, :unit, :note)
                """),
                {
                    "eid": entry_id,
                    "name": a.name,
                    "value": a.value,
                    "unit": a.unit,
                    "note": a.note,
                },
            )

    return {"id": str(entry_id), "message": f"Entry ({entry.day_period}) upserted successfully"}


# ============================================================
# 📋 List Entries (ordered, AM before PM)
# ============================================================
@router.get("/")
async def list_entries(
    visibility: Optional[str] = Query(None, pattern="^(public|private)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
):
    clauses = []
    params = {}

    if visibility:
        clauses.append("e.visibility = :vis")
        params["vis"] = visibility
    if date_from:
        clauses.append("e.date >= :df")
        params["df"] = date_from
    if date_to:
        clauses.append("e.date <= :dt")
        params["dt"] = date_to

    where_clause = "WHERE " + " AND ".join(clauses) if clauses else ""

    query = text(f"""
        SELECT
            e.id,
            e.date,
            e.day_period,
            e.visibility,
            e.notes,
            e.created_at,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'name', a.name,
                            'value', a.value,
                            'unit', a.unit,
                            'note', a.note
                        )
                        ORDER BY a.name
                    )
                    FROM entry_attributes a
                    WHERE a.entry_id = e.id
                ),
                '[]'
            ) AS attributes,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', n.id,
                            'content', n.content,
                            'created_at', n.created_at
                        )
                        ORDER BY n.created_at ASC
                    )
                    FROM entry_notes n
                    WHERE n.entry_id = e.id
                ),
                '[]'
            ) AS notes
        FROM daily_entries e
        {where_clause}
        ORDER BY e.date DESC,
                 CASE WHEN e.day_period = 'am' THEN 0 ELSE 1 END,
                 e.created_at ASC
        LIMIT :limit OFFSET :offset
    """)

    async with engine.connect() as conn:
        result = await conn.execute(query, {**params, "limit": limit, "offset": offset})
        rows = result.mappings().all()

    return rows


# ============================================================
# 🔍 Get Single Entry (full details)
# ============================================================
@router.get("/{entry_id}")
async def get_entry(entry_id: str):
    query = text("""
        SELECT
            e.id,
            e.date,
            e.day_period,
            e.visibility,
            e.notes,
            e.created_at,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'name', a.name,
                            'value', a.value,
                            'unit', a.unit,
                            'note', a.note
                        )
                        ORDER BY a.name
                    )
                    FROM entry_attributes a
                    WHERE a.entry_id = e.id
                ),
                '[]'
            ) AS attributes,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', n.id,
                            'content', n.content,
                            'created_at', n.created_at
                        )
                        ORDER BY n.created_at ASC
                    )
                    FROM entry_notes n
                    WHERE n.entry_id = e.id
                ),
                '[]'
            ) AS notes
        FROM daily_entries e
        WHERE e.id = :id
    """)

    async with engine.connect() as conn:
        result = await conn.execute(query, {"id": entry_id})
        row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")

    return dict(row)


# ============================================================
# 👁️ Update Visibility
# ============================================================
@router.patch("/{entry_id}/visibility")
async def update_entry_visibility(entry_id: str, payload: dict):
    visibility = payload.get("visibility")
    if visibility not in ["public", "private"]:
        raise HTTPException(status_code=400, detail="Invalid visibility value")

    async with engine.begin() as conn:
        result = await conn.execute(
            text("""
                UPDATE daily_entries
                SET visibility = :v
                WHERE id = :id
                RETURNING id, visibility
            """),
            {"v": visibility, "id": entry_id},
        )
        row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {
        "id": row["id"],
        "visibility": row["visibility"],
        "message": f"Entry visibility set to {row['visibility']}",
    }


# ============================================================
# 🗒️ Add Note
# ============================================================
@router.post("/{entry_id}/notes")
async def add_note(entry_id: str, note: NoteCreate):
    if not note.content or not note.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    async with engine.begin() as conn:
        exists = await conn.execute(
            text("SELECT 1 FROM daily_entries WHERE id = :id"),
            {"id": entry_id},
        )
        if not exists.fetchone():
            raise HTTPException(status_code=404, detail="Entry not found")

        result = await conn.execute(
            text("""
                INSERT INTO entry_notes (entry_id, content)
                VALUES (:eid, :content)
                RETURNING id, content, created_at
            """),
            {"eid": entry_id, "content": note.content.strip()},
        )
        inserted = result.mappings().first()

    return {"message": "Note added successfully", "note": inserted}

# ============================================================
# 🗑️ Delete Entry
# ============================================================
@router.delete("/{entry_id}")
async def delete_entry(entry_id: str):
    """
    Delete a single entry and all its related attributes/notes.
    """
    async with engine.begin() as conn:
        # Check existence first
        exists = await conn.execute(
            text("SELECT 1 FROM daily_entries WHERE id = :id"),
            {"id": entry_id},
        )
        if not exists.fetchone():
            raise HTTPException(status_code=404, detail="Entry not found")

        # Delete related data first (foreign key cleanup)
        await conn.execute(
            text("DELETE FROM entry_attributes WHERE entry_id = :id"),
            {"id": entry_id},
        )
        await conn.execute(
            text("DELETE FROM entry_notes WHERE entry_id = :id"),
            {"id": entry_id},
        )
        # Delete entry itself
        await conn.execute(
            text("DELETE FROM daily_entries WHERE id = :id"),
            {"id": entry_id},
        )

    return {"message": f"Entry {entry_id} deleted successfully"}