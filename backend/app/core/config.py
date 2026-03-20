import os
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUTA_ENV = os.path.join(BASE_DIR, ".env")

class Settings(BaseSettings):
    ZENROWS_API_KEY: str
    ADZUNA_APP_ID: str
    ADZUNA_APP_KEY: str
    ADZUNA_PAIS: str
    
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str

    model_config = SettingsConfigDict(
        env_file=RUTA_ENV,
        env_file_encoding="utf-8",
        extra="ignore"
    )  

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()