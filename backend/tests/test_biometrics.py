"""Testes unitários automatizados para a camada de Biometria, Visão Computacional e Antifraude."""
from __future__ import annotations

from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from app.config import settings
from app.services.enroll_service import (
    EnrollError,
    _check_1_to_n_duplicate,
    _validate_intra_burst_consistency,
)
from app.services.face_service import (
    compute_calibrated_confidence,
    select_primary_face,
)
from app.services.liveness_service import (
    check_image_quality,
    compute_laplacian_variance,
    verify_liveness,
)


class DummyFace:
    """Mock simplificado de Face retornado pelo InsightFace."""

    def __init__(self, bbox: list[int], det_score: float, embedding: np.ndarray | None = None):
        self.bbox = bbox
        self.det_score = det_score
        self.embedding = embedding if embedding is not None else np.random.randn(512)


# ── Testes de Calibração Matemática ──────────────────────────────────────────


def test_cosine_to_euclidean_relationship():
    """Valida a equivalência matemática ||u - v|| = sqrt(2 - 2*cos(theta))."""
    rng = np.random.default_rng(42)
    u = rng.standard_normal(512)
    v = rng.standard_normal(512)
    u = u / np.linalg.norm(u)
    v = v / np.linalg.norm(v)

    euclidean_dist = np.linalg.norm(u - v)
    cosine_sim = np.dot(u, v)

    expected_euclidean = np.sqrt(max(0.0, 2.0 - 2.0 * cosine_sim))
    assert np.isclose(euclidean_dist, expected_euclidean, atol=1e-6)

    # Limiar configurado face_threshold=1.00 deve corresponder a cos_theta = 0.50
    threshold_cos = 1.0 - (settings.face_threshold**2) / 2.0
    assert np.isclose(threshold_cos, settings.face_min_cosine, atol=0.01)


def test_calibrated_confidence_sigmoid():
    """Valida a calibração de confiança sigmoidal via Platt Scaling."""
    # No ponto de inflexão operacional (cos_theta = 0.50), confiança deve ser ~ 50%
    conf_mid = compute_calibrated_confidence(0.50)
    assert 0.48 <= conf_mid <= 0.52

    # Match de alta confiança (cos_theta = 0.75) deve ser > 95%
    conf_high = compute_calibrated_confidence(0.75)
    assert conf_high > 0.95

    # Match de baixa similaridade (cos_theta = 0.30) deve ser < 10%
    conf_low = compute_calibrated_confidence(0.30)
    assert conf_low < 0.10

    # Monotonicidade estrita
    assert (
        compute_calibrated_confidence(0.40)
        < compute_calibrated_confidence(0.50)
        < compute_calibrated_confidence(0.70)
    )


# ── Testes de FIQA e Descarte de Blur ─────────────────────────────────────────


def test_laplacian_variance_sharp_vs_blur():
    """Valida que imagem nítida tem variância laplaciana muito superior a imagem borrada."""
    # Imagem nítida: padrão xadrez alternado
    sharp = np.zeros((100, 100), dtype=np.float32)
    sharp[::2, ::2] = 255.0
    sharp[1::2, 1::2] = 255.0

    # Imagem borrada/lisa: gradiente suave quase constante
    smooth = np.ones((100, 100), dtype=np.float32) * 128.0

    var_sharp = compute_laplacian_variance(sharp)
    var_smooth = compute_laplacian_variance(smooth)

    assert var_sharp > 1000.0
    assert var_smooth < 1.0
    assert var_sharp > var_smooth


def test_check_image_quality():
    """Testa aprovação e rejeição de qualidade facial (FIQA)."""
    # 1. Face muito pequena (< min_face_size = 40)
    small_face = np.ones((30, 30, 3), dtype=np.uint8) * 120
    ok, score, reason = check_image_quality(small_face)
    assert not ok
    assert reason == "face_too_small"

    # 2. Face borrada
    blur_face = np.ones((120, 120, 3), dtype=np.uint8) * 128
    ok, score, reason = check_image_quality(blur_face)
    assert not ok
    assert reason == "blur_detected"

    # 3. Face nítida com textura
    rng = np.random.default_rng(123)
    sharp_face = rng.integers(0, 256, size=(120, 120, 3), dtype=np.uint8)
    ok, score, reason = check_image_quality(sharp_face)
    assert ok
    assert reason == "quality_ok"


# ── Teste de Seleção de Face Primária ──────────────────────────────────────────


def test_select_primary_face_geometry_over_score():
    """Garante que uma face central e grande tem precedência sobre transeunte pequeno no canto."""
    img_w, img_h = 640, 480

    # Face 1 (Usuário principal): No centro [220, 140, 420, 340] -> 200x200 px, score 0.80
    main_user = DummyFace(bbox=[220, 140, 420, 340], det_score=0.80)

    # Face 2 (Transeunte no fundo): No canto [530, 20, 620, 110] -> 90x90 px, score 0.95
    passerby = DummyFace(bbox=[530, 20, 620, 110], det_score=0.95)

    faces = [passerby, main_user]
    chosen, status = select_primary_face(faces, img_w, img_h)

    assert chosen is main_user
    assert status == "ok"


# ── Testes de Consistência Intra-Burst e Anti-Duplicidade no Enroll ───────────


