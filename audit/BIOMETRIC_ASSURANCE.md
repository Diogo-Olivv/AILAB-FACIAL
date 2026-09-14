# AILAB-FACIAL V4 — AUDITORIA DE GARANTIA BIOMÉTRICA & PAD

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Padrões de Referência:** ISO/IEC 19795 (Biometric Performance Testing), ISO/IEC 30107 (PAD), NIST FATE / FRVT  
**Status:** AUDITED  

---

## 1. Reconstrução do Pipeline Biométrico Ponta a Ponta

```
[Entrada: Imagem JPEG/PNG]
         │
         ▼
[1. FIQA / Pré-processamento]
 ├─ Conversão RGB para BGR
 ├─ Verificação de dimensões mínimas (min_face_size >= 40px)
 └─ Variância Laplaciana (min_laplacian_var >= 30.0) -> Rejeita motion blur
         │
         ▼
[2. Detecção & Alinhamento (SCRFD)]
 ├─ Detecção multi-escala em resolução 640x640 (det_score >= 0.50)
 └─ Heurística de Seleção Primária: prioridade = area_frac * (1 / (1 + dist_center)) * det_score
         │
         ▼
[3. Presentation Attack Detection (PAD / Liveness)]
 ├─ Verificação de dispersão cromática: sum(|R-B| + |R-G| + |G-B|) < 6.0 -> Rejeita fotos P&B
 ├─ Pipeline Primário: MiniFASNetV2 ONNX (patch 2.7x, 80x80 BGR)
 │   └─ Softmax sobre 3 classes: live_prob >= 0.45 -> 'onnx_pass'
 └─ Pipeline Secundário (Contingência): Micro-textura LBP + FFT 2D Moiré + YCrCb Pele
         │
         ▼
[4. Extração de Vetor Facial (ArcFace / MobileFaceNet)]
 ├─ Recorte facial alinhado (112x112 RGB)
 ├─ Intelecção de vetor denso 512-D
 └─ Normalização L2 estrita: normalized_enc = enc / ||enc||
         │
         ▼
[5. Pareamento & Comparação Vetorial (Matching)]
 ├─ Caminho A: Supabase RPC match_face (pgvector HNSW - distância cosseno <=> )
 └─ Caminho B (Fallback): Matriz NumPy em memória RAM (produto interno dot-product)
         │
         ▼
[6. Decisão de 3 Zonas & Calibração]
 ├─ Zona 1 (Aceite Definitivo): cos >= 0.68 E dist <= 0.80 -> recognized = true
 ├─ Zona 2 (Incerteza / Second-Factor): 0.62 <= cos < 0.68 -> recognized = false, status = 'uncertain'
 └─ Zona 3 (Rejeição Definitiva): cos < 0.62 -> recognized = false, status = 'not_recognized'
```

---

## 2. Paradigma Biométrico: 1:1 vs. 1:N & Riscos Open-Set

### 2.1 Análise Arquitetural
O AILAB-FACIAL opera **estritamente no paradigma 1:N de Identificação em Conjunto Aberto (Open-Set Identification)**.
- O usuário não digita sua matrícula nem aproxima um cartão/crachá antes da captura;
- A API recebe apenas os frames e busca o melhor candidato em toda a galeria de integrantes ativos cadastrados;
- **Não existe funcionalidade de verificação 1:1 implementada** no sistema.

### 2.2 Projeção Estatística de Falsos Positivos com o Crescimento da Galeria (FPIR)
Em um sistema 1:N open-set, a probabilidade de um não-membro (ou impostor) ser incorretamente identificado como algum integrante da base aumenta com o tamanho da galeria $N$:
$$\text{FPIR} = 1 - (1 - \text{FMR}_{1:1})^N \approx N \times \text{FMR}_{1:1}$$

Considerando a calibração com $\text{FMR}_{1:1} \approx 0.1\%$ no limiar $\cos \ge 0.68$:

| Tamanho da Galeria ($N$) | Tipo de População | Taxa de Falsa Identificação Estimada ($\text{FPIR}$) | Avaliação de Risco Operacional |
|:---:|---|:---:|---|
| **50** | Integrantes atuais do laboratório | $\approx 4.88\%$ | Aceitável para controle acadêmico com supervisão de tutores. |
| **200** | Expansão para múltiplos projetos | $\approx 18.14\%$ | Alto: 1 a cada 5 desconhecidos pode gerar match acidental. |
| **500** | Departamento / Bloco inteiro | $\approx 39.36\%$ | Inaceitável: colapso da barreira de identificação automática. |
| **1.000** | Centro acadêmico / Unidade | $\approx 63.23\%$ | Crítico: mais provável gerar falso match do que rejeitar. |
| **10.000** | Campus universitário | $> 99.99\%$ | Falência total do paradigma 1:N sem segundo fator de identificação. |

