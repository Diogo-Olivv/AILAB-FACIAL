# Threshold do reconhecimento facial

**Valor escolhido:** `0.55` (distância euclidiana máxima para considerar "mesma pessoa").

## Justificativa

- EER medido em pares positivos (dataset local) vs negativos (LFW + local×LFW): **0.590** com taxa de erro **0.18%**.
- Adotamos `min(EER, 0.55)` para favorecer FAR baixo — num lab de extensão com ~20 pessoas conhecidas, "aceitar errado" é pior que "pedir pra repetir".

## Como reavaliar

Refazer `notebooks/04_threshold_evaluation.ipynb` periodicamente, em especial:
- Quando adicionar novos participantes (mais pares positivos reais).
- Após 1 semana de uso em produção (Sprint 6) — medir FRR/FAR reais e ajustar.

## Histórico

- 2026-06-16: valor inicial `0.55` (n_pos=10, n_neg=1368, EER=0.590).
