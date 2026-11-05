import os 
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8000))

SESSION_COOKIE  = "smart_timetable_session"
SESSION_TTL_SECONDS = 8*60*60