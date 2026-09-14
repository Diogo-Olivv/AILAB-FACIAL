# AILAB-FACIAL V4 — MAPEAMENTO EXAUSTIVO DE SUPERFÍCIE DE ATAQUE

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Mapeamento de Superfícies de Entrada (Entry Points)

| Superfície | Ponto de Entrada / Mecanismo | Nível de Confiança | Exposição de Rede | Ativo Exposto | Controles Existentes | Risco Identificado |
|---|---|:---:|:---:|---|---|---|
| **API de Reconhecimento** | `POST /api/v1/recognize` | Baixo (Não confiável) | Pública (Internet via Cloud Run) | Registros de presença (`sessions`), logs faciais | `verify_kiosk_key`, `validate_image`, debounce de 60s, PAD MiniFASNet | Injeção de frames digitais arbitrários via HTTP, ausência de nonce ou desafio dinâmico. |
| **API de Cadastro (Enrollment)** | `POST /api/v1/enroll` | Médio (Tutor autenticado) | Pública (Internet via Cloud Run) | Tabela `profiles`, biometria em `face_embeddings` | `verify_tutor_token` (JWT Supabase Auth), checagem 1:N anti-duplicidade | Manipulação do formulário multipart; dependência de integridade da conta do tutor. |
| **API de Renovação Biométrica** | `POST /api/v1/profiles/{id}/refresh-embedding` | Médio (Tutor autenticado) | Pública (Internet via Cloud Run) | Vetor biométrico de integrante existente | `verify_tutor_token`, `_guard_against_identity_swap`, checagem intra-burst | Substituição de vetor facial por fotos sintéticas ou forjadas se a conta do tutor for comprometida. |
| **API de Direitos do Titular** | `POST /api/v1/profiles/{id}/revoke-consent` & `DELETE /{id}` | Médio (Tutor autenticado) | Pública (Internet via Cloud Run) | Perfis e vetores faciais | `verify_tutor_token`, expurgo de vetores e invalidação de cache | Negação de serviço interna (deleção não autorizada se token de tutor vazar). |
| **API de Consulta de Perfil** | `GET /api/v1/profiles/{profile_id}` | Médio (API Key) | Pública (Internet via Cloud Run) | Metadados do aluno, status de consentimento e matrícula | `verify_api_key` (chave legada) | Enumeração BOLA de perfis e matrículas se a chave estática vazar; falta de separação por kiosk. |
| **API de Estatísticas** | `GET /api/v1/sessions/stats/{profile_id}` | Médio (API Key) | Pública (Internet via Cloud Run) | Horas acumuladas de permanência | `verify_api_key` (chave legada) | Incompatibilidade de header (`X-Kiosk-Key` vs `X-API-Key`) quebra o client; enumeração de horas de alunos. |
| **API de Manutenção** | `POST /api/v1/maintenance/cleanup` | Alto (Scheduler ou Admin) | Pública (Internet via Cloud Run) | Fechamento de sessões e cache de RAM | `verify_cron_or_api_key` (OIDC Service Account do GCP ou `API_KEY`) | Execução de sweep forçado caso a chave administrativa vaze; risco de negação de serviço no cache. |
| **Health & Readiness** | `GET /health` e `GET /health/ready` | Totalmente Não Confiável | Pública (Internet via Cloud Run) | Status operacional do processo e memória | Sem autenticação (probes de orquestração) | Reconhecimento de infraestrutura e timing de cold start por atacantes externos. |
| **PostgREST do Supabase (Direto)** | `https://jbahfjfvyomayrmytpdk.supabase.co/rest/v1/*` | Não Confiável (Anon Key pública) | Pública (Internet via Supabase) | Dados das tabelas `profiles`, `sessions` | RLS (`anon_select_active_profiles`, `anon_select_open_sessions`) | Enumeração de nomes e avatares de todos os integrantes ativos do laboratório; dump de presença aberta. |
| **Supabase Realtime (WebSockets)** | `wss://jbahfjfvyomayrmytpdk.supabase.co/realtime/v1/*` | Não Confiável (Anon Key pública) | Pública (Internet via Supabase) | Eventos em tempo real de entrada/saída | RLS sobre o canal de streaming | Monitoramento passivo em tempo real de presença física de integrantes (stalking / vigilância). |
| **Câmera Física do Tablet** | Sensor local via `expo-camera` | Médio (Dispositivo local) | Físico (Ambiente do laboratório) | Frames de câmera ao vivo | Permissão de sistema operacional Android | Ataques de apresentação física (fotos impressas, máscaras, replay de vídeo em tela). |
| **Armazenamento Local do App** | `AsyncStorage` no Android | Médio (Sandbox do App) | Local ao dispositivo | Sessão e tokens do Supabase Auth de tutores | Sandbox padrão do Android | Extração de tokens em dispositivos com root ou depuração USB habilitada. |

---

## 2. Superfície Documentada vs. Superfície Real Implementada

| Superfície Declarada na Documentação | Existência Real no Código | Análise de Divergência | Impacto de Segurança |
|---|:---:|---|---|
| **Web Kiosk (`/kiosk`)** | ❌ **Ausente** | O `README.md` afirma que o painel web possui um modo kiosk para captura via browser. O código em `web/src/App.tsx` possui apenas rotas `/login` e `/dashboard`. | Documentação enganosa; a superfície web de captura não existe no momento. |
| **Web Cadastro (`/cadastro`)** | ❌ **Ausente** | O `web/README.md` afirma existir uma rota de cadastro biométrico web para o owner. No código, o cadastro só pode ser realizado via tablet Expo. | Redução de superfície de ataque não documentada (positivo para segurança, mas divergente). |
| **Sincronização com Google Sheets** | ❌ **Ausente** | Declarada no `README.md` legado e com referências no histórico. Não há mais worker nem triggers ativos para Google Sheets. | Código legado removido, documentação residual. |
| **Deploy no Render (`render.yaml`)** | ⚠️ **Desatualizado** | Arquivo `render.yaml` no repositório com `plan: free` (512MB) e `FACE_THRESHOLD="0.55"`. O deploy real é no Google Cloud Run com threshold 0.80. | Risco de deployment drift caso alguém tente rodar o serviço no Render. |
| **Separação de Chaves Kiosk vs. Admin** | ⚠️ **Parcial** | O código implementou `verify_kiosk_key` para `/recognize` e `verify_tutor_token` para `/enroll`, mas `/sessions/stats` e `/profiles/{id}` ainda usam a chave legada única. | Quebra de funcionalidade ou concessão excessiva de privilégios para o tablet. |

---

## 3. Vetores de Exposição de Segredos

1. **Tokens no Bundle do Cliente:**
   - Variáveis `EXPO_PUBLIC_*` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_KIOSK_KEY`) são embutidas em texto puro no código JavaScript minificado do APK Android gerado via EAS. Qualquer pessoa que extrair o APK pode obter a chave anon do Supabase e a chave do Kiosk.
2. **Histórico do Git:**
   - Commits `6c4f975` e `6310cb8` contêm tokens JWT do Supabase válidos até 2036.
3. **Variáveis de Ambiente do Cloud Run:**
   - `SUPABASE_SERVICE_KEY`: Permite bypass total de RLS no banco de dados. Deve permanecer estritamente protegida no Google Cloud Secret Manager.
