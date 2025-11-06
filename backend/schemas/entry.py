from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class Attribute(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None
    note: Optional[str] = None

class EntryCreate(BaseModel):
    date: date
    visibility: str = "private"
    attributes: List[Attribute]

class EntryOut(EntryCreate):
    id: str