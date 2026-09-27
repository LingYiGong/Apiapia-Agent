import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from jose import jwt, JWTError
import bcrypt
from cryptography.fernet import Fernet
from app.core.config import settings


def get_fernet() -> Fernet:
    """Get Fernet cipher from API_KEY_ENCRYPTION_KEY, padding or slicing if needed."""
    raw_key = settings.API_KEY_ENCRYPTION_KEY.encode()
    # Fernet requires 32 url-safe base64-encoded bytes
    try:
        # Check if already valid 32 urlsafe bytes
        decoded = base64.urlsafe_b64decode(raw_key)
        if len(decoded) == 32:
            return Fernet(raw_key)
    except Exception:
        pass
    # Fallback safe key derivation
    safe_key = base64.urlsafe_b64encode(raw_key.ljust(32, b"0")[:32])
    return Fernet(safe_key)


def encrypt_api_key(plain_text: str) -> str:
    """Encrypt an API key before saving to the database."""
    if not plain_text:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_api_key(cipher_text: str) -> str:
    """Decrypt an encrypted API key."""
    if not cipher_text:
        return ""
    try:
        fernet = get_fernet()
        return fernet.decrypt(cipher_text.encode()).decode()
    except Exception:
        return ""


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # bcrypt standard maximum password length is 72 bytes
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None
