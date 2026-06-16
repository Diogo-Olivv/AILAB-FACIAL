# Deploy no Samsung Galaxy Tab S6 Lite (modo kiosk)

Sprint 5 — colocar o PWA rodando 24/7 na entrada do laboratório.

## 1. Hospedar o PWA com HTTPS

A Câmera (`getUserMedia`) **só funciona em HTTPS** (ou `localhost`). Opções:

### Opção A — GitHub Pages (recomendado, gratuito)

```bash
cd ~/Coding/AILAB-FACIAL
git init && git add . && git commit -m "AILAB MVP"
# crie o repo "AILAB-FACIAL" no GitHub (PRIVADO se contiver dataset)
git remote add origin git@github.com:SEU_USUARIO/AILAB-FACIAL.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: `main` /pwa folder → Save**.
URL: `https://SEU_USUARIO.github.io/AILAB-FACIAL/`

> ⚠️ Se o repo for público, garanta que `.gitignore` exclui `dataset/`,
> `embeddings/database.json`, `attendance/attendance.db`. Já está configurado,
> confira antes do push.

### Opção B — Servidor próprio com Caddy

Caddy faz HTTPS automático com Let's Encrypt:

```caddyfile
ailab.exemplo.edu.br {
    root * /var/www/ailab/pwa
    file_server
}
```

## 2. Instalar no tablet

1. Abrir Chrome no Tab S6 Lite, navegar para a URL do PWA.
2. Conceder permissão de câmera (uma vez).
3. **Menu (3 pontos) → "Adicionar à tela inicial"** → confirme.
4. O ícone AILAB aparece na home; abrir uma vez, deve carregar offline depois.

## 3. Cadastrar pessoas

1. No tablet, abrir AILAB → toque em **Cadastro** (canto superior direito).
2. Digite o nome em snake_case (ex.: `maria_silva`).
3. Pessoa fica na frente, toque **Capturar 8 fotos** — ela varia levemente
   a pose entre cada captura (sorriso, leve giro).
4. Repetir para cada participante do lab.

> Antes de cada cadastro, **confirme que o termo (`docs/PRIVACIDADE.md`)
> está assinado**.

## 4. Modo Kiosk (trava no PWA)

1. Instalar **Fully Kiosk Browser** (Play Store, free).
2. Configurações:
   - **Start URL**: URL do seu PWA.
   - **Bloquear tudo**: barras de navegação, botões físicos (exceto power).
   - **Auto-restart on crash**: ON.
   - **Run on boot**: ON.
3. Reiniciar tablet — abre direto no AILAB e fica.

## 5. Suporte físico

- Suporte de tablet com cabo USB-C de **2 m** (alimentação contínua).
- Posicionar **na altura do rosto** (~150 cm do chão).
- Iluminação: evitar contraluz (janela atrás da pessoa).

## 6. Manutenção

| Sintoma | Causa provável | Ação |
|---|---|---|
| Tela preta | Tablet hibernou | Desabilitar bloqueio (Fully Kiosk faz) |
| Câmera negada | Reset do Chrome | Recadastrar permissão de câmera |
| Sessões não aparecem na planilha | Webhook offline ou URL errada | Ver console do Chrome (debug USB) |
| Reconhecimento ruim | Iluminação mudou | Recadastrar com fotos nas condições atuais |

## 7. Próximos passos (Sprint 6)

Depois de 1 semana de uso:
- Exportar sessões da planilha para CSV.
- Calcular FRR real (pessoas que tentaram >1x) e FAR (registros errados).
- Se FRR > 5%, recadastrar pessoas problemáticas.
- Ajustar `THRESHOLD` em `pwa/js/recognition.js` se necessário (documentar em `docs/THRESHOLD.md`).
