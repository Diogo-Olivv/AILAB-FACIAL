"""Modelos de contrato Pydantic para validação formal de esquemas entre Backend, Web e Tablet."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


class ChallengeResponse(BaseModel):
    """Contrato da resposta do desafio temporal anti-injeção."""
    model_config = {"extra": "ignore"}

    challenge_id: str = Field(..., description="Identificador único efêmero do desafio de vivacidade temporal")
    expires_at: int = Field(..., description="Timestamp Unix de expiração em segundos")
    ttl_seconds: int = Field(..., description="Tempo de vida útil do desafio em segundos")


class EventDetail(BaseModel):
    """Contrato do evento de registro de presença ou encerramento."""
    model_config = {"extra": "ignore"}

    action: Literal["check_in", "check_out", "already_in", "not_in", "debounced"] = Field(
        ..., description="Ação biométrica resultante da leitura"
    )
    profile_id: Optional[str] = Field(None, description="UUID do integrante relacionado")
    session_id: Optional[int] = Field(None, description="ID numérico da sessão persistida")
    timestamp: Optional[str] = Field(None, description="Horário ISO UTC do evento")
    duration_minutes: Optional[float] = Field(None, description="Duração calculada da sessão em minutos no checkout")
    wait_seconds: Optional[int] = Field(None, description="Segundos restantes para nova tentativa em caso de debounce")


class RecognizeResponse(BaseModel):
    """Contrato da resposta de reconhecimento facial para o tablet de presença."""
    model_config = {"extra": "ignore"}

    recognized: bool = Field(..., description="Indica se um rosto cadastrado foi identificado com sucesso")
    status: Optional[str] = Field(None, description="Código de status semântico (ex: no_face, not_recognized, ok)")
    message: Optional[str] = Field(None, description="Mensagem legível para o usuário final")
    profile_id: Optional[str] = Field(None, description="UUID do integrante identificado")
    name: Optional[str] = Field(None, description="Nome completo do integrante")
    confidence: Optional[float] = Field(None, description="Grau de confiança estatística da correspondência")
    distance: Optional[float] = Field(None, description="Distância euclidiana ou cosseno calculada")
    cosine_similarity: Optional[float] = Field(None, description="Similaridade de cosseno normalizada")
    event: Optional[EventDetail] = Field(None, description="Detalhes do registro de presença gerado")


class EnrollResponse(BaseModel):
    """Contrato da resposta de cadastro ou recadastro biométrico."""
    model_config = {"extra": "ignore"}

    profile_id: str = Field(..., description="UUID do perfil cadastrado")
    name: str = Field(..., description="Nome do integrante")
    photos_used: int = Field(..., description="Quantidade de frames biométricos utilizados para o embedding")


class RevokeConsentResponse(BaseModel):
    """Contrato da resposta de revogação de consentimento e expurgo LGPD."""
    model_config = {"extra": "ignore"}

    revoked: bool = Field(..., description="Confirmação de revogação de consentimento")
    profile_id: str = Field(..., description="UUID do perfil revogado")
    name: Optional[str] = Field(None, description="Nome do perfil")
    revoked_at: Optional[str] = Field(None, description="Timestamp ISO do momento do expurgo")
    message: str = Field(..., description="Mensagem de confirmação de expurgo")
