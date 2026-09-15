"""Testes automatizados para a Fase P2: Hardening, Supply Chain e Resiliência Operacional."""
from __future__ import annotations

import hashlib
import os
import tempfile
from unittest.mock import MagicMock, patch

from app.config import settings


def test_requirements_lock_exists_and_pinned():
    """Garante que o lockfile determinístico de dependências existe e contém versões congeladas."""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    lockfile_path = os.path.join(backend_dir, "requirements.lock")

    assert os.path.exists(lockfile_path), "backend/requirements.lock deve existir para garantir builds determinísticos"

    with open(lockfile_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    assert len(lines) > 15, "Lockfile deve conter dependências diretas e transitivas"

    for line in lines:
        assert "==" in line, f"Dependência '{line}' no lockfile deve estar congelada estritamente com =="


def test_max_session_cap_hours_removed_from_settings():
    """Garante a eliminação de código morto: max_session_cap_hours não deve existir em Settings."""
    assert not hasattr(settings, "max_session_cap_hours"), (
        "max_session_cap_hours era código morto inoperante e deve ser removido de settings"
    )


def test_download_models_hash_verification_fail_closed():
    """Garante que arquivo com SHA-256 adulterado/corrompido é rejeitado e deletado atomicamente."""
    from scripts.download_models import _verify_hash

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(b"fake-model-binary-content")
        tmp_path = tmp.name

    try:
        # Hash correto
        correct_hash = hashlib.sha256(b"fake-model-binary-content").hexdigest()
        assert _verify_hash(tmp_path, correct_hash) is True
        assert os.path.exists(tmp_path)

        # Hash forjado/adulterado deve falhar e expurgar o arquivo
        wrong_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        assert _verify_hash(tmp_path, wrong_hash) is False
        assert not os.path.exists(tmp_path), "Arquivo corrompido deve ser excluído imediatamente (fail-closed)"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_verify_buffalo_models_detects_missing_and_corrupt():
    """Garante que a verificação de integridade do buffalo_s sinaliza modelos ausentes ou corrompidos."""
    from scripts.download_models import verify_buffalo_models

    with tempfile.TemporaryDirectory() as tmpdir:
        model_dir = os.path.join(tmpdir, "models", "buffalo_s")
        os.makedirs(model_dir, exist_ok=True)

        # Modelos ainda não criados
        assert verify_buffalo_models(root_dir=tmpdir) is False

        # Cria arquivo minúsculo (< 500 KB) simulando arquivo truncado
        det_path = os.path.join(model_dir, "det_500m.onnx")
        with open(det_path, "wb") as f:
            f.write(b"too_small")

        assert verify_buffalo_models(root_dir=tmpdir) is False


def test_restore_drill_executes_health_checks():
    """Garante que o script de restore drill executa testes de integridade estrutural e da RPC pgvector."""
    from scripts.restore_drill import run_restore_drill

    mock_db = MagicMock()
    # Mock das tabelas
    mock_table = MagicMock()
    mock_table.select.return_value.limit.return_value.execute.return_value = MagicMock(count=42, data=[])
    mock_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[{"id": "test"}])
    mock_db.table.return_value = mock_table

    # Mock da RPC match_face
    mock_db.rpc.return_value.execute.return_value = MagicMock(data=[{"profile_id": "prof-1", "similarity": 0.95}])

    with patch("app.db.supabase_client.get_client", return_value=mock_db):
        success = run_restore_drill()
        assert success is True
        assert mock_db.rpc.called
        assert mock_db.table.called
