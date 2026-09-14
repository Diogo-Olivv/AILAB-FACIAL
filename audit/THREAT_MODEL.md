# AILAB-FACIAL V4 — MODELAGEM DE AMEAÇAS & VETORES ADVERSARIAIS

**Data:** 13 de Setembro de 2026  
**Metodologia:** STRIDE / NIST AI RMF / ISO/IEC 30107  
**Status:** AUDITED  

---

## 1. Perfis de Atores de Ameaça (Threat Actors)

| Ator de Ameaça | Motivação | Capacidades Técnicas | Nível de Acesso |
|---|---|---|---|
| **Estudante / Integrante Malicioso** | Fraudar presença para cumprimento artificial de horas obrigatórias. | Conhecimento básico de rede, acesso a fotos em redes sociais, dispositivos móveis. | Acesso físico ao tablet do laboratório ou rede local Wi-Fi. |
| **Atacante Remoto Automatizado (Bot)** | Exploração oportunista de APIs expostas, DoS e varredura de endpoints. | Ferramentas automatizadas (curl, Burp Suite, scripts Python, scanners). | Acesso via Internet à URL pública do Google Cloud Run. |
| **Atacante com Dispositivo Comprometido** | Clonar credenciais ou manipular o fluxo de captura em nível de SO/sensor. | Engenharia reversa de APK, emulação de câmera virtual no Android, captura de tráfego TLS. | Posse de APK modificado ou tablet Android rooteado. |
| **Insider / Operador com Credencial Fraca** | Acessar dados restritos ou manipular cadastros sem autorização formal. | Acesso às credenciais compartilhadas de visualização de painel web. | Credencial de visualizador (`viewer`) ou senha comum de tutor. |
| **Atacante de Supply Chain** | Injetar código ou pesos adversariais na cadeia de build e dependências. | Comprometimento de repositórios upstream (HuggingFace, PyPI, GitHub Releases). | Controle sobre downloads de modelos (`pad.onnx`, `buffalo_s`). |

---

## 2. Modelagem STRIDE Aplicada

### 2.1 Spoofing (Falsificação de Identidade)
- **Ameaça S-1: Ataque de Apresentação 2D (PAD Físico):**
  - *Cenário:* Um integrante posiciona a foto impressa ou a tela de um smartphone exibindo a foto de um colega diante da câmera do tablet.
  - *Mitigação Atual:* Modelo MiniFASNetV2 (`pad.onnx`) com threshold de vivacidade `0.45` e análise espectral FFT/LBP de contingência.
  - *Avaliação:* **Parcialmente Mitigado.** MiniFASNetV2 mitiga impressões em papel e telas comuns com ângulo reto, mas pode ser contornado por vídeos de alta resolução, movimentos de tela ou telas de alta densidade (OLED/Retina) com brilho calibrado.
- **Ameaça S-2: Injeção Digital de Frames (Bypass Total de Sensor):**
  - *Cenário:* O atacante extrai `EXPO_PUBLIC_KIOSK_KEY` do APK ou do tráfego do tablet e realiza um `POST /api/v1/recognize` diretamente via HTTP com fotos nítidas do alvo.
  - *Mitigação Atual:* Nenhuma. Não há nonce, desafio dinâmico ou assinatura criptográfica de hardware gerada pelo sensor da câmera.
  - *Avaliação:* **VULNERÁVEL (Crítico).**

### 2.2 Tampering (Adulteração de Dados)
- **Ameaça T-1: Manipulação de Horas via Supabase PostgREST:**
  - *Cenário:* Um usuário autenticado no painel web ou portador de um JWT interceptado realiza queries diretas de `UPDATE sessions SET duration_s = 99999` ou altera `check_in`/`check_out`.
  - *Mitigação Atual:* Migration `05_secure_rls_policies.sql` removeu a policy `authenticated_manage_sessions` e criou `tutor_write_sessions`.
  - *Avaliação:* **Parcialmente Mitigado.** O arquivo `schema.sql` ainda mantém as políticas vulneráveis (`USING (true)`). Se um administrador rodar `schema.sql` no console, a vulnerabilidade ressurge imediatamente (Deployment Drift).

### 2.3 Repudiation (Repúdio)
- **Ameaça R-1: Negação de Presença Registrada por Falso Positivo:**
  - *Cenário:* Um aluno afirma que a entrada ou saída foi registrada por engano devido à semelhança facial com outro integrante.
  - *Mitigação Atual:* Gravação de `face_logs` contendo `profile_id`, `confidence` e `created_at`.
  - *Avaliação:* **Parcialmente Mitigado.** As imagens de captura não são armazenadas (por conformidade LGPD), o que impede auditoria visual forense retrospectiva em caso de contestação de score biométrico duvidoso.

