"""Testes automatizados para a Fase P2: Hardening, Supply Chain e Resiliência Operacional."""
from __future__ import annotations

import hashlib
import os
import tempfile
from unittest.mock import MagicMock, patch

from app.config import settings


def _parse_lock(path: str) -> dict[str, list[str]]:
    """Lê um lock do uv: cada entrada `nome==versão` é seguida de linhas `--hash=sha256:...`."""
    entries: dict[str, list[str]] = {}
    current: str | None = None
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip().rstrip("\\").strip()
            if not line or line.startswith("#") or line.startswith("via"):
                continue
            if line.startswith("--hash=sha256:"):
                assert current is not None, f"hash sem dependência em {path}"
                entries[current].append(line.removeprefix("--hash=sha256:"))
            else:
                assert "==" in line, f"Dependência '{line}' deve estar congelada estritamente com =="
                current = line.split(";")[0].strip()
                entries[current] = []
    return entries


def test_requirements_lock_exists_and_pinned():
    """Os locks existem, congelam cada dependência com == e trazem o hash SHA-256 de cada uma."""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    for name, minimum in (("requirements.lock", 15), ("requirements-dev.lock", 15)):
        path = os.path.join(backend_dir, name)
        assert os.path.exists(path), f"backend/{name} deve existir para garantir builds determinísticos"
        entries = _parse_lock(path)
        assert len(entries) > minimum, f"{name} deve conter dependências diretas e transitivas"
        for dep, hashes in entries.items():
            assert hashes, f"{dep} em {name} está sem hash (instalação com --require-hashes falharia)"
            assert all(len(h) == 64 for h in hashes), f"hash inválido para {dep} em {name}"


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
