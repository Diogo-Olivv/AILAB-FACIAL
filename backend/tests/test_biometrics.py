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

    # Limiar calibrado face_threshold=0.80 deve corresponder a cos_theta = 0.68
    # Verificação: 1.0 - (0.80^2)/2 = 1.0 - 0.32 = 0.68 == face_min_cosine ✓
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


def test_extract_pad_patch_geometry_and_boundaries():
    """Valida que extract_pad_patch gera tensor 80x80 mesmo em faces nas bordas da imagem."""
    from app.services.liveness_service import extract_pad_patch

    # Imagem simulada 640x480
    img = np.zeros((480, 640, 3), dtype=np.uint8)

    # 1. Face centralizada
    patch_center = extract_pad_patch(img, [200, 150, 400, 350], scale=2.7, out_size=80)
    assert patch_center.shape == (80, 80, 3)

    # 2. Face na borda superior esquerda (x=0, y=0)
    patch_corner = extract_pad_patch(img, [0, 0, 100, 100], scale=2.7, out_size=80)
    assert patch_corner.shape == (80, 80, 3)

    # 3. Face na borda inferior direita
    patch_rb = extract_pad_patch(img, [540, 380, 640, 480], scale=2.7, out_size=80)
    assert patch_rb.shape == (80, 80, 3)


def test_enroll_persists_dual_vectors():
    """Valida que o cadastro sempre persiste tanto 'embedding' quanto 'vec' no banco."""
    from app.services.enroll_service import enroll

    mock_db = MagicMock()
    mock_profiles = MagicMock()
    mock_profiles.insert.return_value.execute.return_value.data = [{"id": "prof-123"}]
    mock_face_emb = MagicMock()
    mock_face_emb.insert.return_value.execute.return_value.data = [{"id": "emb-1"}]

    def table_router(table_name: str):
        if table_name == "profiles":
            return mock_profiles
        if table_name == "face_embeddings":
            return mock_face_emb
        return MagicMock()

    mock_db.table.side_effect = table_router

    # Três vetores consistentes para passar na validação intra-burst
    v1 = np.ones(512, dtype=np.float64)
    v1 /= np.linalg.norm(v1)

    with (
        patch("app.services.enroll_service.get_client", return_value=mock_db),
        patch("app.services.enroll_service.extract_primary_face_data", return_value=(None, v1, "ok", "ok")),
        patch("app.services.enroll_service._check_1_to_n_duplicate"),
        patch("app.services.enroll_service.invalidate_embeddings_cache"),
    ):
        enroll("Aluno Teste", "232038442", [b"img1", b"img2", b"img3"], consent=True)

        # Verifica chamada de insert em face_embeddings
        insert_calls = mock_face_emb.insert.call_args_list
        assert len(insert_calls) == 1
        payload = insert_calls[0][0][0]
        assert payload["profile_id"] == "prof-123"
        assert "embedding" in payload
        assert "vec" in payload
        assert len(payload["vec"]) == 512


# ── Testes de Limiares Biométricos Calibrados (P0) ────────────────────────────


