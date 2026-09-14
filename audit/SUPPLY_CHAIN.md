# AILAB-FACIAL V4 — AUDITORIA DE SUPPLY CHAIN & DEPENDÊNCIAS

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Padrões:** SLSA Framework / NIST SP 800-161 / OWASP Top 10 Software Component Verification  
**Status:** AUDITED  

---

## 1. Inventário de Dependências e Lockfiles

### 1.1 Backend Python (`backend/requirements.txt`)
- O arquivo `backend/requirements.txt` utiliza declaração de limites superiores (`fastapi>=0.111,<1`, `onnxruntime>=1.17,<2`, `numpy>=1.26,<2`), mas **NÃO possui um lockfile determinístico (`poetry.lock`, `Pipfile.lock` ou `requirements.lock` gerado via pip-compile com hashes SHA-256)**.
- **Risco de Supply Chain:** Builds executados em momentos diferentes no Dockerfile ou CI/CD podem resolver versões minor/patch distintas das bibliotecas, introduzindo incompatibilidades silenciosas ou pacotes comprometidos upstream (Dependency Confusion / Typosquatting).

### 1.2 Frontend Web (`web/package.json` e `web/package-lock.json`)
- Possui lockfile versionado (`package-lock.json` lockfileVersion 3).
- O workflow de CI (`deploy-pages.yml`) executa `npm ci`, garantindo integridade e determinismo de compilação.

### 1.3 Frontend Mobile (`mobile/package.json` e `mobile/package-lock.json`)
- Possui lockfile versionado (`package-lock.json` lockfileVersion 3).
- Utiliza Expo SDK 57 / React 19 / React Native 0.86. Dependências alinhadas aos padrões oficiais do ecossistema Expo.

---

## 2. Proveniência e Integridade de Artefatos de Modelos de IA

| Modelo / Artefato | Fonte de Download Declarada | Protocolo de Download | Verificação de Integridade (Hash) | Risco de Adulteração |
|---|---|:---:|:---:|:---:|
| **`pad.onnx` (MiniFASNetV2)** | Hugging Face (`garciafido/minifasnet-v2-anti-spoofing-onnx`) | HTTPS com User-Agent customizado | ✅ **SHA-256 Rígido** (`d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b`) | **Baixo:** Verificação atômica no script `backend/scripts/download_models.py`. Se o hash divergir, o build falha com exit code 1. |
| **`buffalo_s` (InsightFace Pack)** | InsightFace GitHub Releases / Google Drive (via script interno da lib `insightface`) | Baixado dinamicamente durante `docker build` via Python inline | ❌ **Nenhum hash SHA-256 verificado no Dockerfile** | **ALTO:** O pacote de pesos é baixado de mirrors externos não pinados. Se o repositório upstream ou a CDN do InsightFace sofrer ataque Man-in-the-Middle ou substituição de release, o container incorporará pesos não verificados. |

---

## 3. Auditoria de Segurança do Container Docker (`backend/Dockerfile`)

### 3.1 Práticas Recomendadas Implementadas (Green Flags)
1. **Usuário Não-Root:**
   - Criação de usuário de serviço dedicado:
     ```dockerfile
     RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
     USER appuser
     ```
   - O processo FastAPI executa sem privilégios de root, limitando o raio de destruição em caso de Remote Code Execution (RCE).
2. **Empacotamento Pré-Build de Pesos:**
   - O modelo `buffalo_s` e o `pad.onnx` são baixados durante a construção da imagem Docker e salvos em `/app/.insightface`. Isso impede que instâncias no Cloud Run façam chamadas externas à internet no boot.
3. **Variáveis de Otimização Multithread:**
   - Configurações explícitas de `OMP_NUM_THREADS=2`, `OPENBLAS_NUM_THREADS=2` e `MALLOC_ARENA_MAX=2` para mitigar fragmentação de memória sob inferência concorrente.

### 3.2 Vulnerabilidades e Riscos do Runtime Docker
1. **Tag de Imagem Base Flutuante:**
   - O Dockerfile declara `FROM python:3.11-slim`. Sem pinning por digest SHA-256 (`python:3.11-slim@sha256:...`), a imagem base varia conforme novos patches da imagem oficial do Debian/Python são lançados pela Docker Hub.
2. **Pacotes de Compilação no Container Final:**
   - O comando `apt-get install -y build-essential` é executado no mesmo estágio que roda a aplicação final. Compiladores C/C++ (`gcc`, `make`) permanecem presentes no filesystem do container de produção, facilitando a compilação de binários maliciosos por invasores caso ocorra uma brecha de execução de código.
   - **Remediação:** Migrar para um Dockerfile multi-stage, compilando as extensões em um estágio `builder` e copiando apenas os binários para a imagem `runner` limpa.
