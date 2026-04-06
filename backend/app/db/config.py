from pydantic_settings import BaseSettings, SettingsConfigDict
class DatabaseSettings(BaseSettings):
    DB_USER: str 
    DB_PASSWORD: str 
    DB_HOST: str 
    DB_PORT: str 
    DB_NAME: str 

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )  

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = DatabaseSettings()