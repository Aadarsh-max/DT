from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_port: int = 8002
    allowed_origins: str = "http://localhost:5050,http://localhost:5173"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model_testgen: str = "qwen3:4b"
    ollama_model_code: str = "qwen2.5-coder:7b"
    ollama_model_embed: str = "bge-m3"
    ollama_num_ctx: int = 4096
    ollama_keep_alive: str = "2m"
    testgen_provider: str = "ollama"  # "ollama" or "groq"
    script_provider: str = "ollama"  # who writes browser scripts: "ollama" or "groq"
    duplicate_threshold: float = 0.85  # similarity needed to flag a duplicate bug
    appium_url: str = "http://127.0.0.1:4723"
    android_home: str = ""  # also read from the ANDROID_HOME environment variable

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()