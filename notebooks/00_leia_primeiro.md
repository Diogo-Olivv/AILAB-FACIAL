# Como usar os notebooks deste projeto

Cada notebook ensina **um conceito** do pipeline de reconhecimento facial. Eles
são curtos de propósito — você roda célula por célula, lê os comentários,
modifica os valores e vê o que muda.

## Ordem

1. `01_detection.ipynb` — **Detecção** facial: achar o rosto na imagem.
2. `02_landmarks_alignment.ipynb` — Encontrar olhos/nariz/boca e **alinhar**.
3. `03_embeddings.ipynb` — Transformar rosto em **vetor numérico** (128-D).
4. `04_threshold_evaluation.ipynb` — Escolher o **limiar de aceitação** com FAR/FRR.
5. `05_pipeline_completo.ipynb` — Tudo junto, ao vivo na webcam.

## Setup do ambiente (uma vez só)

```bash
cd ~/Coding/AILAB-FACIAL
source .venv/bin/activate     # se ainda não criou: ver README.md
jupyter lab
```

No JupyterLab, selecione o kernel **"AILAB-FACIAL"** (criado pelo `ipykernel
install` do README).

## Dataset mínimo para os experimentos

Para os notebooks 03 e 04 você precisa de **fotos de pelo menos 3 pessoas
diferentes, ~5 fotos cada**. Sugestões:

- **Você mesmo**: tire 5 selfies com expressões/ângulos levemente diferentes.
- **2 colegas** do laboratório (com consentimento — ver `docs/PRIVACIDADE.md`).
- **Alternativa pública** (só para estudo, não vai pro sistema real): baixe o
  [LFW (Labeled Faces in the Wild)](http://vis-www.cs.umass.edu/lfw/) — 13k
  rostos rotulados de personalidades públicas. Bom para validar o pipeline.

Organize assim:

```
dataset/
├── diogo/
│   ├── 01.jpg
│   ├── 02.jpg
│   └── ...
├── colega_a/
│   └── ...
└── colega_b/
    └── ...
```

## Mentalidade ao rodar os notebooks

- **Não apenas execute**: leia os comentários, mude um parâmetro, veja o efeito.
- **Anote dúvidas** num arquivo `notebooks/duvidas.md`. Muitas viram tópicos de
  estudo depois.
- **Se algo não bater com o esperado**: provavelmente não é bug, é aprendizado.
  Tente entender por quê antes de "consertar".
