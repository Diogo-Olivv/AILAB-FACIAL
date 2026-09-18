"""Janela temporal de recadastro biométrico sem PIN de tutor.

Entre 28/09/2026 00:00:00 e 02/10/2026 23:59:59 (America/Sao_Paulo, UTC-3),
o endpoint de refresh-embedding aceita requisições sem autenticação de tutor,
permitindo que integrantes atualizem sua biometria de forma autônoma.

NOTA DE SEGURANÇA: A validação aqui é a fonte de verdade. O frontend apenas
oculta a UI de PIN como conveniência — nunca como controle de segurança.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

# Fuso horário de Brasília (America/Sao_Paulo), sem depender de pytz ou zoneinfo
# para manter compatibilidade com ambientes de deploy sem tzdata.
SP_TZ = timezone(timedelta(hours=-3))

# Janela cadastral: 28/09/2026 00:00:00 a 02/10/2026 23:59:59 (GMT-3)
WINDOW_START = datetime(2026, 9, 28, 0, 0, 0, tzinfo=SP_TZ)
WINDOW_END   = datetime(2026, 10, 2, 23, 59, 59, tzinfo=SP_TZ)


def is_enrollment_window_active() -> bool:
    """Retorna True se o momento atual (fuso SP/GMT-3) estiver dentro da janela cadastral.

    Não possui efeitos colaterais. Chamável de qualquer thread.
    """
    now_sp = datetime.now(tz=SP_TZ)
    return WINDOW_START <= now_sp <= WINDOW_END


def enrollment_window_status() -> dict:
    """Retorna metadados da janela para logging e headers de auditoria."""
    active = is_enrollment_window_active()
    return {
        "active": active,
        "window_start": WINDOW_START.isoformat(),
        "window_end": WINDOW_END.isoformat(),
        "checked_at": datetime.now(tz=SP_TZ).isoformat(),
    }
