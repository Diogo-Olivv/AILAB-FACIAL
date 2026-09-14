from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Face recognition & biometria calibrada — valores de produção para ArcFace/buffalo_s
    # Calibrado para FAR < 0.1 %: cos >= 0.68 ↔ dist <= 0.80 (relação ||u-v|| = sqrt(2-2cos))
    face_threshold: float = 0.80                # Distância euclidiana máxima (limite estrito calibrado)
    face_min_cosine: float = 0.68               # Limiar de similaridade cosseno: aceite definitivo
    face_uncertain_cosine: float = 0.62         # Zona incerta: 0.62-0.68 → second-factor ou rejeição
    min_face_size: int = 40                     # Tamanho mínimo da face em pixels (adaptado para det_size 640)
    min_laplacian_var: float = 30.0             # FIQA: adaptado para câmeras frontais de tablet com denoising
    liveness_enabled: bool = True               # Ativação de checagem anti-spoofing (ONNX + heurísticas)
    liveness_min_score: float = 0.45            # Score mínimo de vivacidade (ONNX model calibrado)
    enroll_max_pairwise_distance: float = 0.70  # Distância máxima entre fotos (permite variação natural)
    max_enroll_frames: int = 5                  # Máximo de fotos no payload de cadastro (mitigação DoS)
    debounce_seconds: int = 60                  # Janela mínima de histerese (segundos) entre transições

    # Sessões e Ciclo de Vida
    max_session_hours: int = 10                 # Limite para considerar saída esquecida
    insightface_root: str = "~/.insightface"    # Onde o pacote buffalo_s fica salvo

    # API & Infraestrutura — separação de privilégios (kiosk vs admin/tutor)
    api_key: str = ""                           # Legado: fallback para tablets ainda não migrados
    kiosk_api_key: str = ""                     # Chave de inferência: apenas POST /recognize (kiosks)
    admin_api_key: str = ""                     # Chave administrativa: DEPRECATED — prefira tutorToken JWT
    use_pgvector: bool = True                   # Habilita busca vetorial via RPC match_face (pgvector HNSW)
    gcp_project_number: str = ""                # Número ou ID do projeto GCP para validação OIDC
    cloud_scheduler_sa_email: str = ""          # E-mail da Service Account do Cloud Scheduler
    service_url: str = ""                       # URL do Cloud Run para validação de audiência OIDC
    cors_origins: str = ""                      # Origens permitidas para CORS (separadas por vírgula); vazio = rejeita todas

    # Anti-Injeção Digital & Desafio Temporal (F-002 / P1-4)
    enforce_capture_challenge: bool = True      # Exige challenge_id assinado em POST /recognize
    challenge_ttl_seconds: int = 30             # Janela temporal de validade do desafio (segundos)

    # Controle de Concorrência & Rate Limiting (FINDING-08)
    max_concurrent_inferences: int = 10         # Teto de inferências biométricas simultâneas por worker
    rate_limit_per_minute: int = 60             # Limite de requisições por minuto por chave/IP


settings = Settings()

