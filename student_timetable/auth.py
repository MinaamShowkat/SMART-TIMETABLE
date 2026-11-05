import hashlib, hmac, secrets, time
from config import SESSION_TTL_SECONDS

def hash_password(password, salt=None):
    if not isinstance(password, str) or len(password) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return {"salt": salt.hex(), "hash": digest.hex(), "iterations": 310000}

def verify_password(password, record):
    try:
        salt = bytes.fromhex(record["salt"])
        iterations = int(record.get("iterations", 310000))
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(digest.hex(), record["hash"])
    except (KeyError, TypeError, ValueError):
        return False

def new_session(user_id, role):
    return {"token": secrets.token_urlsafe(32), "user_id": user_id,
            "role": role, "created": int(time.time()),
            "expires": int(time.time()) + SESSION_TTL_SECONDS}
