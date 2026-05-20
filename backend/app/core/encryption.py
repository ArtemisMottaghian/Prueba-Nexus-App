import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from app.core.config import settings


def _derive_key() -> bytes:
    # If a dedicated encryption key is configured, derive from it.
    # Otherwise fall back to SECRET_KEY so existing messages remain readable.
    source = settings.CHAT_ENCRYPTION_KEY or settings.SECRET_KEY
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"nexus-chat-messages-v1",
    )
    return hkdf.derive(source.encode())


_MSG_KEY: bytes = _derive_key()


def encrypt(plaintext: str) -> tuple[str, str]:
    iv = os.urandom(12)
    ciphertext = AESGCM(_MSG_KEY).encrypt(iv, plaintext.encode(), None)
    return base64.b64encode(ciphertext).decode(), base64.b64encode(iv).decode()


def decrypt(ciphertext_b64: str, iv_b64: str) -> str:
    ct = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    return AESGCM(_MSG_KEY).decrypt(iv, ct, None).decode()
