# AILAB-FACIAL — Facial-recognition attendance control

An attendance system for a university makerspace. A tablet at the entrance recognizes the member by camera and records check-in and check-out. Tutors follow the hours on a web dashboard.

> **Status:** under remediation. The 2026-11-11 audit found open security and privacy issues. Read [audit/REMEDIATION_STATUS.md](audit/REMEDIATION_STATUS.md) before operating it.

[Versão em português](README.pt-BR.md) · [Documentation](docs/README.md) · [Security policy](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [License: Apache-2.0](LICENSE)

## What it does

- **Kiosk app (Expo, Android APK):** captures up to five photos with a server-issued challenge.
- **Backend (FastAPI on Cloud Run):** checks the challenge, verifies liveness, computes a 512-dimension face embedding, matches it with pgvector, and records the session.
- **Database (Supabase, Postgres 17):** row-level security, RPCs for presence and for LGPD operations.
- **Dashboard (React, GitHub Pages):** for tutors. Hours, reports, manual entries, justifications.

Biometric data never leaves the server. The tablet never receives a template.

## Quick start

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
cd web && npm ci --legacy-peer-deps && npm run test
```

Full walkthrough: [docs/tutorials/first-run-local.md](docs/tutorials/first-run-local.md). Configuration: [docs/reference/env-vars.md](docs/reference/env-vars.md).

## Documentation

Organized by [Diátaxis](https://diataxis.fr/): [tutorials](docs/tutorials/), [how-to guides](docs/how-to/), [reference](docs/reference/), [explanations](docs/explanation/), [ADRs](docs/adr/README.md), [privacy](docs/privacy/), [ML model card](docs/ml/model-card.md), [runbooks](docs/runbooks/).

## Security and privacy

Report vulnerabilities privately, following [SECURITY.md](SECURITY.md). Do not open public issues with personal data, images, tokens or keys.

Known gaps and their status are tracked in [audit/REMEDIATION_STATUS.md](audit/REMEDIATION_STATUS.md). The project does not claim compliance with Brazil's LGPD; see [audit/LGPD_GAP_ANALYSIS.md](audit/LGPD_GAP_ANALYSIS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [GOVERNANCE.md](GOVERNANCE.md).

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
