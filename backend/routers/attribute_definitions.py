from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from core.database import engine

router = APIRouter(prefix="/attribute-definitions", tags=["Attribute Definitions"])

# =====================================================
# 📋 List All
# =====================================================
@router.get("/")
async def list_attributes():
    """
    Returns all attribute definitions, including AM/PM (day_period).
    Sorted by category, then period, then label.
    """
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT
                    id,
                    name,
                    label,
                    unit,
                    category,
                    active,
                    default_visible,
                    weight,
                    day_period,
                    created_at
                FROM attribute_definitions
                ORDER BY category, day_period, label
            """)
        )
        return [dict(r) for r in result.mappings().all()]


# =====================================================
# ➕ Create Attribute
# =====================================================
@router.post("/")
async def create_attribute(payload: dict):
    """
    Creates a new attribute definition.
    Required fields: name, label.
    Optional: unit, category, active, default_visible, weight, day_period.
    """
    required_fields = ["name", "label"]
    for field in required_fields:
        if field not in payload or not payload[field]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    # Validate AM/PM value
    day_period = payload.get("day_period", "am").lower()
    if day_period not in ("am", "pm"):
        raise HTTPException(status_code=400, detail="day_period must be 'am' or 'pm'")

    async with engine.begin() as conn:
        res = await conn.execute(
            text("""
                INSERT INTO attribute_definitions
                    (name, label, unit, category, active, default_visible, weight, day_period)
                VALUES
                    (:name, :label, :unit, :category, :active, :default_visible, :weight, :day_period)
                RETURNING id
            """),
            {
                "name": payload["name"].strip(),
                "label": payload["label"].strip(),
                "unit": payload.get("unit"),
                "category": payload.get("category"),
                "active": payload.get("active", True),
                "default_visible": payload.get("default_visible", True),
                "weight": payload.get("weight", 1),
                "day_period": day_period,
            },
        )
        inserted_id = res.scalar_one()

    return {"id": inserted_id, "message": "Attribute created successfully"}


# =====================================================
# ✏️ Update Attribute
# =====================================================
@router.put("/{attr_id}")
async def update_attribute(attr_id: str, payload: dict):
    """
    Updates an existing attribute definition.
    Only provided fields are updated.
    """
    day_period = payload.get("day_period", "am").lower()
    if day_period not in ("am", "pm"):
        raise HTTPException(status_code=400, detail="day_period must be 'am' or 'pm'")

    async with engine.begin() as conn:
        res = await conn.execute(
            text("""
                UPDATE attribute_definitions
                SET
                    name = :name,
                    label = :label,
                    unit = :unit,
                    category = :category,
                    active = :active,
                    default_visible = :default_visible,
                    weight = :weight,
                    day_period = :day_period
                WHERE id = :id
                RETURNING id
            """),
            {
                "id": attr_id,
                "name": payload.get("name"),
                "label": payload.get("label"),
                "unit": payload.get("unit"),
                "category": payload.get("category"),
                "active": payload.get("active", True),
                "default_visible": payload.get("default_visible", True),
                "weight": payload.get("weight", 1),
                "day_period": day_period,
            },
        )

        if not res.scalar():
            raise HTTPException(status_code=404, detail="Attribute not found")

    return {"message": "Attribute updated successfully"}


# =====================================================
# ❌ Delete Attribute
# =====================================================
@router.delete("/{attr_id}")
async def delete_attribute(attr_id: str):
    """
    Deletes an attribute definition by ID.
    """
    async with engine.begin() as conn:
        res = await conn.execute(
            text("DELETE FROM attribute_definitions WHERE id = :id"),
            {"id": attr_id},
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Attribute not found")

    return {"deleted": attr_id}