def test_identify_rejects_impostor_below_min_cosine():
    """Impostor com similaridade cosseno < 0.62 deve ser rejeitado definitivamente.

    Regressão: com os limiares antigos (face_min_cosine=0.50), impostores ArcFace
    com cos~0.40-0.52 podiam ser aceitos. Após P0, o limiar de rejeição definitiva
    é 0.62 e o de aceite automático é 0.68.
    """
    from app.services.face_service import identify

    rng = np.random.default_rng(55)
    enrolled_vec = rng.standard_normal(512)
    enrolled_vec = enrolled_vec / np.linalg.norm(enrolled_vec)

    # Impostor: componente ortogonal ao cadastrado → cos ~0
    impostor_vec = rng.standard_normal(512)
    impostor_vec -= np.dot(impostor_vec, enrolled_vec) * enrolled_vec
    impostor_vec = impostor_vec / np.linalg.norm(impostor_vec)

    mock_loaded = (
        ["prof-uuid-1"],
        ["João Cadastrado"],
        np.array([enrolled_vec], dtype=np.float64),
    )

    with (
        patch("app.services.face_service._load_embeddings", return_value=mock_loaded),
        patch(
            "app.services.face_service.extract_primary_face_data",
            return_value=(None, impostor_vec, "ok", "ok"),
        ),
        patch("app.services.face_service.verify_liveness", return_value=(True, 1.0, "ok")),
        patch.object(settings, "face_min_cosine", 0.68),
        patch.object(settings, "face_uncertain_cosine", 0.62),
        patch.object(settings, "face_threshold", 0.80),
    ):
        result = identify(b"fake_image_bytes")
        assert result["recognized"] is False
        assert result["status"] in ("not_recognized", "uncertain")
        # Cosine de vetor ortogonal é próximo de 0 — muito abaixo de qualquer zona de aceite
        assert result.get("cosine_similarity", 0.0) < 0.62


def test_identify_cosine_threshold_is_calibrated_to_068():
    """Verifica que o limiar de aceite configurado é 0.68 (não o antigo 0.50).

    Garante que um impostor com cos=0.60 (acima do limiar antigo 0.50 mas abaixo
    do novo 0.68) seja tratado como uncertain ou not_recognized — nunca recognized.
    """
    from app.services.face_service import identify

    rng = np.random.default_rng(77)
    enrolled_vec = rng.standard_normal(512)
    enrolled_vec = enrolled_vec / np.linalg.norm(enrolled_vec)

    # Constrói vetor com cos=0.60 em relação ao enrolled
    target_cos = 0.60
    perp = rng.standard_normal(512)
    perp -= np.dot(perp, enrolled_vec) * enrolled_vec
    perp = perp / np.linalg.norm(perp)
    vec_60 = target_cos * enrolled_vec + np.sqrt(1 - target_cos**2) * perp
    vec_60 = vec_60 / np.linalg.norm(vec_60)

    actual_cos = float(np.dot(enrolled_vec, vec_60))
    assert abs(actual_cos - target_cos) < 0.01, f"Construção falhou: cos={actual_cos}"

    mock_loaded = (
        ["prof-uuid-2"],
        ["Carlos Limiar"],
        np.array([enrolled_vec], dtype=np.float64),
    )

    with (
        patch("app.services.face_service._load_embeddings", return_value=mock_loaded),
        patch(
            "app.services.face_service.extract_primary_face_data",
            return_value=(None, vec_60, "ok", "ok"),
        ),
        patch("app.services.face_service.verify_liveness", return_value=(True, 1.0, "ok")),
        patch.object(settings, "face_min_cosine", 0.68),
        patch.object(settings, "face_uncertain_cosine", 0.62),
        patch.object(settings, "face_threshold", 0.80),
    ):
        result = identify(b"fake_image_bytes")
        # cos=0.60 está abaixo do face_uncertain_cosine (0.62): rejeição definitiva
        assert result["recognized"] is False
        assert result["status"] == "not_recognized"


# ── Testes Específicos de pgvector com Decisão em 3 Zonas ────────────────────


def test_pgvector_match_face_accepts_above_068():
    """pgvector RPC retornando similaridade >= 0.68 deve ser aceito com status 'ok'."""
    from app.services.face_service import _match_face_pgvector

    mock_db = MagicMock()
    mock_rpc = MagicMock()
    mock_db.rpc.return_value = mock_rpc
    mock_rpc.execute.return_value = MagicMock(
        data=[
            {
                "profile_id": "prof-1",
                "name": "Ana Clara",
                "similarity": 0.72,
            }
        ]
    )

    query_enc = np.ones(512, dtype=np.float64) / np.sqrt(512)

    with patch("app.services.face_service.get_client", return_value=mock_db):
        res = _match_face_pgvector(query_enc)

        assert res is not None
        assert res["recognized"] is True
        assert res["status"] == "ok"
        assert res["profile_id"] == "prof-1"
        assert res["name"] == "Ana Clara"
        assert res["cosine_similarity"] == 0.72

        # Valida que o match_threshold passado na RPC foi <= 0.45 (e NUNCA limiar de similaridade)
        rpc_call_args = mock_db.rpc.call_args[0]
        assert rpc_call_args[0] == "match_face"
        passed_params = rpc_call_args[1]
        assert passed_params["match_threshold"] <= 0.45, (
            f"match_threshold deve ser a distância máxima (<= 0.45), mas foi {passed_params['match_threshold']}"
        )


