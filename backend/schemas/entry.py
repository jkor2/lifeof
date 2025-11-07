from pydantic import BaseModel, field_validator
from typing import List, Optional, Literal
from datetime import date


class Attribute(BaseModel):
    name: str
    value: Optional[str] = None
    unit: Optional[str] = None
    note: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("attribute name cannot be empty")
        return v


class NoteCreate(BaseModel):
    content: str


class EntryCreate(BaseModel):
    date: date
    visibility: str = "private"
    day_period: Literal["am", "pm"] = "am"
    notes: Optional[str] = None
    attributes: List[Attribute] = []