def test_validate_intra_burst_consistency_success():
    """5 fotos da mesma pessoa (com pequenas variações) devem ser aceitas."""
    rng = np.random.default_rng(99)
    base = rng.standard_normal(512)
    base = base / np.linalg.norm(base)

    # Simula 5 frames do burst com ruído pequeno (distância < 0.20 em 512-D)
    encs = []
    for _ in range(5):
        noise = (rng.standard_normal(512) / np.sqrt(512)) * 0.08
        vec = base + noise
        encs.append(vec / np.linalg.norm(vec))

    mean_vec, count = _validate_intra_burst_consistency(encs)
    assert count == 5
    assert np.isclose(np.linalg.norm(mean_vec), 1.0, atol=1e-5)
    # Similaridade cosseno com o original deve ser altíssima
    assert np.dot(mean_vec, base) > 0.98


def test_validate_intra_burst_consistency_divergent():
    """Burst contendo rostos de duas pessoas diferentes deve ser rejeitado."""
    rng = np.random.default_rng(101)

    p1 = rng.standard_normal(512)
    p1 = p1 / np.linalg.norm(p1)

    p2 = rng.standard_normal(512)
    p2 = p2 / np.linalg.norm(p2)

    # 3 fotos de P1 e 2 fotos de P2
    encs = [p1, p1, p1, p2, p2]

    with pytest.raises(EnrollError) as exc_info:
        _validate_intra_burst_consistency(encs)

    assert "divergentes" in str(exc_info.value)


def test_check_1_to_n_duplicate_blocked():
    """Garante que o cadastro é bloqueado se o rosto já existir na base ativa."""
    rng = np.random.default_rng(77)
    existing_vec = rng.standard_normal(512)
    existing_vec = existing_vec / np.linalg.norm(existing_vec)

    # Mock do _load_embeddings retornando um integrante existente com vetor similar
    mock_loaded = (
        ["uuid-integrante-1"],
        ["Carlos Silva"],
        np.array([existing_vec], dtype=np.float64),
    )

    with patch("app.services.enroll_service._load_embeddings", return_value=mock_loaded):
        # Tentativa de cadastrar vetor quase idêntico
        candidate = existing_vec + rng.standard_normal(512) * 0.02
        candidate = candidate / np.linalg.norm(candidate)

        with pytest.raises(EnrollError) as exc_info:
            _check_1_to_n_duplicate(candidate)

        assert "Carlos Silva" in str(exc_info.value)
        assert "já está cadastrado" in str(exc_info.value)


# ── Testes de Detecção de Vivacidade (PAD) ────────────────────────────────────


def test_verify_liveness_disabled():
    """Quando liveness_enabled=False, deve aprovar automaticamente."""
    face = np.ones((100, 100, 3), dtype=np.uint8) * 128
    with patch.object(settings, "liveness_enabled", False):
        is_live, score, reason = verify_liveness(face)
        assert is_live is True
        assert score == 1.0
        assert reason == "liveness_disabled"


def test_verify_liveness_glare_screen_spoof():
    """Face com reflexo especular extremo (>250 nos 3 canais) deve ser reprovada."""
    # Simula tela de celular com brilho de flash direto saturado
    glare_face = np.ones((100, 100, 3), dtype=np.uint8) * 255
    is_live, score, reason = verify_liveness(glare_face)
    assert is_live is False
    assert reason == "spoof_detected"


def test_verify_liveness_greyscale_paper_spoof():
    """Face sem tons de pele (ex: folha impressa P&B ou foto descolorida) deve ser reprovada."""
    # Imagem estritamente monocromática (B=G=R) sem componente de cor de pele
    bw_face = np.ones((100, 100, 3), dtype=np.uint8) * 80
    is_live, score, reason = verify_liveness(bw_face)
    assert is_live is False
    assert reason == "spoof_detected"


def test_lbp_texture_analysis():
    """Valida que textura rica com micro-relevo tem entropia LBP superior a superfície lisa."""
    from app.services.liveness_service import _analyze_lbp_texture

    flat = np.ones((64, 64), dtype=np.float32) * 128.0
    rng = np.random.default_rng(42)
    textured = rng.integers(50, 200, size=(64, 64)).astype(np.float32)

    score_flat = _analyze_lbp_texture(flat)
    score_textured = _analyze_lbp_texture(textured)

    assert score_textured > score_flat
    assert score_flat == 0.0


def test_identify_frames_multi_picks_best_candidate():
    """Valida que identify_frames escolhe o frame com maior confiança quando múltiplos passam."""
    from app.services.face_service import identify_frames

    mock_frame1 = {"recognized": True, "profile_id": "p1", "name": "Ana", "confidence": 0.62}
    mock_frame2 = {"recognized": True, "profile_id": "p1", "name": "Ana", "confidence": 0.88}
    mock_frame3 = {"recognized": False, "status": "blur_detected", "message": "Imagem borrada."}

    def mock_identify(img_bytes):
        if img_bytes == b"f1":
            return mock_frame1
        if img_bytes == b"f2":
            return mock_frame2
        return mock_frame3

    with patch("app.services.face_service.identify", side_effect=mock_identify):
        best = identify_frames([b"f1", b"f2", b"f3"])
        assert best["recognized"] is True
        assert best["name"] == "Ana"
        assert best["confidence"] == 0.88


def test_identify_frames_multi_rejects_on_spoof():
    """Se qualquer frame indicar spoof_detected, todo o lote multi-frame deve ser rejeitado."""
    from app.services.face_service import identify_frames

    mock_ok = {"recognized": True, "profile_id": "p1", "name": "Ana", "confidence": 0.90}
    mock_spoof = {"recognized": False, "status": "spoof_detected", "message": "Falha na vivacidade."}

    def mock_identify(img_bytes):
        if img_bytes == b"live_face":
            return mock_ok
        return mock_spoof

    with patch("app.services.face_service.identify", side_effect=mock_identify):
        res = identify_frames([b"live_face", b"spoof_photo"])
        assert res["recognized"] is False
        assert res["status"] == "spoof_detected"

