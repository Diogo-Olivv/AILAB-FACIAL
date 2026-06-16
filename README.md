# AILAB-FACIAL — Presença por Reconhecimento Facial

Sistema de controle de presença para laboratório de extensão. Substitui a lista
de assinatura manual por reconhecimento facial automático em um tablet Samsung
Galaxy Tab S6 Lite posicionado na entrada do laboratório.

> Projeto didático. O objetivo é tanto entregar o sistema quanto **aprender os
> fundamentos de ciência de dados por trás do reconhecimento facial**.

## Arquitetura em uma frase

PWA (web app instalável) que roda no tablet, usa a câmera frontal, identifica o
participante via `face-api.js` (TensorFlow.js, 128-D embeddings), registra
entrada/saída em IndexedDB e sincroniza com uma Google Sheets para os tutores
visualizarem as horas.

```
Tablet (PWA)  ──Wi-Fi──►  Google Sheets  ──►  Tutores
   │
   └─ Câmera → detecção → embedding → matching → SQLite local
```

## Estrutura do repositório

| Pasta | O que vive aqui |
|---|---|
| `notebooks/` | Jupyter — Sprint 1, fase de **aprendizado**. Cada notebook ensina um conceito. |
| `enrollment/` | Scripts Python de cadastro de pessoas (gera embeddings a partir da webcam). |
| `attendance/` | Lógica de presença em Python (SQLite, debounce, soma de horas). |
| `dataset/` | Fotos cadastradas, 1 subpasta por pessoa. **Não versionar** (dado biométrico). |
| `embeddings/` | Banco de embeddings (`database.json`). **Não versionar**. |
| `pwa/` | App web final que vai rodar no tablet. |
| `pwa/models/` | Modelos pré-treinados do face-api.js (baixados, não versionados). |
| `docs/` | Notas, `THRESHOLD.md` (justificativa do threshold), `PRIVACIDADE.md` (LGPD). |

## Como começar

```bash
cd ~/Coding/AILAB-FACIAL
python3 -m venv .venv          # 3.13 funciona; cmake vem via pip (ver requirements.txt)
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -m ipykernel install --user --name ailab-facial --display-name "AILAB-FACIAL"
jupyter lab
```

## Fluxo de uso

### Aprender (rodar 1x)

```bash
jupyter lab        # abrir notebooks/01..05 em ordem
```

### Cadastrar pessoa (Python, validação)

```bash
python enrollment/enroll.py NOME --fotos 8
# salva dataset/NOME/NN.jpg + embeddings/database.json
```

### Loop de presença (Python, validação)

```bash
python attendance/run.py --show     # ESC para sair
# escreve em attendance/attendance.db
```

### PWA (final, roda no tablet)

```bash
cd pwa && python3 -m http.server 8765
# abrir http://localhost:8765 → cadastro em /enroll.html
# deploy: docs/DEPLOY_TABLET.md
```

## Sprints (status)

| Sprint | Entrega | Status |
|---|---|---|
| 0 | Setup, requirements, estrutura | ✅ |
| 1 | Notebooks `01..05` (detecção, alinhamento, embeddings, FAR/FRR) | ✅ threshold `0.55` (`docs/THRESHOLD.md`) |
| 2 | `enrollment/enroll.py`, `attendance/logic.py`, `attendance/run.py` | ✅ lógica testada |
| 3 | PWA (HTML/JS + face-api.js + IndexedDB + Service Worker) | ✅ |
| 4 | Sync Google Sheets via Apps Script | ✅ código + `docs/SHEETS_SETUP.md` (webhook a configurar) |
| 5 | Deploy GitHub Pages + Fully Kiosk | ✅ `docs/DEPLOY_TABLET.md` |
| 6 | Avaliação em uso real após 1 semana | ⏳ depois do deploy |

Plano completo: `~/.claude/plans/starry-sniffing-codd.md`.

## Privacidade — LGPD

Rosto é **dado biométrico sensível**. Antes de cadastrar qualquer participante:

1. Coletar **consentimento explícito por escrito** (modelo em `docs/PRIVACIDADE.md`).
2. Deixar claro: finalidade (presença), onde os dados ficam (tablet do lab +
   planilha do lab), retenção (semestre vigente), direito de revogar.
3. Embeddings e fotos **nunca** saem do tablet/planilha do laboratório.
