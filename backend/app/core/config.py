import os
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUTA_ENV = os.path.join(BASE_DIR, ".env")

class Settings(BaseSettings):
    ADZUNA_APP_ID: str
    ADZUNA_APP_KEY: str
    ADZUNA_PAIS: str
    ADZUNA_CATEGORIA: str
    
    APIFY_API_TOKEN: str = ""
    ACTOR_ID: str = ""

    APOLLO_API_KEY: str = ""

    BROWSE_AI_ROBOT_ID: str = ""
    BROWSE_AI_API_KEY: str = ""

    DROPCONTACT_API_KEY:str
    
    HUNTER_API_KEY: str = ""

    PHANTOMBUSTER_API_KEY:str
    PB_LINKEDIN_SEARCH_ID:str

    ZENROWS_API_KEY: str = ""
    
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str

    SERVER_IP: str

    PEPPER: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_HOURS: int

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    # URLs de Google OAuth
    GOOGLE_AUTH_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL: str = "https://www.googleapis.com/oauth2/v3/userinfo"
    GOOGLE_SCOPES: list = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar",
    ]


    LINKEDIN_SESSION_COOKIE:str
    LINKEDIN_USER_AGENT:str

    model_config = SettingsConfigDict(
        env_file=RUTA_ENV,
        env_file_encoding="utf-8",
        extra="ignore"
    )  

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()