### 2.4 Information Disclosure (Vazamento de Informações)
- **Ameaça I-1: Enumeração BOLA de Integrantes via Supabase Anon:**
  - *Cenário:* Qualquer usuário da internet utiliza a URL e Anon Key do Supabase para listar todos os nomes, IDs e URLs de avatar de integrantes cadastrados na tabela `profiles`.
  - *Mitigação Atual:* A policy `anon_select_active_profiles` restringe a leitura a membros ativos (`active = true`).
  - *Avaliação:* **VULNERÁVEL (Privacy Gap).** Não há necessidade legítima para que clientes anônimos da internet possam varrer a lista completa de integrantes sem autenticação de contexto.
- **Ameaça I-2: Vazamento de Nome e ID em Reconhecimento Inconclusivo:**
  - *Cenário:* Na busca vetorial pgvector, requisições que caem na zona incerta (`status="uncertain"`) devolvem o `profile_id` e o `name` do candidato mais próximo.
  - *Mitigação Atual:* Nenhuma. O retorno é explícito no corpo JSON da resposta.
  - *Avaliação:* **VULNERÁVEL.**

### 2.5 Denial of Service (Negação de Serviço & Esgotamento de Recursos)
- **Ameaça D-1: Esgotamento de CPU/Memória por Imagens Gigantes (Decompression Bomb):**
  - *Cenário:* Envio de imagens com resolução extrema (ex: 20.000 x 20.000 pixels) com compressão gzip/JPEG, respeitando o limite bruto de 5 MB de rede.
  - *Mitigação Atual:* `validate_image` valida o tamanho em bytes (5 MB), mas não limita as dimensões em pixels antes da chamada ao `Image.open().convert("RGB")`.
  - *Avaliação:* **VULNERÁVEL.** O descompactador PIL pode alocar mais de 1.2 GB de memória RAM para uma única imagem com dimensões extremas, derrubando o container Cloud Run por OOM.
- **Ameaça D-2: Inundação de Inferência (Cost / Resource Exhaustion):**
  - *Cenário:* Um atacante inunda `POST /api/v1/recognize` com rajadas contínuas de 5 frames por request.
  - *Mitigação Atual:* Sem rate-limiting em nível de aplicação ou API Gateway.
  - *Avaliação:* **VULNERÁVEL.**

### 2.6 Elevation of Privilege (Elevação de Privilégios)
- **Ameaça E-1: Cadastro de Integrante sem Autorização de Tutor:**
  - *Cenário:* Um usuário não autorizado tenta cadastrar um novo perfil enviando requisição para `/api/v1/enroll`.
  - *Mitigação Atual:* `verify_tutor_token` valida a assinatura do JWT Supabase Auth e exige `app_metadata.role == 'tutor'`.
  - *Avaliação:* **VERIFICADO (Mitigado).** A dependência falha de forma estrita (fail-closed) com HTTP 401/403.

---

## 3. Árvores de Ataque Primárias (Attack Trees)

### Árvore A: Autenticar Presença como Outro Integrante
```
[Obter Check-in de Outra Pessoa]
├── 1. Injeção Digital Remota (Via API)
│   ├── 1.1 Extrair KIOSK_API_KEY do APK/bundle JS  --> SUCESSO (Chave embutida)
│   ├── 1.2 Coletar foto nítida da vítima (redes sociais)
│   └── 1.3 Disparar POST /api/v1/recognize via curl --> SUCESSO (Sem desafio/nonce)
│
└── 2. Ataque de Apresentação Física no Tablet (Kiosk)
    ├── 2.1 Exibir foto impressa em papel fosco
    │   └── Bloqueado pelo analisador cromático / MiniFASNetV2
    └── 2.2 Exibir vídeo em tela de alta resolução com piscar de olhos
        └── Risco de bypass em ângulo oblíquo ou iluminação controlada
```

### Árvore B: Inflar Horas Acadêmicas no Painel
```
[Obter Crédito Artificial de Horas no Laboratório]
├── 1. Explorar Saída Esquecida (Abandono de Sessão)
│   ├── 1.1 Fazer check-in legítimo às 08:00
│   ├── 1.2 Sair do laboratório sem bater saída
│   ├── 1.3 Aguardar sweep diário à meia-noite
│   │   └── Backend marca voided_at (pretendendo 0h)
│   └── 1.4 Tutor abre painel web (web/src/lib/aggregate.ts)
│       └── Falha de lógica calcula check_out - check_in --> SUCESSO (Crédito de 16h)
```
