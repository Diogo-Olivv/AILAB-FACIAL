# Glossário

Termos usados no código, na documentação e na interface.

| Termo | Significado neste projeto |
|---|---|
| **Totem** | Tablet na entrada do laboratório que roda o app em modo kiosk e registra presença. Também chamado de *kiosk*. |
| **Kiosk** | Conta de sistema de um totem, com `app_metadata.role = 'kiosk'`. Cada totem tem a sua. |
| **Tutor** | Pessoa responsável pelo laboratório. Acessa o painel e cadastra integrantes. Conta com `app_metadata.role = 'tutor'`. |
| **Integrante** | Pessoa cadastrada que registra presença. Corresponde a um `profile`. |
| **Matrícula** | Identificador do integrante no laboratório. Único na base. Dado pessoal. |
| **Embedding** | Vetor numérico de 512 dimensões que representa um rosto. É dado biométrico. Não é uma imagem. |
| **Template** | Conjunto de embeddings de um integrante, guardado em `face_embeddings`. |
| **Rajada (burst)** | Conjunto de 3 a 5 fotos tiradas no cadastro ou na atualização de template. |
| **Desafio (challenge)** | Token assinado e de curta duração, emitido pelo backend antes de cada captura. Prova que a requisição é recente e vinculada ao dispositivo. Não prova que a imagem veio de um rosto real. |
| **Replay** | Reenvio de uma captura antiga ou de outra captura. O replay guard em banco impede a reutilização. |
| **PAD** (*presentation attack detection*) | Detecção de ataque de apresentação: foto impressa, tela, máscara. Modelo MiniFASNetV2. |
| **FIQA** | Avaliação da qualidade da imagem facial (nitidez e tamanho). |
| **BioHash** | Transformação aleatória aplicada ao embedding antes de guardar. Dificulta a reconstrução do rosto a partir do template. |
| **Limiar de cosseno** | Valor mínimo de similaridade para considerar que é a mesma pessoa. Padrão atual: 0,62. Abaixo de 0,55 é "não reconhecido". Entre os dois, "incerto". |
| **HNSW** | Índice aproximado de vizinhos mais próximos no pgvector, usado na busca de embeddings. |
| **RLS** (*row-level security*) | Regra do Postgres que filtra linhas por usuário. Base da segurança de acesso no Supabase. |
| **RPC** | Função do Postgres chamada pela API do Supabase. Muitas operações críticas são RPCs. |
| **`SECURITY DEFINER`** | Função que roda com permissão do dono, e não do chamador. Exige cuidado especial. |
| **Sessão** | Registro de um período de presença: entrada e saída. |
| **Sessão aberta** | Sessão sem saída registrada. |
| **Sessão anulada (voided)** | Sessão encerrada sem contar horas. Acontece quando passa do limite ou quando o tutor anula. |
| **Debounce** | Janela de 60 segundos em que um novo registro do mesmo integrante é ignorado. |
| **Janela de cadastro** | Período em que um totem pode atualizar templates sem tutor. Está fixa no código e vencida desde 2026-10-02. |
| **Trava consultiva** (*advisory lock*) | Trava do Postgres que serializa operações sobre o mesmo integrante. |
| **Lease** | Tempo reservado a um processo para uma tentativa de reconhecimento. Expira se o processo falhar. |
| **RIPD** | Relatório de impacto à proteção de dados pessoais (LGPD, art. 38). |
| **Encarregado (DPO)** | Pessoa indicada pelo controlador para o canal com titulares e com a ANPD (LGPD, art. 41). |
| **Controlador** | Quem decide sobre o tratamento dos dados. Neste caso, o laboratório. |
| **OTA** | Atualização do app pela internet, sem reinstalar o APK. Via EAS Update. |
| **APCER / BPCER** | Taxas de erro de detecção de ataque (ISO/IEC 30107-3): ataques aceitos indevidamente e pessoas reais barradas pelo PAD. |
| **FMR / FNMR** | Falsa aceitação e falsa rejeição do reconhecimento. |
| **ADR** | Registro de decisão de arquitetura. Ver [adr/](adr/). |
