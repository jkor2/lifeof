import ssl
from sqlalchemy import create_engine, MetaData
from core.config import DATABASE_URL

# Create SSL context for Supabase
ssl_context = ssl.create_default_context()

# Create synchronous SQLAlchemy engine (simpler and fully supported by Supabase)
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"}
)

# Metadata for model creation
metadata = MetaData()