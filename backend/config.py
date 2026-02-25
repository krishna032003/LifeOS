from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    gemini_api_key: str = "your_gemini_api_key_here"
    mongo_uri: str = "mongodb://localhost:27017/lifeos"
    pinecone_api_key: str = "your_pinecone_api_key_here"

    model_config = SettingsConfigDict(env_file=".env")

@lru_cache()
def get_settings():
    return Settings()
