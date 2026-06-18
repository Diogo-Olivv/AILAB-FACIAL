"""Loop ao vivo: webcam → identifica → registra entrada/saída.

Uso:
    python attendance/run.py [--threshold 0.55] [--show]

Tecla ESC ou Ctrl+C encerra. Use --show pra ver janela com bounding box.
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
sys.path.insert(0, str(REPO_ROOT))

from attendance.logic import registrar  # noqa: E402

DB_PATH = REPO_ROOT / "embeddings" / "database.json"
INTERVALO_ANALISE_S = 0.5  # 2 fps


def carregar_base():
    if not DB_PATH.exists():
        print(f"ERRO: {DB_PATH} não existe. Rode enrollment/enroll.py primeiro.")
        sys.exit(1)
    db = json.loads(DB_PATH.read_text())
    nomes = list(db.keys())
    matriz = np.array([db[n] for n in nomes], dtype=np.float64)
    return nomes, matriz


def identificar(frame_rgb, nomes, matriz, threshold):
    try:
        faces = DeepFace.represent(img_path=frame_rgb, model_name="Facenet", detector_backend="opencv", enforce_detection=False)
    except Exception:
        return []
    
    out = []
    for face in faces:
        if face.get("face_confidence", 1.0) < 0.9: continue
        enc = np.array(face["embedding"], dtype=np.float64)
        box = face["facial_area"]
        # convert {'x', 'y', 'w', 'h'} to (top, right, bottom, left)
        top, right, bottom, left = box["y"], box["x"] + box["w"], box["y"] + box["h"], box["x"]
        
        dists = np.linalg.norm(matriz - enc, axis=1)
        idx = int(np.argmin(dists))
        d = float(dists[idx])
        nome = nomes[idx] if d < threshold else None
        out.append(((top, right, bottom, left), nome, d))
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.55)
    parser.add_argument("--show", action="store_true",
                        help="abre janela com vídeo anotado (não use em ssh)")
    args = parser.parse_args()

    nomes, matriz = carregar_base()
    print(f"Base com {len(nomes)} pessoa(s): {nomes}")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERRO: webcam não abriu")
        return 1

    print("Loop ativo. Ctrl+C pra parar.")
    try:
        while True:
            t0 = time.time()
            ok, frame_bgr = cap.read()
            if not ok:
                print("falha de captura, tentando de novo")
                time.sleep(0.5); continue
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            resultados = identificar(frame_rgb, nomes, matriz, args.threshold)

            for box, nome, d in resultados:
                top, right, bottom, left = box
                cor = (0, 255, 0) if nome else (0, 0, 255)
                label = f"{nome} ({d:.2f})" if nome else f"? ({d:.2f})"
                if nome:
                    r = registrar(nome)
                    if r["acao"] in ("entrada", "saida"):
                        ts = r["timestamp"][11:]
                        emoji = "→" if r["acao"] == "entrada" else "←"
                        extra = f"  ({r['duracao_minutos']} min)" if r["acao"] == "saida" else ""
                        print(f"{emoji} {ts} {nome} {r['acao']}{extra}")
                if args.show:
                    cv2.rectangle(frame_bgr, (left, top), (right, bottom), cor, 2)
                    cv2.putText(frame_bgr, label, (left, top - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, cor, 2)

            if args.show:
                cv2.imshow("AILAB Presenca", frame_bgr)
                if cv2.waitKey(1) & 0xFF == 27:  # ESC
                    break

            dt = time.time() - t0
            time.sleep(max(0.0, INTERVALO_ANALISE_S - dt))
    except KeyboardInterrupt:
        print("\nEncerrado pelo usuário.")
    finally:
        cap.release()
        if args.show:
            cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    sys.exit(main())
