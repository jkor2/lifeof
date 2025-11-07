# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import init_db  # ✅ use the async helper instead
from routers import entries, attribute_definitions, whoop, charts

app = FastAPI(title="LifeOf API")

# ✅ CORS for local + Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", 
                           "https://lifeof-prtf.vercel.app",  # ✅ your production frontend

                   ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Register routers
app.include_router(entries.router)
app.include_router(attribute_definitions.router)
app.include_router(whoop.router)
app.include_router(charts.router)

@app.on_event("startup")
async def on_startup():
    # Initialize database metadata if needed
    await init_db()
    print("✅ Database initialized")

@app.get("/")
async def root():
    return {"message": "✅ LifeOf API ready"}