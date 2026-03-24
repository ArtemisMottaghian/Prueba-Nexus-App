import bcrypt
from app.core.config import settings

def hash_passowrd(plain_passowrd: str) -> str:
    salted = (plain_passowrd + settings.PEPPER).encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(salted, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    salted_plain = (plain_password + settings.PEPPER).encode('utf-8')
    return bcrypt.chechpw(salted_plain, hashed_password.encode('utf-8'))