def test_pgvector_match_face_uncertain_between_055_and_062():
    """pgvector RPC retornando similaridade na zona incerta (0.55 a 0.62) deve retornar status 'uncertain'."""
    from app.services.face_service import _match_face_pgvector

    mock_db = MagicMock()
    mock_rpc = MagicMock()
    mock_db.rpc.return_value = mock_rpc
    mock_rpc.execute.return_value = MagicMock(
        data=[
            {
                "profile_id": "prof-2",
                "name": "Bruno Silva",
                "similarity": 0.58,
            }
        ]
    )

    query_enc = np.ones(512, dtype=np.float64) / np.sqrt(512)

    with patch("app.services.face_service.get_client", return_value=mock_db):
        res = _match_face_pgvector(query_enc)

        assert res is not None
        assert res["recognized"] is False
        assert res["status"] == "uncertain"
        assert "profile_id" not in res
        assert "name" not in res
        assert "cosine_similarity" not in res
        assert "distance" not in res
        assert "similarity" not in res


def test_pgvector_match_face_rejects_impostor_below_055():
    """pgvector RPC retornando similaridade < 0.55 deve ser rejeitado com status 'not_recognized'."""
    from app.services.face_service import _match_face_pgvector

    mock_db = MagicMock()
    mock_rpc = MagicMock()
    mock_db.rpc.return_value = mock_rpc
    mock_rpc.execute.return_value = MagicMock(
        data=[
            {
                "profile_id": "prof-3",
                "name": "Impostor",
                "similarity": 0.50,
            }
        ]
    )

    query_enc = np.ones(512, dtype=np.float64) / np.sqrt(512)

    with patch("app.services.face_service.get_client", return_value=mock_db):
        res = _match_face_pgvector(query_enc)

        assert res is not None
        assert res["recognized"] is False
        assert res["status"] == "not_recognized"


def test_extract_representative_embeddings_clustering():
    """Garante que fotos com variação natural (com e sem óculos) geram 2 vetores representativos."""
    from app.services.enroll_service import _extract_representative_embeddings

    rng = np.random.default_rng(42)
    # Polo 1: cluster "sem óculos"
    base1 = rng.standard_normal(512)
    base1 /= np.linalg.norm(base1)
    encs_no_glasses = [base1 + rng.normal(0, 0.05, 512) for _ in range(3)]
    encs_no_glasses = [v / np.linalg.norm(v) for v in encs_no_glasses]

    # Polo 2: cluster "com óculos" (afastado ~0.65 de distância)
    base2 = base1 + rng.normal(0, 0.45, 512)
    base2 /= np.linalg.norm(base2)
    encs_with_glasses = [base2 + rng.normal(0, 0.05, 512) for _ in range(2)]
    encs_with_glasses = [v / np.linalg.norm(v) for v in encs_with_glasses]

    all_encs = encs_no_glasses + encs_with_glasses

    reps = _extract_representative_embeddings(all_encs)
    assert len(reps) == 2, f"Deveria extrair 2 clusters representativos, obteve {len(reps)}"
    for r in reps:
        assert np.isclose(np.linalg.norm(r), 1.0, atol=1e-5)


# ── Testes de Cancelable Biometrics & BioHashing (ISO/IEC 24745) ─────────────


