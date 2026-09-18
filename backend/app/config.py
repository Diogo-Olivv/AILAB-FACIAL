from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Face recognition & biometria calibrada — valores de produção para ArcFace/buffalo_s
    # Calibrado para FAR < 0.1 % com tolerância a óculos e pelos faciais: cos >= 0.62 ↔ dist <= 0.87
    face_threshold: float = 0.87                # Distância euclidiana máxima calibrada (sqrt(2-2cos))
    face_min_cosine: float = 0.62               # Limiar de similaridade cosseno: aceite definitivo
    face_uncertain_cosine: float = 0.55         # Zona incerta: 0.55-0.62 → second-factor ou rejeição
    min_face_size: int = 40                     # Tamanho mínimo da face em pixels (adaptado para det_size 640)
    min_laplacian_var: float = 20.0             # FIQA: adaptado para câmeras frontais de tablet com denoising
    liveness_enabled: bool = True               # Ativação de checagem anti-spoofing (ONNX + heurísticas)
    liveness_min_score: float = 0.45            # Score mínimo de vivacidade (ONNX model calibrado)
    enroll_max_pairwise_distance: float = 0.82  # Distância máxima entre fotos (permite variação natural com/sem óculos)
    max_enroll_frames: int = 5                  # Máximo de fotos no payload de cadastro (mitigação DoS)
    debounce_seconds: int = 60                  # Janela mínima de histerese (segundos) entre transições

    # Vivacidade Ativa & Anti-Spoofing (3D Flash Liveness PAD - ISO/IEC 30107-3)
    flash_liveness_enabled: bool = True         # Analisa reflexo fotométrico na sequência multi-frame
    flash_min_delta: float = 0.4                # Variação mínima de luminância facial sob pulso fotométrico

    # Cancelable Biometrics & Proteção de Templates (LGPD Art. 11 / ISO/IEC 24745)
    biohashing_enabled: bool = True             # Habilita projeção ortonormal irreversível e revogável
    biohashing_seed: str = "ailab-biometric-salt-v1"  # Semente institucional para matriz ortogonal determinística

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

    # Busca Vetorial HNSW (pgvector) — Otimização de Latência (sub-15ms)
    hnsw_ef_search: int = 40                    # ef_search: trade-off qualidade/velocidade (≥ ef_construction/2)


settings = Settings()