> [!IMPORTANT]
> **Recomendação Arquitetural Obrigatória:** Para bases com mais de 100 integrantes, o sistema DEVE migrar para verificação **1:1** (digitação prévia dos 4 últimos dígitos da matrícula ou leitura de QR code/crachá) ou implementar identificação restrita em duas etapas.

---

## 3. Calibração Matemática dos Limiares (Threshold Science)

### 3.1 Relação Matemática Cosseno $\leftrightarrow$ Euclidiana
Para dois vetores unitários $u, v \in \mathbb{R}^{512}$ tais que $\|u\|_2 = \|v\|_2 = 1$:
$$\|u - v\|_2 = \sqrt{\|u\|^2 + \|v\|^2 - 2 \langle u, v \rangle} = \sqrt{2 - 2 \cos(\theta)}$$
$$\cos(\theta) = 1 - \frac{\|u - v\|_2^2}{2}$$

Substituindo os valores do AILAB-FACIAL:
- Para `face_threshold = 0.80`:
  $$\cos(\theta) = 1 - \frac{0.80^2}{2} = 1 - \frac{0.64}{2} = 0.68 \equiv \text{face\_min\_cosine}$$
A equivalência matemática é rigorosa e consistente entre a busca euclidiana e o cosseno.

### 3.2 Calibração de Confiança via Platt Scaling
O cálculo de confiança é realizado pela função sigmoidal:
$$\text{Confidence} = \sigma(15.0 \times (\cos(\theta) - 0.50)) = \frac{1}{1 + e^{-15.0 \cdot (\cos(\theta) - 0.50)}}$$

- $\cos = 0.50 \rightarrow \text{Confidence} = 50.0\%$
- $\cos = 0.62 \rightarrow \text{Confidence} = 85.8\%$ (Início da zona incerta)
- $\cos = 0.68 \rightarrow \text{Confidence} = 93.7\%$ (Ponto de corte de aceite)
- $\cos = 0.75 \rightarrow \text{Confidence} = 97.7\%$ (Match de alta confiança)

> [!WARNING]
> **ASSURANCE GAP:** Os coeficientes $15.0$ e $0.50$ foram definidos de forma heurística analítica e **não foram ajustados estatisticamente por regressão logística sobre um dataset empírico local**.

---

## 4. Avaliação de Vivacidade & Anti-Spoofing (PAD / Liveness)

### 4.1 Eficácia Contra Tipos de Ataques (ISO/IEC 30107-3)

| Tipo de Ataque de Apresentação (PAI) | Descrição do Vetor | Nível de Mitigação | Evidência / Mecanismo |
|---|---|:---:|---|
| **Papel Impresso Fosco (P&B)** | Foto monocromática impressa em papel sulfite A4. | **TOTAL** | Bloqueado preliminarmente pelo cálculo de `chroma_spread < 6.0`. |
| **Papel Fotográfico Brilhante (Cor)** | Foto colorida impressa com brilho e textura fina. | **ALTO** | Detectado pelo MiniFASNetV2 (Classe 0: Print Attack) e LBP. |
| **Replay em Tela de Celular / Tablet** | Exibição de vídeo ou foto na tela de outro smartphone. | **MÉDIO / ALTO** | Detectado pela análise FFT 2D de moiré e MiniFASNetV2 (Classe 2: Replay). |
| **Tela OLED / 4K em Ângulo Oblíquo** | Smartphone topo de linha com brilho alto e tela anti-reflexo. | **PARCIAL** | Risco de taxa de evasão não desprezível dependendo da iluminação ambiente. |
| **Máscara de Silicone 3D / Látex** | Máscara tridimensional personalizada. | **NULO** | O sistema não possui sensor de profundidade (ToF / IR / LIDAR) nem desafio dinâmico. |
| **Injeção Digital de Frame (Virtual Cam)** | Bypass completo da câmera via requisição HTTP direta. | **NULO (Crítico)** | O backend aceita frames JPEG avulsos sem nonce nem assinatura de hardware. |

---

## 5. Garantia do Processo de Cadastro (Enrollment Assurance)

1. **Validação Intra-Burst:** Exige no mínimo 3 fotos válidas e impõe distância euclidiana máxima par a par de $0.70$. Impede que fotos de pessoas diferentes sejam misturadas durante o cadastro do mesmo aluno.
2. **Checagem Anti-Duplicidade 1:N:** Compara a média vetorial contra todos os integrantes ativos antes de persistir o novo perfil. Se $\cos \ge 0.68$, o cadastro é recusado com mensagem explícita.
3. **Guarda contra Troca de Identidade (`refresh-embedding`):** Impede que um tutor mal-intencionado substitua os dados biométricos de um aluno pelo rosto de outro integrante já registrado.
