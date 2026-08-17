from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Face recognition
    face_threshold: float = 0.55
    debounce_seconds: int = 60

    # Google Sheets
    google_creds_json: str = ""          # JSON completo da service-account
    sheets_spreadsheet_id: str = ""
    sheets_sync_interval_minutes: int = 15

    # API
    api_key: str = ""                    # chave para autenticar a câmera


settings = Settings()
