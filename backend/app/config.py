from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Face recognition & biometria calibrada
    face_threshold: float = 0.80                # Distância euclidiana máxima (0.80 ~ cos_theta >= 0.68)
    face_min_cosine: float = 0.68               # Limiar de similaridade cosseno estrito
    min_face_size: int = 80                     # Tamanho mínimo da face em pixels (largura e altura)
    min_laplacian_var: float = 70.0             # FIQA: descarte de fotos com motion blur
    liveness_enabled: bool = True               # Ativação de checagem passiva anti-spoofing
    liveness_min_score: float = 0.60            # Score mínimo de vivacidade
    enroll_max_pairwise_distance: float = 0.40  # Distância máxima entre fotos no burst de cadastro
    max_enroll_frames: int = 5                  # Máximo de fotos no payload de cadastro (mitigação DoS)
    debounce_seconds: int = 60                  # Janela mínima de histerese (segundos) entre transições

    # Sessões e Ciclo de Vida
    max_session_hours: int = 10                 # Limite para considerar saída esquecida
    max_session_cap_hours: int = 4              # Teto justo de horas imputadas no fechamento automático
    insightface_root: str = "~/.insightface"    # Onde o pacote buffalo_s fica salvo

    # API & Infraestrutura
    api_key: str = ""                           # Chave secreta interna para autenticar tablets e chamadas
    use_pgvector: bool = False                  # Habilita busca vetorial via RPC match_face (pgvector HNSW)
    gcp_project_number: str = ""                # Número ou ID do projeto GCP para validação OIDC
    cloud_scheduler_sa_email: str = ""          # E-mail da Service Account do Cloud Scheduler
    service_url: str = ""                       # URL do Cloud Run para validação de audiência OIDC


settings = Settings()

