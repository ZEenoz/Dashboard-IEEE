import os
from urllib.parse import urlparse

# LINE Channel Configuration
CHANNEL_ACCESS_TOKEN = os.getenv("CHANNEL_ACCESS_TOKEN", "")
CHANNEL_SECRET = os.getenv("CHANNEL_SECRET", "")

# PostgreSQL Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    result = urlparse(DATABASE_URL)
    PG_HOST = result.hostname
    PG_PORT = result.port
    PG_DATABASE = result.path[1:]
    PG_USER = result.username
    PG_PASSWORD = result.password
else:
    PG_HOST = os.getenv("PG_HOST", "localhost")
    PG_PORT = os.getenv("PG_PORT", "5432")
    PG_DATABASE = os.getenv("PG_DATABASE", "water_monitoring")
    PG_USER = os.getenv("PG_USER", "postgres")
    PG_PASSWORD = os.getenv("PG_PASSWORD", "")

# Node API Configuration
NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:4000/api")
