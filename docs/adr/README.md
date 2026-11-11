# Registros de decisão de arquitetura (ADR)

Cada decisão relevante tem um arquivo numerado. Use [0000-template.md](0000-template.md) para novas decisões. Uma decisão aceita só muda por nova ADR que a substitua.

| ADR | Título | Status |
|---|---|---|
| [0001](0001-server-side-recognition.md) | Reconhecimento no servidor, não no tablet | aceito |
| [0002](0002-pgvector-hnsw.md) | Busca vetorial com pgvector e HNSW | aceito |
| [0003](0003-supabase-rls-service-role.md) | Acesso por RLS; `service_role` só no backend | aceito |
| [0004](0004-cloud-run-over-render.md) | Cloud Run em vez de Render | aceito |
| [0005](0005-individual-kiosk-jwt.md) | Conta de kiosk por dispositivo | aceito (não implantado) |
| [0006](0006-replay-guard-in-postgres.md) | Anti-replay no Postgres | aceito (não implantado) |
| [0007](0007-expo-kiosk.md) | Totem em Expo, APK Android | aceito |
| [0008](0008-cron-via-github-actions.md) | Limpeza noturna por GitHub Actions | aceito, com ressalvas |
| [0009](0009-contract-first.md) | Contrato de API primeiro | proposto |
