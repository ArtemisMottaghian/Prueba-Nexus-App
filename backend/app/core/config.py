import os
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUTA_ENV = os.path.join(BASE_DIR, ".env")

class Settings(BaseSettings):
    ADZUNA_APP_ID: str
    ADZUNA_APP_KEY: str
    ADZUNA_PAIS: str
    ADZUNA_CATEGORIA: str
    
    APIFY_API_TOKEN: str
    ACTOR_ID: str

    APOLLO_API_KEY: str

    BROWSE_AI_ROBOT_ID: str
    BROWSE_AI_API_KEY: str
    
    HUNTER_API_KEY: str

    ZENROWS_API_KEY: str
    
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str

    PEPPER: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_HOURS: int

    model_config = SettingsConfigDict(
        env_file=RUTA_ENV,
        env_file_encoding="utf-8",
        extra="ignore"
    )  

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()