# Sincronização com Google Sheets — Setup

O PWA AILAB envia cada sessão fechada para uma planilha Google. Por segurança,
não usamos a Sheets API direto do navegador (exigiria expor chave da Service
Account no código JS, que é público). Em vez disso usamos um **Apps Script**
publicado como Web App que recebe um POST JSON e escreve na planilha.

## 1. Criar a planilha

1. https://sheets.new → renomeie para **AILAB - Presença**.
2. Cabeçalhos na linha 1:

   | A    | B    | C       | D     | E     |
   |------|------|---------|-------|-------|
   | data | nome | entrada | saida | horas |

3. (Opcional) Aba **Dashboard** com tabela dinâmica:
   - linhas: `nome`
   - valores: `SUM(horas)`

## 2. Apps Script (servidor leve do webhook)

1. Menu **Extensões → Apps Script**.
2. Cole no `Code.gs`:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.data, data.nome, data.entrada, data.saida, data.horas]);
  return ContentService.createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Botão azul **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
4. Clique **Implantar**. Aprove as permissões pedidas.
5. Copie a **URL do app da Web** (`https://script.google.com/macros/s/AKfy.../exec`).

## 3. Colar a URL no PWA

Edite `pwa/js/sheets-sync.js`:

```javascript
const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfy.../exec";
```

## 4. Testar

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":"2026-06-16","nome":"teste","entrada":"09:00","saida":"11:00","horas":"2.00"}' \
  "https://script.google.com/macros/s/AKfycbyy4MXP-v2f_4MUpWPGGn4HoOqG3yBlIxDs68ESyKv_kAwsXKR5SrMzV8kJQDxH8TuQow/exec"
```

Deve aparecer uma linha na planilha.

## 5. Considerações de privacidade (LGPD)

- A planilha contém **nome + horários** — não embeddings nem fotos.
- Compartilhe a planilha **só com tutores do projeto**.
- Apps Script roda como sua conta; revise periodicamente quem tem acesso.
