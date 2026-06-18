# Sincronização com Google Sheets — Setup

O PWA AILAB envia cada sessão fechada para uma planilha Google. Por segurança,
não usamos a Sheets API direto do navegador (exigiria expor chave da Service
Account no código JS, que é público). Em vez disso usamos um **Apps Script**
publicado como Web App que recebe um POST JSON e escreve na planilha.

A planilha tem **duas abas**:

- **`Eventos`** — uma linha por sessão registrada (entrada+saída). Schema bruto.
- **`Resumo Semanal`** — uma linha por (semana, integrante), com horas totais,
  dias presentes e sessões abandonadas. Atualizada automaticamente a cada POST.

## 1. Criar a planilha

1. https://sheets.new → renomeie para **AILAB - Presença**.
2. As abas `Eventos` e `Resumo Semanal` são criadas **automaticamente** pelo
   Apps Script no primeiro POST. Não precisa criá-las à mão.

## 2. Apps Script (servidor leve do webhook)

1. Menu **Extensões → Apps Script**.
2. Gere um token longo e aleatório (ex.: `openssl rand -hex 24`) — o **mesmo**
   valor vai no `EXPECTED_TOKEN` abaixo e em `pwa/js/sheets-sync.js`
   (`SHEETS_TOKEN`).
3. Cole no `Code.gs`:

```javascript
const EXPECTED_TOKEN = "COLE_AQUI_O_MESMO_TOKEN_DO_SHEETS_SYNC_JS";
const ABA_EVENTOS = "Eventos";
const ABA_RESUMO = "Resumo Semanal";
const TZ = "America/Sao_Paulo";

const HEADERS_EVENTOS = ["data", "nome", "entrada", "saida", "horas"];
const HEADERS_RESUMO = [
  "semana_inicio", "semana_fim", "nome",
  "horas_totais", "dias_presentes", "sessoes_abandonadas",
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.token !== EXPECTED_TOKEN) {
      return _json({ ok: false, error: "token inválido" });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventos = _aba(ss, ABA_EVENTOS, HEADERS_EVENTOS);
    eventos.appendRow([data.data, data.nome, data.entrada, data.saida, data.horas]);
    _upsertResumo(ss, data.data, data.nome);
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _aba(ss, nome, headers) {
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Segunda-feira da semana ISO da data (yyyy-MM-dd).
function _segundaDaSemana(dataStr) {
  const d = new Date(dataStr + "T12:00:00");
  const dow = d.getDay(); // 0=domingo
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}

function _domingoDaSemana(dataStr) {
  const d = new Date(dataStr + "T12:00:00");
  const dow = d.getDay();
  const offset = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + offset);
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}

// Recalcula a linha (semana, nome) varrendo Eventos. O(N) por evento, ok
// para o volume do laboratório.
function _upsertResumo(ss, dataStr, nome) {
  const segunda = _segundaDaSemana(dataStr);
  const domingo = _domingoDaSemana(dataStr);

  const eventos = _aba(ss, ABA_EVENTOS, HEADERS_EVENTOS);
  const linhas = eventos.getDataRange().getValues();
  let total = 0;
  const dias = {};
  let abandonadas = 0;

  for (let i = 1; i < linhas.length; i++) {
    const [rData, rNome, , , rHoras] = linhas[i];
    if (rNome !== nome) continue;
    const dStr = (rData instanceof Date)
      ? Utilities.formatDate(rData, TZ, "yyyy-MM-dd")
      : String(rData);
    if (dStr < segunda || dStr > domingo) continue;
    dias[dStr] = true;
    const hStr = String(rHoras);
    if (hStr === "n/a" || hStr === "" || hStr === "null") {
      abandonadas++;
    } else {
      const h = Number(hStr.replace(",", "."));
      if (!isNaN(h)) total += h;
    }
  }

  const resumo = _aba(ss, ABA_RESUMO, HEADERS_RESUMO);
  const rrows = resumo.getDataRange().getValues();
  let linha = -1;
  for (let i = 1; i < rrows.length; i++) {
    const [si, , n] = rrows[i];
    const siStr = (si instanceof Date)
      ? Utilities.formatDate(si, TZ, "yyyy-MM-dd")
      : String(si);
    if (siStr === segunda && n === nome) { linha = i + 1; break; }
  }

  const valores = [
    segunda, domingo, nome,
    Number(total.toFixed(2)),
    Object.keys(dias).length,
    abandonadas,
  ];
  if (linha > 0) {
    resumo.getRange(linha, 1, 1, valores.length).setValues([valores]);
  } else {
    resumo.appendRow(valores);
  }
}
```

