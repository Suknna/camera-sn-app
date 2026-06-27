# Camera SN App Collaboration Notes

This repository contains the public Camera SN App source code.

## Scope

- Standalone offline scanning.
- Local SQLite persistence.
- Excel export and system sharing.
- Optional required-mode connection to a compatible enterprise control-plane API.

This repository does not contain the enterprise control-plane backend, admin console, deployment automation, customer configuration, signing assets, or private release workflows.

## Required Commands

```bash
pnpm install --frozen-lockfile
pnpm catalog:test
pnpm api:check
pnpm typecheck
pnpm test
pnpm build
```

## Rules

- Do not commit `.env*`, signing files, generated native build output, real SN data, customer data, or private endpoints.
- Keep `standalone` and `required` modes explicit through `VITE_APP_CONTROL_PLANE_MODE`.
- Do not add admin, bootstrap, audit, inventory, or control-plane implementation code to this repository.
- The sample catalog is for demonstration only; production users must edit `catalog/app.catalog.yaml` and rebuild.
