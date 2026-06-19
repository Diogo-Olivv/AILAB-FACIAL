![AILAB FACIAL Banner](docs/banner.png)

# AILAB-FACIAL — Presença por Reconhecimento Facial

Sistema offline-first de controle de presença para laboratório de extensão. Substitui a lista de assinatura manual por reconhecimento facial automático em um tablet ou computador posicionado na entrada do laboratório.

> Projeto didático e prático. O objetivo é tanto entregar o sistema com a melhor experiência de usuário quanto **aprender os fundamentos de inteligência artificial por trás do reconhecimento facial**.

## 🚀 Novidades e Melhorias

- **Offline-First PWA:** O sistema inteiro roda diretamente no navegador, suportando instalação como aplicativo e funcionando perfeitamente sem internet.
- **Painel Administrativo Restrito:** Área de configurações, cadastros e backup protegida por um PIN numérico para evitar acesso não autorizado.
- **Sincronização em Tempo Real (Google Sheets):** Registro instantâneo de Entrada e Saída. Calcula os minutos de permanência e os sincroniza com a nuvem quando houver conexão.
- **Matrículas Integradas:** Cada aluno agora possui nome e matrícula vinculados nativamente à sua biometria facial.

## Arquitetura em uma frase

PWA (web app instalável) que roda no tablet, usa a câmera frontal, identifica o participante localmente via `face-api.js` (TensorFlow.js, 128-D embeddings), registra a entrada/saída em IndexedDB (Storage v2) e sincroniza em background com uma Google Sheets para os tutores visualizarem as horas de forma transparente.

```
Tablet (PWA)  ──Wi-Fi──►  Google Sheets  ──►  Tutores
   │
   └─ Câmera → detecção → embedding → matching → IndexedDB
```

## Estrutura do repositório

| Pasta | O que vive aqui |
|---|---|
| `notebooks/` | Jupyter — fase inicial de **aprendizado**. Cada notebook ensina um conceito do OpenCV e TensorFlow. |
| `pwa/` | App web final (PWA) que roda no dispositivo com cache offline, UI e IA embarcada. |
| `pwa/models/` | Modelos pré-treinados do face-api.js (TinyFaceDetector, 68Landmark, RecognitionNet). |
| `pwa/js/` | Lógica central separada em módulos (`app.js`, `storage.js`, `sheets-sync.js`, `camera.js`, `ui.js`). |
| `docs/` | Imagens (banner), notas de deploy, setup do Google Sheets e LGPD. |
| `python/` | (Legado/Estudo) Antigo servidor e scripts de avaliação/validação de dataset do início do projeto. |

## Como testar e rodar o PWA

O aplicativo foi inteiramente convertido para Web e funciona sem necessidade de servidor Python rodando por trás.

```bash
# Navegue até a pasta do PWA
cd pwa

# Inicie um servidor web simples (ex: http-server do npm)
npx http-server -p 8080

# Abra http://localhost:8080 no seu navegador.
# Clique em "Gerenciar" e crie seu PIN Administrativo.
```

## Sincronização com o Google Sheets

Para acompanhar a presença pelo Google Sheets:
1. Crie uma planilha em branco no Google Sheets.
2. Acesse **Extensões > Apps Script**.
3. Copie o script contido em `docs/SHEETS_SETUP.md` e cole no editor.
4. Clique em Implantação > Nova implantação > App Web (Acesso: Qualquer pessoa).
5. Copie a URL gerada pelo Google.
6. No aplicativo AILAB, abra as Configurações (⚙️), cole a URL e a senha de segurança (token).
7. Clique em Salvar. O sistema irá automaticamente recriar as abas e enviar os dados das saídas dos alunos.

## Privacidade e Segurança — LGPD

O rosto de um aluno é um **dado biométrico sensível**. Antes de cadastrar qualquer participante:

1. Foi implementado o **checkbox obrigatório de consentimento LGPD** direto no fluxo do aplicativo, que não permite o cadastro sem aceite.
2. O participante deve estar ciente da finalidade (computar presença) e de onde os dados ficam hospedados.
3. As fotos capturadas não são salvas de forma bruta; elas são matematicamente processadas e convertidas em matrizes vetoriais (embeddings).
4. Os embeddings **nunca saem do dispositivo**, garantindo proteção contra interceptação dos dados biométricos.
