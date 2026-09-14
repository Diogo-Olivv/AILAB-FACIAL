# AILAB-FACIAL V4 — PRIVACIDADE, CICLO DE VIDA DE DADOS & LGPD

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Legislação Aplicável:** Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)  
**Status:** AUDITED  

---

## 1. Enquadramento Legal (LGPD)

- **Natureza do Dado:** O vetor representativo da face humana e os recortes faciais constituem **Dado Pessoal Sensível** (Art. 5º, inciso II da LGPD).
- **Base Legal Aplicável:** Consentimento específico e destacado fornecido pelo titular ou seu responsável (Art. 11, inciso I).
- **Finalidade Específica:** Controle e comprovação de frequência de integrantes vinculados aos projetos de extensão acadêmica no laboratório AILAB Makers.

---

## 2. Rastreamento do Ciclo de Vida do Dado Pessoal Sensível

```
[1. Coleta / Captura]  ──────────>  [2. Processamento RAM]  ──────────>  [3. Extração Vetorial]
  - Câmera física do tablet           - Buffer em memória volátil         - InsightFace ArcFace
  - Consentimento prévio exigido      - Descarte imediato do frame         - Conversão em 512 floats
                                                                                    │
                                                                                    ▼
[6. Expurgo Definitivo] <─────────  [5. Consulta e Matching] <─────────  [4. Armazenamento Seguro]
  - Revogação Art. 8º § 5º            - Comparação via pgvector            - Tabela face_embeddings
  - Eliminação Art. 18                - Supabase RLS restrito              - Supabase PostgreSQL
  - Invalidação de Cache RAM          - Logs sem imagem bruta              - Backup gerenciado
```

### Detalhamento por Fase:
1. **Coleta / Captura:** Realizada exclusivamente no fluxo de cadastro (`EnrollCapture.tsx`) ou reconhecimento (`RecognitionPanel.tsx`). O cadastro bloqueia o envio caso o switch de consentimento esteja desligado.
2. **Processamento em Memória:** Os bytes da imagem residem em memória apenas durante o processamento do request FastAPI. Nenhuma foto em JPEG/PNG bruta é gravada no sistema de arquivos do servidor nem no Supabase Storage.
3. **Extração Vetorial:** O vetor resultante é um array matemático de 512 números em ponto flutuante, normalizado em norma L2 unitária.
4. **Armazenamento:** Persistido na tabela `public.face_embeddings` associado ao `profile_id` (UUID). A tabela `public.profiles` guarda apenas o metadado do titular e as evidências de consentimento (`consent_given`, `consent_at`, `terms_version`).
5. **Consulta:** No reconhecimento diário, o vetor é comparado via RPC no banco ou via matriz em RAM. O cache em RAM possui expiração temporal estrita (TTL de 180 segundos).
6. **Expurgo Definitivo:** Implementado nas rotas `/profiles/{id}/revoke-consent` e `DELETE /profiles/{id}`.

---

## 3. Avaliação dos Direitos do Titular (LGPD Art. 18)

| Direito do Titular | Endpoint / Mecanismo | Status de Implementação | Evidência de Funcionamento | Risco Residual |
|---|---|:---:|---|---|
| **Confirmação da existência de tratamento** | `GET /api/v1/profiles/{id}` | **IMPLEMENTADO** | Retorna metadados do perfil se ativo. | Rota usa autenticação fraca (`verify_api_key`), permitindo enumeração por terceiros com a chave. |
| **Acesso aos dados** | `GET /api/v1/profiles/{id}` | **IMPLEMENTADO** | Exibe nome, matrícula, avatar e data de consentimento. | O vetor biométrico numérico não é exposto (correto por segurança e minimização). |
| **Revogação do consentimento (Art. 8º § 5º)** | `POST /api/v1/profiles/{id}/revoke-consent` | **IMPLEMENTADO** | Inativa o perfil (`active=false`), marca `consent_revoked_at=now()`, deleta os registros em `face_embeddings` e invalida o cache RAM. | Histórico de sessões em `sessions` é mantido para fins de prestação de contas acadêmicas (base legal de cumprimento de obrigação legal/regulatória). |
| **Eliminação dos dados pessoais (Art. 18 VI)** | `DELETE /api/v1/profiles/{id}` | **IMPLEMENTADO** | Deleta os registros em `face_embeddings`, deleta `face_logs`, remove a linha em `profiles` e invalida o cache. | Os backups diários gerenciados pelo Supabase retêm dados por até 7 a 30 dias até o ciclo de expiração natural do snapshot. |

---

## 4. Análise de Vazamento de Metadados e Side-Channels de Privacidade

1. **Vazamento de Identidade em Respostas Incertas (`face_service.py`):**
   - Na linha 373 de `backend/app/services/face_service.py`:
     ```python
     return {
         "recognized": False,
         "status": "uncertain",
         "profile_id": top.get("profile_id"),
         "name": top.get("name"),
         ...
     }
     ```
   - **Violação:** Se um terceiro não cadastrado (ou com aparência similar a um integrante) for fotografado, o sistema expõe o nome e o UUID de quem mais se assemelha a ele, mesmo sem confirmar a autenticação. Isso permite a atores maliciosos sondar a base para descobrir quem frequenta o laboratório.
2. **Exposição de Lista de Membros Ativos via Supabase Anon:**
   - A policy `anon_select_active_profiles` permite que qualquer cliente anônimo com a chave pública do Supabase leia `id`, `name` e `avatar_url` de todos os estudantes ativos. Permite raspagem (scraping) de dados pessoais sem controle de acesso institucional.
