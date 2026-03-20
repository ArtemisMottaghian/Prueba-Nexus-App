from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ZENROWS_API_KEY: str
    ADZUNA_APP_ID: str
    ADZUNA_APP_KEY: str
    ADZUNA_PAIS: str
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    DB_PORT: int

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()