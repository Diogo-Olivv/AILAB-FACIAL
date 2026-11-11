# Ficha do modelo (model card)

> Revisada em 2026-11-11 · base `master@5f1d99c`.
> **Este documento não traz métricas de desempenho.** Nenhuma medição de FAR, FRR, APCER ou BPCER com dados rotulados e representativos foi feita ainda. Onde há valor, ele é de configuração de código, não de validação. Onde não há medição, está escrito "não medido".

## Identificação

| Item | Valor | Fonte |
|---|---|---|
| Modelo de reconhecimento | `buffalo_s` (InsightFace), detecção e reconhecimento | `backend/Dockerfile`, `backend/app/services/face_service.py` (F) |
| Dimensão do embedding | 512, normalizado L2 | F |
| Modelo de prova de vida (PAD) | MiniFASNetV2 (ONNX), obtido por `download_models.py` | F |
| Modelo de PAD: integridade | Hash fixado na obtenção (`download_models.py:19-21`) | F\* (relatado por leitura; não reconfirmado linha a linha) |
| Modelo de detecção de rosto | Mesmo pacote `buffalo_s` | F |
| Versão do pipeline | Não há versão gravada nos templates (**N-12**) | F |

## Uso pretendido

- Registrar presença de integrantes de um laboratório, com consentimento.
- Uso dentro de um ambiente controlado, com o tablet na entrada e a câmera frontal.

## Uso fora do escopo

- Identificação de pessoas em espaços públicos ou sem consentimento.
- Decisões que afetem direitos, como acesso a benefícios, sem revisão humana.
- Classificação por características sensíveis (idade, gênero, etnia, deficiência).
- Uso por terceiros sem avaliação própria.

## Limiares de decisão (código)

| Decisão | Valor | Medido? |
|---|---|---|
| Aceite (cosseno) | 0,62 | Não medido com dados reais |
| Incerto (cosseno) | 0,55 a 0,62 | Não medido |
| Distância máxima entre fotos do cadastro | 0,82 | Não medido |
| Nitidez mínima | 20 (variância do Laplaciano) | Não medido em câmera do tablet |
| PAD: score mínimo | 0,45 | Não medido com ataques reais |

## Avaliação

| Métrica | Estado |
|---|---|
| FAR (falsa aceitação) | **Não medido** |
| FRR (falsa rejeição) | **Não medido** |
| APCER (ataques aceitos pelo PAD, ISO/IEC 30107-3) | **Não medido** |
| BPCER (pessoas reais barradas pelo PAD) | **Não medido** |
| Equidade por grupo demográfico | **Não medido** (`backend/scripts/fairness_audit.py` usa vetores aleatórios e sempre passa: **N-25**) |
| Desempenho em tablet real, com a câmera do laboratório | **Não medido** |

Para medir, é preciso: um conjunto rotulado com consentimento, de integrantes reais e de ataques de apresentação (fotos, telas, máscaras); protocolo fixado antes da medição; relatório com intervalo de confiança. Ver [explanation/biometric-pipeline.md](../explanation/biometric-pipeline.md).

## Limitações conhecidas

- Iluminação e ângulo do tablet fixo, que podem afetar muito o desempenho.
- Óculos, máscara e cabelo podem gerar falsa rejeição (não medido).
- Gêmeos e parentes próximos podem gerar falsa aceitação (não medido).
- A zona incerta não tem segunda etapa implementada (**N-15**).
- Com várias fotos, a decisão não exige concordância entre elas (**N-14**).

## Governança do modelo

- Mudança de modelo ou de limiar exige ADR e nova avaliação (a fazer).
- I: templates antigos devem ficar incompatíveis com um modelo novo, porque o embedding muda; a migração exigiria nova captura. Não testado. Ver `docs/how-to/rotate-secrets.md`.
- Responsável técnico e encarregado: **a definir pelo controlador**.
