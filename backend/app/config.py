from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Ambiente: "production" ativa os comportamentos fail-closed obrigatórios.
    environment: str = "development"

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

    # Verificação fotométrica entre frames (heurística; não é prova tridimensional)
    flash_liveness_enabled: bool = True         # Analisa reflexo fotométrico na sequência multi-frame
    flash_min_delta: float = 0.4                # Variação mínima de luminância facial sob pulso fotométrico

    # Transformação cancelável de templates (invertível por quem tem a semente)
    biohashing_enabled: bool = True             # Rotação ortogonal com chave: cancelável, NÃO irreversível
    biohashing_seed: str = "ailab-biometric-salt-v1"  # Semente institucional para matriz ortogonal determinística

    # Sessões e Ciclo de Vida
    max_session_hours: int = 10                 # Limite para considerar saída esquecida
    insightface_root: str = "~/.insightface"    # Onde o pacote buffalo_s fica salvo

    # API & Infraestrutura — separação de privilégios (kiosk vs admin/tutor)
    admin_api_key: str = ""                     # Chave de manutenção (X-Admin-Key): só agendador/operação; nunca em cliente
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

    # Identidade e autenticação
    kiosk_email_domain: str = "kiosk.ailab.invalid"  # Domínio das contas de dispositivo (nunca recebe e-mail)
    kiosk_token_cache_seconds: int = 60         # Cache da validação do JWT do kiosk (atraso máximo de revogação)
    auth_timeout_seconds: float = 5.0           # Tempo máximo da consulta de identidade ao Supabase Auth
    challenge_secret: str = ""                  # Segredo dedicado do desafio de captura (obrigatório em produção)

    # Upload
    max_upload_bytes: int = 27 * 1024 * 1024    # Teto do corpo multipart (5 frames de 5 MB + margem)
    max_recognize_frames: int = 5               # Máximo de frames aceitos em /recognize
    upload_rate_limit_per_minute: int = 20      # Limite de cadastros/recadastros por identidade

    # Anti-replay persistente e presença transacional
    persistent_replay_guard: bool = True        # Usa public.recognition_requests (obrigatório em produção)
    presence_via_rpc: bool = True               # Usa public.register_presence_event
    recognition_lease_seconds: int = 30         # Prazo máximo de processamento antes de permitir retomada
    recognition_max_attempts: int = 3           # Tentativas por desafio
    recognition_retention_seconds: int = 300    # Retenção do resultado (cobre o orçamento de retry do cliente)

    # PAD / vivacidade
    pad_require_model: bool | None = None       # None = exigido em produção; sem modelo o serviço responde 503
    flash_unable_policy: str = "allow"          # "allow" (comportamento histórico) | "reject" quando não der para verificar

    # Consentimento
    terms_version: str = "v1.0"

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def pad_model_required(self) -> bool:
        if self.pad_require_model is None:
            return self.is_production
        return bool(self.pad_require_model)

    @property
    def use_persistent_replay_guard(self) -> bool:
        return self.persistent_replay_guard or self.is_production


settings = Settings()