def test_biohashing_projection_isometry_linear():
    """Valida que a projeção de BioHashing é uma isometria linear perfeita."""
    from app.services.face_service import (
        apply_template_protection,
        get_biohash_projection_matrix,
    )

    rng = np.random.default_rng(123)
    u = rng.standard_normal(512)
    v = rng.standard_normal(512)
    u = u / np.linalg.norm(u)
    v = v / np.linalg.norm(v)

    raw_euclidean = float(np.linalg.norm(u - v))
    raw_cosine = float(np.dot(u, v))

    # Projeta no espaço protegido
    u_prot = apply_template_protection(u)
    v_prot = apply_template_protection(v)

    prot_euclidean = float(np.linalg.norm(u_prot - v_prot))
    prot_cosine = float(np.dot(u_prot, v_prot))

    # 1. Distância euclidiana rigorosamente preservada
    assert np.isclose(raw_euclidean, prot_euclidean, atol=1e-6)
    # 2. Similaridade cosseno rigorosamente preservada
    assert np.isclose(raw_cosine, prot_cosine, atol=1e-6)
    # 3. Norma unitária preservada
    assert np.isclose(np.linalg.norm(u_prot), 1.0, atol=1e-6)
    assert np.isclose(np.linalg.norm(v_prot), 1.0, atol=1e-6)


def test_biohashing_orthonormality_and_revocability():
    """Valida ortonormalidade Q^T Q = I e cancelabilidade entre chaves diferentes."""
    from app.services.face_service import (
        apply_template_protection,
        get_biohash_projection_matrix,
    )

    Q = get_biohash_projection_matrix("seed-campus-central-1")
    # Q^T Q deve ser a matriz identidade I_512
    identity_approx = np.dot(Q.T, Q)
    eye = np.eye(512)
    assert np.allclose(identity_approx, eye, atol=1e-6)

    # Revocabilidade: duas sementes institucionais distintas produzem espaços não-correlacionados
    rng = np.random.default_rng(456)
    face_raw = rng.standard_normal(512)
    face_raw /= np.linalg.norm(face_raw)

    prot_seed1 = apply_template_protection(face_raw, seed="campus-1")
    prot_seed2 = apply_template_protection(face_raw, seed="campus-2-revoked")

    # O vetor protegido é completamente diferente do bruto
    assert not np.allclose(prot_seed1, face_raw, atol=0.1)
    # E templates de instituições/chaves diferentes não se correlacionam (cosseno ~ 0)
    cross_sim = float(np.dot(prot_seed1, prot_seed2))
    assert abs(cross_sim) < 0.20


# ── Testes de 3D Flash Liveness (ISO/IEC 30107-3) ───────────────────────────


def test_verify_flash_reflection_rejects_identical_static_frames():
    """Dois frames idênticos em rajada indicam replay de imagem estática ou vídeo congelado."""
    from app.services.liveness_service import verify_flash_reflection

    rng = np.random.default_rng(88)
    frame_static = rng.integers(40, 220, size=(112, 112, 3), dtype=np.uint8)

    is_live, score, reason = verify_flash_reflection(frame_static, frame_static)
    assert is_live is False
    assert reason == "static_replay_detected"
    assert score < 0.20


def test_verify_flash_reflection_accepts_dynamic_flash_response():
    """Frames com resposta de iluminação fotométrica na face são aprovados."""
    from app.services.liveness_service import verify_flash_reflection

    rng = np.random.default_rng(99)
    ambient = rng.integers(60, 180, size=(112, 112, 3), dtype=np.uint8)
    # Flash eleva a iluminação frontal da face
    flash = ambient.copy().astype(np.int16)
    flash[30:80, 30:80] += 25  # Convexidade central iluminada
    flash = np.clip(flash, 0, 255).astype(np.uint8)

    is_live, score, reason = verify_flash_reflection(ambient, flash)
    assert is_live is True
    assert reason == "flash_reflection_ok"
    assert score >= 0.45



