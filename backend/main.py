from fastapi import FastAPI
from routers import entries
from core.database import engine, metadata

app = FastAPI(title="LifeOf API")

# Create tables if not already present
metadata.create_all(engine)

app.include_router(entries.router)

@app.get("/")
def root():
    return {"message": "✅ Connected to Supabase database successfully"}