4. Botão azul **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
5. Clique **Implantar**. Aprove as permissões pedidas.
6. Copie a **URL do app da Web** (`https://script.google.com/macros/s/AKfy.../exec`).

> Toda vez que alterar `Code.gs` é preciso **criar nova implantação** (ou
> "Gerenciar implantações → editar → Nova versão"), senão o webhook continua
> servindo o código antigo.

## 3. Configurar URL e token no PWA

Não tem arquivo de config no repo — a configuração fica em `localStorage` do
navegador, por dispositivo. Repo público sem nenhum segredo.

No PWA:

1. Clique em **Gerenciar** (canto superior direito).
2. Clique em **⚙ Sheets**.
3. Cole a URL `/exec` e o token (mesmo valor de `EXPECTED_TOKEN`).
4. Clique **Testar** — deve aparecer `✓ Conectado. Apps Script respondeu ok:true`.
5. Clique **Salvar**.

Se `Testar` falhar:

| Mensagem | Causa | Ação |
|---|---|---|
| `HTTP 405` ou resposta não-JSON | Implantação não está "Qualquer pessoa", ou não foi reimplantada após edição | Apps Script → Implantar → Gerenciar → editar → Nova versão |
| `token inválido` | `SHEETS_TOKEN` ≠ `EXPECTED_TOKEN` | Conferir os dois e re-implantar se mudou o `Code.gs` |
| Erro de rede | Sem internet, ou URL malformada | Conferir URL termina em `/exec` |

**Repetir esse setup em cada dispositivo** (notebook dev, tablet prod). A
config persiste no localStorage do navegador — sobrevive a reloads, updates
do Service Worker e instalação do PWA. Só é perdida em "Clear site data" ou
reset de fábrica.

## 4. Testar

```bash
curl -X POST -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"token":"SEU_TOKEN","data":"2026-06-17","nome":"teste","entrada":"09:00","saida":"11:00","horas":"2.00"}' \
  -L "https://script.google.com/macros/s/AKfy.../exec"
```

- Resposta esperada: `{"ok":true}`.
- A aba **`Eventos`** ganha uma linha com os dados crus.
- A aba **`Resumo Semanal`** ganha (ou atualiza) uma linha
  `2026-06-15 | 2026-06-21 | teste | 2.00 | 1 | 0`.

Testes adicionais:

- Token errado → `{"ok":false,"error":"token inválido"}`, nada escrito.
- Sessão abandonada (cliente envia `saida:"n/a"`, `horas:"n/a"`) → conta em
  `sessoes_abandonadas`, soma em `dias_presentes`, **não** soma em
  `horas_totais`.

## 5. Visualizações opcionais

A `Resumo Semanal` está em formato long (uma linha por par semana×pessoa). Pra
ver em grade (semanas nas colunas, pessoas nas linhas):

- **Tabela dinâmica nativa** (Inserir → Tabela dinâmica): linhas=`nome`,
  colunas=`semana_inicio`, valores=`horas_totais` (SOMA).
- Ou **fórmula em uma terceira aba**:

```
=QUERY('Resumo Semanal'!A:F,
  "SELECT C, SUM(D) WHERE C IS NOT NULL GROUP BY C PIVOT A", 1)
```

## 6. Considerações de privacidade (LGPD)

- A planilha contém **nome + horários** — não embeddings nem fotos.
- Compartilhe a planilha **só com tutores do projeto**.
- Apps Script roda como sua conta; revise periodicamente quem tem acesso.
