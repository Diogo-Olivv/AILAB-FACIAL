"""AF-01: credenciais compartilhadas legadas nunca podem autorizar tutor ou kiosk.

O conjunto de tokens mestres foi removido de app.deps. Estes testes garantem que ele
não volta e que valores históricos conhecidos são tratados como qualquer token inválido.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app import deps
from app.deps import (
    clear_identity_cache_for_testing,
    verify_kiosk_identity,
    verify_kiosk_or_tutor,
    verify_tutor_token,
)

# Valores históricos fracos ou de sessão local forjada; a chave compartilhada real não é repetida aqui.
HISTORIC_TOKENS = ["tutor-master-local-session", "admin123", "ailab_makers", "ailab2026"]
AUTH_DEPENDENCIES = [verify_tutor_token, verify_kiosk_identity, verify_kiosk_or_tutor]


@pytest.fixture(autouse=True)
def _no_real_supabase_user():
    """Supabase Auth é serviço externo: simulamos apenas 'token desconhecido'."""
    clear_identity_cache_for_testing()
    with patch("app.deps._fetch_user", return_value=None):
        yield
    clear_identity_cache_for_testing()


def test_legacy_shared_token_set_is_removed():
    assert not hasattr(deps, "_MASTER_TUTOR_TOKENS")


@pytest.mark.parametrize("dependency", AUTH_DEPENDENCIES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("token", HISTORIC_TOKENS)
def test_historic_shared_token_never_authorizes(dependency, token):
    with pytest.raises(HTTPException) as exc:
        dependency(authorization=f"Bearer {token}")
    assert exc.value.status_code in (401, 403)


def test_historic_token_rejected_with_extra_whitespace_and_case_variants():
    token = HISTORIC_TOKENS[0]
    for variant in (f"Bearer  {token}", f"bearer {token}", f"Bearer {token} "):
        with pytest.raises(HTTPException) as exc:
            verify_tutor_token(authorization=variant)
        assert exc.value.status_code in (401, 403)
