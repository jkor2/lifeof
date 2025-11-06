import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("CONNECTION_STRING")
PROJECT_NAME = os.getenv("PROJECT_NAME", "lifeof")
SCHEMA = os.getenv("SCHEMA", "public")