"""P0-1 (AF-01): credenciais compartilhadas legadas nunca podem autorizar tutor ou kiosk.

Os valores são lidos de app.deps em tempo de execução; nenhum literal é repetido aqui.
Após a remoção (PR-3), o conjunto deixa de existir e o teste de ausência passa a valer.
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

LEGACY_TOKENS = sorted(getattr(deps, "_MASTER_TUTOR_TOKENS", frozenset()))
AUTH_DEPENDENCIES = [verify_tutor_token, verify_kiosk_identity, verify_kiosk_or_tutor]


@pytest.fixture(autouse=True)
def _no_real_supabase_user():
    """Supabase Auth é serviço externo: simulamos apenas 'token desconhecido'."""
    clear_identity_cache_for_testing()
    with patch("app.deps._fetch_user", return_value=None):
        yield
    clear_identity_cache_for_testing()


XFAIL_AF01 = pytest.mark.xfail(
    strict=True,
    reason="AF-01: credenciais compartilhadas ainda aceitas; remover marca no PR-3 (strict força a remoção)",
)


@XFAIL_AF01
def test_legacy_shared_token_set_is_removed():
    assert not hasattr(deps, "_MASTER_TUTOR_TOKENS"), (
        "AF-01: conjunto de credenciais compartilhadas ainda existe em app.deps"
    )


@XFAIL_AF01
@pytest.mark.skipif(not LEGACY_TOKENS, reason="conjunto legado já removido (PR-3)")
@pytest.mark.parametrize("dependency", AUTH_DEPENDENCIES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("index", range(len(LEGACY_TOKENS)))
def test_legacy_shared_token_never_authorizes(dependency, index):
    token = LEGACY_TOKENS[index]
    with pytest.raises(HTTPException) as exc:
        dependency(authorization=f"Bearer {token}")
    assert exc.value.status_code in (401, 403)


@XFAIL_AF01
@pytest.mark.skipif(not LEGACY_TOKENS, reason="conjunto legado já removido (PR-3)")
def test_legacy_token_rejected_with_extra_whitespace_and_case_variants():
    token = LEGACY_TOKENS[0]
    for variant in (f"Bearer  {token}", f"bearer {token}", f"Bearer {token} "):
        with pytest.raises(HTTPException) as exc:
            verify_tutor_token(authorization=variant)
        assert exc.value.status_code in (401, 403)
