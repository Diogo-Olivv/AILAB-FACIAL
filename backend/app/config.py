from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Face recognition
    face_threshold: float = 1.0
    debounce_seconds: int = 0

    # Sessões: acima deste limite a sessão é considerada saída esquecida e descartada.
    max_session_hours: int = 10
    insightface_root: str = "~/.insightface"  # onde o pacote buffalo_s fica salvo

    # API
    api_key: str = ""                    # chave para autenticar a câmera


settings = Settings()
