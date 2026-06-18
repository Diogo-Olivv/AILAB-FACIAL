"""Cadastro de uma pessoa: captura N fotos pela webcam e salva embedding médio.

Uso:
    python enrollment/enroll.py NOME [--fotos 8] [--threshold-qualidade 0.5]

Saída:
    - dataset/NOME/NN.jpg  (fotos cadastradas)
    - embeddings/database.json  ({NOME: [128 floats]})

Pré-requisito: termo de consentimento (docs/PRIVACIDADE.md) assinado antes de rodar.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
from deepface import DeepFace
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "dataset"
DB_PATH = REPO_ROOT / "embeddings" / "database.json"


def capturar_foto(cap: cv2.VideoCapture, countdown: int = 3):
    for _ in range(5):
        cap.read()
    for i in range(countdown, 0, -1):
        print(f"  {i}...", flush=True)
        time.sleep(1)
    ok, frame_bgr = cap.read()
    if not ok:
        return None
    return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)


def detectar_e_embedar(frame_rgb):
    """Usando DeepFace (Facenet) para cadastro."""
    try:
        faces = DeepFace.represent(img_path=frame_rgb, model_name="Facenet", detector_backend="opencv", enforce_detection=False)
    except Exception:
        return None, None, 0
    
    valid_faces = [f for f in faces if f.get("face_confidence", 1.0) >= 0.9]
    if len(valid_faces) != 1:
        return None, None, len(valid_faces)
    
    face = valid_faces[0]
    enc = np.array(face["embedding"], dtype=np.float64)
    box = face["facial_area"]
    # box is dict: {'x', 'y', 'w', 'h'}
    loc = (box["y"], box["x"] + box["w"], box["y"] + box["h"], box["x"])
    return loc, enc, 1


def validar_qualidade(enc_novo, encs_anteriores, max_dist=0.5):
    if not encs_anteriores:
        return True
    for e in encs_anteriores:
        if np.linalg.norm(e - enc_novo) > max_dist:
            return False
    return True


def carregar_db():
    if DB_PATH.exists():
        return json.loads(DB_PATH.read_text())
    return {}


def salvar_db(db):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB_PATH.write_text(json.dumps(db, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Cadastra pessoa via webcam.")
    parser.add_argument("nome", help="Nome em snake_case (ex.: diogo_silva)")
    parser.add_argument("--fotos", type=int, default=8)
    parser.add_argument("--threshold-qualidade", type=float, default=0.5)
    args = parser.parse_args()

    pessoa = args.nome.strip().lower().replace(" ", "_")
    if not pessoa.replace("_", "").isalnum():
        print(f"Nome inválido: {pessoa!r}. Use só letras/dígitos/underscore.")
        return 2

    pessoa_dir = DATASET_DIR / pessoa
    pessoa_dir.mkdir(parents=True, exist_ok=True)
    existentes = len(list(pessoa_dir.glob("*.jpg")))
    if existentes:
        print(f"Pessoa já tem {existentes} fotos. Vou adicionar mais (não sobrescreve).")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERRO: webcam não abriu (cheque /dev/video0)")
        return 1

    print(f"Cadastrando {pessoa!r} — vou tirar {args.fotos} fotos boas.")
    print("Varie levemente: rosto reto, leve sorriso, leve giro pra cada lado.")
    print("Confirme verbalmente que o termo (docs/PRIVACIDADE.md) foi assinado.\n")

    encs_sessao = []
    tentativas = 0
    max_tentativas = args.fotos * 3

    try:
        while len(encs_sessao) < args.fotos and tentativas < max_tentativas:
            tentativas += 1
            print(f"[{len(encs_sessao)+1}/{args.fotos}] Posicione e olhe pra câmera:")
            frame = capturar_foto(cap)
            if frame is None:
                print("  ✗ falha de captura"); continue
            box, enc, n_rostos = detectar_e_embedar(frame)
            if n_rostos == 0:
                print("  ✗ nenhum rosto detectado"); continue
            if n_rostos > 1:
                print(f"  ✗ {n_rostos} rostos no quadro — fique sozinho"); continue
            if not validar_qualidade(enc, encs_sessao, args.threshold_qualidade):
                print("  ✗ rosto muito diferente das outras fotos da sessão — descartado")
                continue
            idx = existentes + len(encs_sessao) + 1
            arquivo = pessoa_dir / f"{idx:02d}.jpg"
            cv2.imwrite(str(arquivo), cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
            encs_sessao.append(enc)
            print(f"  ✓ salva em {arquivo.relative_to(REPO_ROOT)}")
    finally:
        cap.release()

    if not encs_sessao:
        print("\nNenhuma foto válida capturada — abortando.")
        return 1

    todos_encs = []
    for f in sorted(pessoa_dir.glob("*.jpg")):
        try:
            faces = DeepFace.represent(img_path=str(f), model_name="Facenet", detector_backend="opencv", enforce_detection=False)
            valid = [fc for fc in faces if fc.get("face_confidence", 1.0) >= 0.9]
            if len(valid) == 1:
                todos_encs.append(np.array(valid[0]["embedding"], dtype=np.float64))
        except Exception:
            pass

    emb_medio = np.mean(todos_encs, axis=0).tolist()

    db = carregar_db()
    db[pessoa] = emb_medio
    salvar_db(db)

    print(f"\n✅ Cadastrado {pessoa!r} com {len(todos_encs)} fotos totais.")
    print(f"   Embedding médio (128-D) em {DB_PATH.relative_to(REPO_ROOT)}")
    print(f"   Base agora tem {len(db)} pessoa(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
